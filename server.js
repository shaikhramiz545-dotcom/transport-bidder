require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const https = require('https');

const app = express();
const PORT = 4000;

// Rate limit for Google proxy endpoints: 60 requests per minute per IP
const proxyLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { error: 'Too many requests. Try again in a minute.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const Maps_API_KEY = process.env.Maps_API_KEY;
if (!Maps_API_KEY || Maps_API_KEY.trim() === '') {
  console.error('\n*** ERROR: Maps_API_KEY is missing or empty ***');
  console.error('Create a .env file in the project root with:');
  console.error('  Maps_API_KEY=your_google_maps_api_key\n');
  process.exit(1);
}

// CORS for all origins (Flutter Web, mobile, etc.)
app.use(cors({ origin: true }));
app.use(express.json());

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        let parsed;
        try {
          parsed = JSON.parse(raw);
        } catch (e) {
          return resolve({ error: 'Invalid JSON from Google', raw });
        }
        resolve(parsed);
      });
    }).on('error', reject);
  });
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// ---------- Admin (control panel) ----------
if (!process.env.ADMIN_PASSWORD) { console.error('FATAL: ADMIN_PASSWORD env var is not set'); process.exit(1); }
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

app.post('/api/admin/login', (req, res) => {
  const body = req.body || {};
  const email = String(body.email || '').trim();
  const password = String(body.password || '');
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Invalid password' });
  }
  const token = 'admin_' + Math.random().toString(36).slice(2, 15) + Date.now().toString(36);
  res.json({ token });
});

app.get('/api/admin/stats', (req, res) => {
  const auth = req.headers.authorization || '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  if (!token || !token.startsWith('admin_')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  let todaysRides = 0;
  let pendingRides = 0;
  for (const ride of rides.values()) {
    if (ride.createdAt && ride.createdAt >= todayStart) todaysRides++;
    if (ride.status === 'pending') pendingRides++;
  }
  res.json({
    onlineDrivers: 0,
    pendingVerifications: 0,
    todaysRides,
    pendingRides,
    totalRides: rides.size,
  });
});

// ---------- Phase 2: Ride / Bidding (in-memory) ----------
const rides = new Map(); // rideId -> ride
let _nextRideId = 1;
function nextRideId() {
  return String(_nextRideId++);
}

// Create ride request (user app)
app.post('/api/rides', (req, res) => {
  const body = req.body || {};
  const pickupLat = Number(body.pickupLat);
  const pickupLng = Number(body.pickupLng);
  const dropLat = Number(body.dropLat);
  const dropLng = Number(body.dropLng);
  const pickupAddress = String(body.pickupAddress || '').trim() || 'Pickup';
  const dropAddress = String(body.dropAddress || '').trim() || 'Drop';
  const distanceKm = Number(body.distanceKm) || 0;
  const vehicleType = String(body.vehicleType || '').trim() || 'taxi_std';
  const userPrice = Number(body.userPrice) || 0;
  if (!Number.isFinite(pickupLat) || !Number.isFinite(pickupLng) || !Number.isFinite(dropLat) || !Number.isFinite(dropLng)) {
    return res.status(400).json({ error: 'Missing or invalid pickup/drop coordinates' });
  }
  const rideId = nextRideId();
  const userPhone = (body.userPhone != null && String(body.userPhone).trim() !== '') ? String(body.userPhone).trim() : null;
  const ride = {
    id: rideId,
    pickup: { lat: pickupLat, lng: pickupLng },
    drop: { lat: dropLat, lng: dropLng },
    pickupAddress,
    dropAddress,
    distanceKm,
    trafficDelayMins: Number(body.trafficDelayMins) || 0,
    vehicleType,
    userPrice,
    status: 'pending',
    bids: [],
    acceptedBidId: null,
    driverLocation: null,
    otp: null,
    userRating: Number(body.userRating) || 4.5,
    userPhotoUrl: body.userPhotoUrl || null,
    userPhone,
    driverPhone: null,
    messages: [],
    createdAt: new Date().toISOString(),
  };
  rides.set(rideId, ride);
  res.status(201).json({ rideId });
});

// Get ride + bids (user app poll)
app.get('/api/rides/:id', (req, res) => {
  const ride = rides.get(req.params.id);
  if (!ride) return res.status(404).json({ error: 'Ride not found' });
  res.json(ride);
});

// Driver: list pending ride requests (driver app poll)
app.get('/api/drivers/requests', (req, res) => {
  const list = [];
  for (const ride of rides.values()) {
    if (ride.status === 'pending') list.push(ride);
  }
  res.json({ requests: list });
});

// Driver: accept (add bid at user price)
app.post('/api/rides/:id/accept', (req, res) => {
  const ride = rides.get(req.params.id);
  if (!ride) return res.status(404).json({ error: 'Ride not found' });
  if (ride.status !== 'pending') return res.status(400).json({ error: 'Ride not open for bids' });
  const body = req.body || {};
  const driverName = String(body.driverName || '').trim() || 'Conductor';
  const carModel = String(body.carModel || '').trim() || 'Auto';
  const driverId = String(body.driverId || '').trim() || `d_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const driverPhone = (body.driverPhone != null && String(body.driverPhone).trim() !== '') ? String(body.driverPhone).trim() : null;
  const bid = {
    id: `bid_${ride.bids.length}_${Date.now()}`,
    driverId,
    driverName,
    carModel,
    price: ride.userPrice,
    rating: 4.5,
    status: null,
    driverPhone,
  };
  ride.bids.push(bid);
  res.json({ ok: true, bidId: bid.id });
});

// Driver: counter bid
app.post('/api/rides/:id/counter', (req, res) => {
  const ride = rides.get(req.params.id);
  if (!ride) return res.status(404).json({ error: 'Ride not found' });
  if (ride.status !== 'pending') return res.status(400).json({ error: 'Ride not open for bids' });
  const body = req.body || {};
  const counterPrice = Number(body.counter_price) ?? Number(body.counterPrice);
  if (!Number.isFinite(counterPrice) || counterPrice < 0) {
    return res.status(400).json({ error: 'Invalid counter_price' });
  }
  const driverName = String(body.driverName || '').trim() || 'Conductor';
  const carModel = String(body.carModel || '').trim() || 'Auto';
  const driverId = String(body.driverId || '').trim() || `d_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const driverPhone = (body.driverPhone != null && String(body.driverPhone).trim() !== '') ? String(body.driverPhone).trim() : null;
  const bid = {
    id: `bid_${ride.bids.length}_${Date.now()}`,
    driverId,
    driverName,
    carModel,
    price: counterPrice,
    rating: 4.5,
    status: null,
    driverPhone,
  };
  ride.bids.push(bid);
  res.json({ ok: true, bidId: bid.id });
});

// Driver: decline
app.post('/api/rides/:id/decline', (req, res) => {
  const ride = rides.get(req.params.id);
  if (!ride) return res.status(404).json({ error: 'Ride not found' });
  res.json({ ok: true });
});

// User: accept a driver bid (generates 4-digit OTP for ride start)
function generateOtp() {
  return String(Math.floor(1000 + Math.random() * 9000));
}
app.post('/api/rides/:id/accept-bid', (req, res) => {
  const ride = rides.get(req.params.id);
  if (!ride) return res.status(404).json({ error: 'Ride not found' });
  if (ride.status !== 'pending') return res.status(400).json({ error: 'Ride already accepted or cancelled' });
  const bidId = (req.body && req.body.bidId) || (req.body && req.body.bid_id);
  const bid = ride.bids.find(b => b.id === bidId);
  if (!bid) return res.status(400).json({ error: 'Bid not found' });
  ride.status = 'accepted';
  ride.acceptedBidId = bid.id;
  ride.otp = generateOtp();
  ride.driverPhone = bid.driverPhone || ride.driverPhone || null;
  if (!ride.messages) ride.messages = [];
  res.json({ ok: true, bid: bid, otp: ride.otp });
});

// Driver: mark arrived at pickup (user gets "driver arrived" notification)
app.post('/api/rides/:id/driver-arrived', (req, res) => {
  const ride = rides.get(req.params.id);
  if (!ride) return res.status(404).json({ error: 'Ride not found' });
  if (ride.status !== 'accepted') return res.status(400).json({ error: 'Ride not in accepted state' });
  ride.status = 'driver_arrived';
  res.json({ ok: true });
});

// Driver: enter OTP to start ride (then driver sees drop + route)
app.post('/api/rides/:id/start-ride', (req, res) => {
  const ride = rides.get(req.params.id);
  if (!ride) return res.status(404).json({ error: 'Ride not found' });
  if (ride.status !== 'driver_arrived') return res.status(400).json({ error: 'Driver must mark arrived first' });
  const otp = String((req.body && req.body.otp) || '').trim();
  if (ride.otp !== otp) return res.status(400).json({ error: 'Invalid OTP' });
  ride.status = 'ride_started';
  res.json({ ok: true });
});

// Driver: slide to complete ride (user gets thank-you + rating screen)
app.post('/api/rides/:id/complete', (req, res) => {
  const ride = rides.get(req.params.id);
  if (!ride) return res.status(404).json({ error: 'Ride not found' });
  if (ride.status !== 'ride_started') return res.status(400).json({ error: 'Ride not started' });
  ride.status = 'completed';
  res.json({ ok: true });
});

// ---------- Live tracking: driver location ----------
// Driver: send current location (call when driver has accepted and is on the way)
app.post('/api/rides/:id/driver-location', (req, res) => {
  const ride = rides.get(req.params.id);
  if (!ride) return res.status(404).json({ error: 'Ride not found' });
  const body = req.body || {};
  const lat = Number(body.lat);
  const lng = Number(body.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json({ error: 'Missing or invalid lat/lng' });
  }
  ride.driverLocation = { lat, lng, updatedAt: new Date().toISOString() };
  res.json({ ok: true });
});

// User: get driver location (poll when ride is accepted)
app.get('/api/rides/:id/driver-location', (req, res) => {
  const ride = rides.get(req.params.id);
  if (!ride) return res.status(404).json({ error: 'Ride not found' });
  if (!ride.driverLocation) return res.json({ lat: null, lng: null });
  res.json({ lat: ride.driverLocation.lat, lng: ride.driverLocation.lng });
});

// ---------- Chat (user/driver; only while ride not completed) ----------
app.post('/api/rides/:id/chat', (req, res) => {
  const ride = rides.get(req.params.id);
  if (!ride) return res.status(404).json({ error: 'Ride not found' });
  if (ride.status === 'completed') return res.status(400).json({ error: 'Chat closed after ride complete' });
  const body = req.body || {};
  const from = String(body.from || '').trim();
  const text = String(body.text || '').trim();
  if (from !== 'user' && from !== 'driver') return res.status(400).json({ error: 'from must be user or driver' });
  if (!text) return res.status(400).json({ error: 'text required' });
  if (!ride.messages) ride.messages = [];
  ride.messages.push({ from, text, at: new Date().toISOString() });
  res.json({ ok: true, messages: ride.messages });
});

// ---------- Admin: list all rides (for bookings + chat history) ----------
app.get('/api/admin/rides', (req, res) => {
  const auth = req.headers.authorization || '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  if (!token || !token.startsWith('admin_')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const list = Array.from(rides.values()).map(r => ({
    id: r.id,
    status: r.status,
    pickupAddress: r.pickupAddress,
    dropAddress: r.dropAddress,
    userPrice: r.userPrice,
    createdAt: r.createdAt,
    userPhone: r.userPhone,
    driverPhone: r.driverPhone,
    messagesCount: (r.messages && r.messages.length) || 0,
  })).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  res.json({ rides: list });
});

app.get('/api/admin/rides/:id', (req, res) => {
  const auth = req.headers.authorization || '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  if (!token || !token.startsWith('admin_')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const ride = rides.get(req.params.id);
  if (!ride) return res.status(404).json({ error: 'Ride not found' });
  res.json(ride);
});

app.use('/api/places', proxyLimiter);
app.use('/api/directions', proxyLimiter);

app.get('/api/places/autocomplete', async (req, res) => {
  const input = (req.query.input || '').trim();
  if (!input) {
    return res.status(400).json({ error: 'Missing required parameter: input' });
  }
  try {
    const params = new URLSearchParams({ key: Maps_API_KEY, ...req.query });
    const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?${params}`;
    const data = await get(url);
    if (data && data.error === 'Invalid JSON from Google') {
      return res.status(502).json(data);
    }
    return res.status(200).json(data);
  } catch (err) {
    res.status(502).json({ error: 'Google Places autocomplete request failed', message: err.message });
  }
});

app.get('/api/places/details', async (req, res) => {
  const placeId = (req.query.place_id || '').trim();
  if (!placeId) {
    return res.status(400).json({ error: 'Missing required parameter: place_id' });
  }
  try {
    const params = new URLSearchParams({ key: Maps_API_KEY, ...req.query });
    const url = `https://maps.googleapis.com/maps/api/place/details/json?${params}`;
    const data = await get(url);
    if (data && data.error === 'Invalid JSON from Google') {
      return res.status(502).json(data);
    }
    return res.status(200).json(data);
  } catch (err) {
    res.status(502).json({ error: 'Google Places details request failed', message: err.message });
  }
});

app.get('/api/directions', async (req, res) => {
  const origin = (req.query.origin || '').trim();
  const destination = (req.query.destination || '').trim();
  if (!origin || !destination) {
    return res.status(400).json({
      error: 'Missing required parameter(s)',
      required: ['origin', 'destination'],
    });
  }
  try {
    const params = new URLSearchParams({
      key: Maps_API_KEY,
      origin,
      destination,
      mode: 'driving',
      ...req.query
    });
    const url = `https://maps.googleapis.com/maps/api/directions/json?${params}`;
    const data = await get(url);
    if (data && data.error === 'Invalid JSON from Google') {
      return res.status(502).json(data);
    }
    return res.status(200).json(data);
  } catch (err) {
    res.status(502).json({ error: 'Google Directions request failed', message: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
