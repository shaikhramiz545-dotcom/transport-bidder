/**
 * Rides API – User app & Driver app use this. Data stored in Firestore.
 * Wallet check (accept) and deduction (complete) use PostgreSQL DriverWallet + WalletLedger.
 */
const express = require('express');
const db = require('../db/firestore');
const { DriverWallet, WalletLedger } = require('../models');
const { authenticate, requireRole } = require('../utils/auth');
const { getMessaging } = require('../services/firebase-admin');
const {
  onlineDrivers,
  DRIVER_STALE_MS,
  rideVehicleToDriverCategory,
  normalizeDriverCategory,
  getRadiusForVehicle,
  haversineKm,
} = require('./drivers');

const router = express.Router();

// All rides endpoints require auth (user or driver)
router.use(authenticate);

async function resolveAuthDriverId(req) {
  const { DriverIdentity } = require('../models');
  const phone = req.auth?.phone ? String(req.auth.phone).trim() : '';
  if (!phone) return null;
  const row = await DriverIdentity.findOne({ where: { phone }, raw: true });
  return row?.driverId ? String(row.driverId) : null;
}

/** Estimated fare in credits (1 Sol ride = 1 credit deduction on complete). */
function estimatedFareCredits(userPrice) {
  const s = Number(userPrice);
  return Number.isNaN(s) || s < 0 ? 0 : Math.ceil(s);
}

function generateOtp() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

/** GET /api/rides – List rides (user history). Query: status, from, to, limit, userPhone */
router.get('/', requireRole('passenger'), async (req, res) => {
  try {
    const status = req.query.status || null;
    const from = req.query.from || null;
    const to = req.query.to || null;
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
    const requestedPhone = req.query.userPhone || null;
    const userPhone = req.auth?.phone || null;
    if (requestedPhone && userPhone && String(requestedPhone).trim() !== String(userPhone).trim()) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const list = await db.listRides({ status, userPhone, from, to, limit });
    return res.json({ rides: list.map((r) => ({ ...r, id: String(r.id) })) });
  } catch (err) {
    console.error('[rides] list', err.message);
    return res.status(500).json({ error: err.message });
  }
});

/** POST /api/rides – User app: create ride request. Returns 201 { rideId }. */
router.post('/', requireRole('passenger'), async (req, res) => {
  try {
    const body = req.body || {};
    const rideId = await db.createRide({
      pickupLat: body.pickupLat,
      pickupLng: body.pickupLng,
      dropLat: body.dropLat,
      dropLng: body.dropLng,
      pickupAddress: body.pickupAddress || '',
      dropAddress: body.dropAddress || '',
      distanceKm: body.distanceKm ?? 0,
      trafficDelayMins: body.trafficDelayMins ?? 0,
      vehicleType: body.vehicleType || 'car',
      userPrice: body.userPrice ?? 0,
      userPhone: req.auth?.phone || null,
      userRating: body.userRating ?? null,
      userPhotoUrl: body.userPhotoUrl || null,
      // Outstation fields
      outstationPassengers: body.outstationPassengers ?? null,
      outstationComments: body.outstationComments || null,
      outstationIsParcel: body.outstationIsParcel ?? false,
      // Delivery fields
      deliveryComments: body.deliveryComments || null,
      deliveryWeight: body.deliveryWeight || null,
      deliveryPhotoUrl: body.deliveryPhotoUrl || null,
    });

    // Push notification to matching drivers only (vehicle type + radius filter).
    // Best-effort, async. If Firebase Admin not configured, silently skip.
    try {
      const messaging = getMessaging();
      if (messaging) {
        const allTokens = await db.listDriverFcmTokens({ limit: 500 });
        const vt = (body.vehicleType || 'car').toString();
        const rideCategory = rideVehicleToDriverCategory(vt);
        const radiusKm = rideCategory ? getRadiusForVehicle(rideCategory) : 6;
        const pickupLat = body.pickupLat;
        const pickupLng = body.pickupLng;
        const now = Date.now();

        // Filter tokens: only drivers who are online, matching vehicle, within radius
        const tokenList = [];
        for (const t of allTokens) {
          if (!t.token || typeof t.token !== 'string' || !t.token.trim()) continue;
          const did = t.driverId;
          if (!did) { tokenList.push(t.token); continue; } // no driverId → send anyway (legacy)
          const info = onlineDrivers.get(did);
          if (!info || (now - info.updatedAt > DRIVER_STALE_MS)) continue; // not online
          // Vehicle type match (normalize 'car' → 'taxi' etc.)
          if (rideCategory) {
            const driverVt = normalizeDriverCategory(info.vehicleType || 'car');
            if (driverVt !== rideCategory) continue;
          }
          // Radius check
          if (typeof pickupLat === 'number' && typeof pickupLng === 'number') {
            const dist = haversineKm(info.lat, info.lng, pickupLat, pickupLng);
            if (dist > radiusKm) continue;
          }
          tokenList.push(t.token);
        }

        if (tokenList.length > 0) {
          const pickupLabel = (body.pickupAddress || 'Pickup').toString();
          const dropLabel = (body.dropAddress || 'Drop').toString();
          const price = body.userPrice != null ? String(body.userPrice) : '';
          const message = {
            notification: {
              title: 'New ride request',
              body: `${vt.toUpperCase()} • S/ ${price} • ${pickupLabel} → ${dropLabel}`,
            },
            data: {
              type: 'ride_request',
              rideId: String(rideId),
              vehicleType: vt,
            },
            tokens: tokenList,
          };
          const resp = await messaging.sendEachForMulticast(message);
          console.log(`[rides] FCM sent to ${tokenList.length} matching drivers (${rideCategory || 'any'}, ${radiusKm}km)`);
          // Clean up invalid tokens (best-effort)
          if (resp && Array.isArray(resp.responses)) {
            const invalid = [];
            resp.responses.forEach((r, idx) => {
              if (!r.success) {
                const code = r.error && r.error.code ? String(r.error.code) : '';
                if (code.includes('registration-token-not-registered') || code.includes('invalid-argument')) {
                  invalid.push(tokenList[idx]);
                }
              }
            });
            if (invalid.length) {
              console.warn('[rides] FCM invalid tokens:', invalid.length);
            }
          }
        } else {
          console.log(`[rides] FCM: no matching online drivers for ${rideCategory || 'any'} within ${radiusKm}km`);
        }
      }
    } catch (pushErr) {
      console.warn('[rides] push skipped:', pushErr.message);
    }

    return res.status(201).json({ rideId: String(rideId) });
  } catch (err) {
    // Single-active-ride: return existing ride ID so frontend can reconnect
    if (err.message && err.message.startsWith('ACTIVE_RIDE_EXISTS:')) {
      const existingRideId = err.message.split(':')[1];
      console.warn('[rides] create blocked – active ride exists:', existingRideId);
      return res.status(409).json({ error: 'ACTIVE_RIDE_EXISTS', existingRideId });
    }
    console.error('[rides] create', err.message);
    return res.status(500).json({ error: err.message });
  }
});

/** GET /api/rides/:id – Get ride (for user/driver app polling). */
router.get('/:id', async (req, res) => {
  try {
    const ride = await db.getRideById(req.params.id);
    if (!ride) return res.status(404).json({ error: 'Ride not found' });
    const phone = req.auth?.phone ? String(req.auth.phone).trim() : '';
    const role = req.auth?.role;
    if (role === 'passenger') {
      if (ride.userPhone && phone && String(ride.userPhone).trim() !== phone) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    } else if (role === 'driver') {
      if (ride.driverPhone && phone && String(ride.driverPhone).trim() !== phone) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }
    const messages = await db.getMessagesByRideId(req.params.id);
    const bids = await db.getBidsByRideId(req.params.id);
    return res.json({
      id: String(ride.id),
      status: ride.status,
      pickupAddress: ride.pickupAddress,
      dropAddress: ride.dropAddress,
      pickup: { lat: ride.pickupLat, lng: ride.pickupLng },
      drop: { lat: ride.dropLat, lng: ride.dropLng },
      distanceKm: ride.distanceKm,
      trafficDelayMins: ride.trafficDelayMins,
      vehicleType: ride.vehicleType,
      userPrice: ride.userPrice,
      counterPrice: ride.counterPrice,
      acceptedBidId: ride.acceptedBidId || null,
      driverName: ride.driverName || null,
      acceptedPrice: ride.acceptedPrice || null,
      userPhone: ride.userPhone,
      driverPhone: ride.driverPhone,
      userRating: ride.userRating,
      userPhotoUrl: ride.userPhotoUrl,
      otp: ride.otp,
      createdAt: ride.createdAt,
      // Outstation fields
      outstationPassengers: ride.outstationPassengers || null,
      outstationComments: ride.outstationComments || null,
      outstationIsParcel: ride.outstationIsParcel || false,
      // Delivery fields
      deliveryComments: ride.deliveryComments || null,
      deliveryWeight: ride.deliveryWeight || null,
      deliveryPhotoUrl: ride.deliveryPhotoUrl || null,
      messages,
      bids,
    });
  } catch (err) {
    console.error('[rides] get', err.message);
    return res.status(500).json({ error: err.message });
  }
});

/** GET /api/rides/:id/driver-location – User app: live driver position. */
router.get('/:id/driver-location', requireRole('passenger'), async (req, res) => {
  try {
    const ride = await db.getRideById(req.params.id);
    if (!ride) return res.status(404).json({ error: 'Ride not found' });
    const phone = req.auth?.phone ? String(req.auth.phone).trim() : '';
    if (ride.userPhone && phone && String(ride.userPhone).trim() !== phone) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    if (ride.driverLat == null || ride.driverLng == null) {
      return res.json({ lat: null, lng: null });
    }
    return res.json({ lat: ride.driverLat, lng: ride.driverLng });
  } catch (err) {
    console.error('[rides] driver-location', err.message);
    return res.status(500).json({ error: err.message });
  }
});

/** POST /api/rides/:id/chat – User or driver: send message. */
router.post('/:id/chat', async (req, res) => {
  try {
    const ride = await db.getRideById(req.params.id);
    if (!ride) return res.status(404).json({ error: 'Ride not found' });
    const role = req.auth?.role;
    const phone = req.auth?.phone ? String(req.auth.phone).trim() : '';
    if (role === 'passenger') {
      if (ride.userPhone && phone && String(ride.userPhone).trim() !== phone) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    } else if (role === 'driver') {
      if (ride.driverPhone && phone && String(ride.driverPhone).trim() !== phone) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }
    const from = (req.body && req.body.from) === 'driver' ? 'driver' : 'user';
    const text = (req.body && req.body.text) ? String(req.body.text).trim() : '';
    if (!text) return res.status(400).json({ error: 'text required' });
    await db.createMessage(req.params.id, from, text);
    return res.json({ ok: true });
  } catch (err) {
    console.error('[rides] chat', err.message);
    return res.status(500).json({ error: err.message });
  }
});

/** POST /api/rides/:id/bid – Driver app: place/update a bid on a pending ride (upsert per driver). */
router.post('/:id/bid', requireRole('driver'), async (req, res) => {
  try {
    const ride = await db.getRideById(req.params.id);
    if (!ride) return res.status(404).json({ error: 'Ride not found' });
    if (ride.status !== 'pending') return res.status(400).json({ error: 'Ride not pending' });
    const driverPhone = req.auth?.phone ? String(req.auth.phone).trim() : null;
    const authDriverId = await resolveAuthDriverId(req);
    const driverId = authDriverId || (req.body && req.body.driverId ? String(req.body.driverId) : null);
    const price = req.body && req.body.price != null ? Number(req.body.price) : null;
    if (price == null || price <= 0) return res.status(400).json({ error: 'price required (> 0)' });
    const driverName = (req.body && req.body.driverName) ? String(req.body.driverName).trim() : 'Driver';
    const carModel = (req.body && req.body.carModel) ? String(req.body.carModel).trim() : 'Auto';
    const rating = req.body && req.body.rating != null ? Number(req.body.rating) : 4.5;
    const bidId = await db.upsertBid(req.params.id, {
      driverId,
      driverName,
      driverPhone,
      carModel,
      rating,
      price,
    });
    return res.status(201).json({ ok: true, bidId });
  } catch (err) {
    console.error('[rides] bid', err.message);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/rides/:id/accept-bid – User app: accept driver bid (production-grade).
 * Uses transaction-safe acceptBidTransaction to prevent race conditions.
 * Atomically: checks ride status, updates ride, marks accepted bid, rejects all other bids.
 */
router.post('/:id/accept-bid', requireRole('passenger'), async (req, res) => {
  try {
    const rideId = req.params.id;
    const userPhone = req.auth?.phone ? String(req.auth.phone).trim() : '';
    const bidId = (req.body && req.body.bidId) ? String(req.body.bidId).trim() : null;
    
    if (!bidId) {
      return res.status(400).json({ error: 'bidId is required' });
    }

    // Verify user owns this ride
    const ride = await db.getRideById(rideId);
    if (!ride) return res.status(404).json({ error: 'Ride not found' });
    if (ride.userPhone && userPhone && String(ride.userPhone).trim() !== userPhone) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Execute transaction-safe bid acceptance
    // acceptBidTransaction returns { rideId, bidId, driverId, driverName, acceptedPrice, otp }
    // or throws on failure (RIDE_NOT_FOUND, RIDE_NOT_PENDING, BID_NOT_FOUND, BID_NOT_ACCEPTABLE)
    const result = await db.acceptBidTransaction(rideId, bidId, {});

    return res.json({
      ok: true,
      otp: result.otp,
      driverName: result.driverName,
      acceptedPrice: result.acceptedPrice,
    });
  } catch (err) {
    console.error('[rides] accept-bid', err.message);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/rides/:id/user-counter – User app: counter a specific driver's bid with a new price.
 * Uses BID_STATUS constants for state machine compliance.
 */
router.post('/:id/user-counter', requireRole('passenger'), async (req, res) => {
  try {
    const ride = await db.getRideById(req.params.id);
    if (!ride) return res.status(404).json({ error: 'Ride not found' });
    if (ride.status !== db.RIDE_STATUS.PENDING) return res.status(400).json({ error: 'Ride not pending' });
    const userPhone = req.auth?.phone ? String(req.auth.phone).trim() : '';
    if (ride.userPhone && userPhone && String(ride.userPhone).trim() !== userPhone) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const bidId = (req.body && req.body.bidId) ? String(req.body.bidId).trim() : null;
    const counterPrice = req.body && req.body.counterPrice != null ? Number(req.body.counterPrice) : null;
    if (!bidId) return res.status(400).json({ error: 'bidId required' });
    if (counterPrice == null || counterPrice <= 0) return res.status(400).json({ error: 'counterPrice required (> 0)' });
    
    // Update bid with state validation
    await db.updateBidById(bidId, { 
      status: db.BID_STATUS.COUNTERED, 
      userCounterPrice: counterPrice 
    });
    return res.json({ ok: true });
  } catch (err) {
    console.error('[rides] user-counter', err.message);
    return res.status(500).json({ error: err.message });
  }
});

/** POST /api/rides/:id/accept – Driver app: driver accepts ride. Block if low/no credit or expired. */
router.post('/:id/accept', requireRole('driver'), async (req, res) => {
  try {
    const fdb = db.getDb();
    const rideRef = fdb.collection(db.COL.rides).doc(req.params.id);
    const authPhone = req.auth?.phone ? String(req.auth.phone).trim() : '';
    const authDriverId = await resolveAuthDriverId(req);

    await fdb.runTransaction(async (transaction) => {
      const doc = await transaction.get(rideRef);
      if (!doc.exists) throw new Error('NOT_FOUND');

      const ride = doc.data();
      if (ride.status !== 'pending') throw new Error('ALREADY_ACCEPTED');

      const requestedDriverId = (req.body && req.body.driverId) ? String(req.body.driverId) : null;
      const driverId = authDriverId || requestedDriverId;
      if (authDriverId && requestedDriverId && requestedDriverId !== authDriverId) throw new Error('FORBIDDEN');
      if (driverId) {
        const requiredCredits = estimatedFareCredits(ride.userPrice);
        const [wallet] = await DriverWallet.findOrCreate({
          where: { driverId },
          defaults: { driverId, balance: 0 },
        });
        const today = new Date().toISOString().slice(0, 10);
        const validUntil = wallet.creditsValidUntil ? String(wallet.creditsValidUntil).slice(0, 10) : null;
        const isExpired = validUntil ? validUntil < today : false;
        const balance = isExpired ? 0 : (wallet.balance || 0);

        if (isExpired) throw new Error('EXPIRED');
        if (balance < requiredCredits) throw new Error('INSUFFICIENT_CREDITS');
      }

      const otp = ride.otp || generateOtp();

      transaction.update(rideRef, {
        status: 'accepted',
        driverId: driverId || ride.driverId,
        driverPhone: authPhone || ride.driverPhone,
        otp,
        updatedAt: new Date(),
      });
    });

    return res.json({ ok: true });
  } catch (err) {
    if (err.message === 'NOT_FOUND') return res.status(404).json({ error: 'Ride not found' });
    if (err.message === 'ALREADY_ACCEPTED') return res.status(400).json({ error: 'Ride already accepted or declined' });
    if (err.message === 'FORBIDDEN') return res.status(403).json({ error: 'Forbidden' });
    if (err.message === 'EXPIRED') {
      return res.status(403).json({
        error: 'Credits expired',
        code: 'EXPIRED',
        message: 'Your credits have expired. Recharge in Wallet to accept rides.',
      });
    }
    if (err.message === 'INSUFFICIENT_CREDITS') {
      return res.status(403).json({
        error: 'Insufficient credits',
        code: 'LOW_CREDIT',
        message: 'Insufficient credits. Recharge in Wallet.',
      });
    }

    console.error('[rides] accept', err.message);
    return res.status(500).json({ error: err.message });
  }
});

/** POST /api/rides/:id/counter – Driver app: counter/update bid. Uses upsert so same driver updates their bid. */
router.post('/:id/counter', requireRole('driver'), async (req, res) => {
  try {
    const ride = await db.getRideById(req.params.id);
    if (!ride) return res.status(404).json({ error: 'Ride not found' });
    if (ride.status !== 'pending') return res.status(400).json({ error: 'Ride not pending' });
    const counterPrice = req.body && req.body.counter_price != null ? Number(req.body.counter_price) : null;
    const driverPhone = req.auth?.phone ? String(req.auth.phone).trim() : null;
    const authDriverId = await resolveAuthDriverId(req);
    const driverId = authDriverId || (req.body && req.body.driverId ? String(req.body.driverId) : null);
    // Upsert bid entry (updates existing bid if driver already bid on this ride)
    if (counterPrice != null && counterPrice > 0) {
      const driverName = (req.body && req.body.driverName) ? String(req.body.driverName).trim() : (driverPhone || 'Driver');
      const carModel = (req.body && req.body.carModel) ? String(req.body.carModel).trim() : 'Auto';
      await db.upsertBid(req.params.id, {
        driverId,
        driverName,
        driverPhone,
        carModel,
        rating: 4.5,
        price: counterPrice,
      });
    }
    return res.json({ ok: true });
  } catch (err) {
    console.error('[rides] counter', err.message);
    return res.status(500).json({ error: err.message });
  }
});

/** POST /api/rides/:id/cancel – User app: cancel a pending/accepted ride.
 * Expires the ride and all associated bids atomically. Only the ride owner can cancel. */
router.post('/:id/cancel', requireRole('passenger'), async (req, res) => {
  try {
    const rideId = req.params.id;
    const userPhone = req.auth?.phone ? String(req.auth.phone).trim() : '';
    const ride = await db.getRideById(rideId);
    if (!ride) return res.status(404).json({ error: 'Ride not found' });
    if (ride.userPhone && userPhone && String(ride.userPhone).trim() !== userPhone) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const cancellableStatuses = ['pending', 'accepted'];
    if (!cancellableStatuses.includes(ride.status)) {
      return res.status(400).json({ error: `Cannot cancel ride in ${ride.status} status` });
    }
    if (ride.status === 'pending') {
      await db.expireRideAndBids(rideId);
    } else {
      await db.updateRide(rideId, { status: 'cancelled' });
    }
    return res.json({ ok: true });
  } catch (err) {
    console.error('[rides] cancel', err.message);
    return res.status(500).json({ error: err.message });
  }
});

/** POST /api/rides/:id/decline – Driver app: decline ride. Does NOT cancel the ride for other drivers. */
router.post('/:id/decline', requireRole('driver'), async (req, res) => {
  try {
    const ride = await db.getRideById(req.params.id);
    if (!ride) return res.status(404).json({ error: 'Ride not found' });
    if (ride.status !== 'pending') return res.status(400).json({ error: 'Ride not pending' });
    // Record the decline as a bid with price 0 (for analytics) but do NOT change ride status.
    // The ride stays 'pending' so other drivers can still see and accept it.
    const driverPhone = req.auth?.phone ? String(req.auth.phone).trim() : null;
    const authDriverId = await resolveAuthDriverId(req);
    const driverId = authDriverId || (req.body && req.body.driverId ? String(req.body.driverId) : null);
    try {
      await db.createBid(req.params.id, {
        driverId,
        driverName: 'Driver',
        driverPhone,
        carModel: '',
        rating: 0,
        price: 0, // price=0 signals a decline
      });
    } catch (_) { /* best-effort */ }
    return res.json({ ok: true });
  } catch (err) {
    console.error('[rides] decline', err.message);
    return res.status(500).json({ error: err.message });
  }
});

/** POST /api/rides/:id/driver-arrived – Driver app. Only when status = accepted. */
router.post('/:id/driver-arrived', requireRole('driver'), async (req, res) => {
  try {
    const ride = await db.getRideById(req.params.id);
    if (!ride) return res.status(404).json({ error: 'Ride not found' });
    if (ride.status !== 'accepted') return res.status(400).json({ error: 'Ride must be accepted first. Current status: ' + ride.status });
    const phone = req.auth?.phone ? String(req.auth.phone).trim() : '';
    if (ride.driverPhone && phone && String(ride.driverPhone).trim() !== phone) return res.status(403).json({ error: 'Forbidden' });
    await db.updateRide(req.params.id, { status: 'driver_arrived' });
    return res.json({ ok: true });
  } catch (err) {
    console.error('[rides] driver-arrived', err.message);
    return res.status(500).json({ error: err.message });
  }
});

/** POST /api/rides/:id/start-ride – Driver app. Only when status = driver_arrived. */
router.post('/:id/start-ride', requireRole('driver'), async (req, res) => {
  try {
    const ride = await db.getRideById(req.params.id);
    if (!ride) return res.status(404).json({ error: 'Ride not found' });
    if (ride.status !== 'driver_arrived') {
      return res.status(400).json({ error: 'Driver must mark arrived first. Current status: ' + ride.status });
    }
    const phone = req.auth?.phone ? String(req.auth.phone).trim() : '';
    if (ride.driverPhone && phone && String(ride.driverPhone).trim() !== phone) return res.status(403).json({ error: 'Forbidden' });

    const inputOtp = (req.body && req.body.otp) ? String(req.body.otp) : null;
    if (ride.otp && inputOtp !== String(ride.otp)) {
      return res.status(400).json({ error: 'Invalid OTP' });
    }

    await db.updateRide(req.params.id, { status: 'ride_started' });
    return res.json({ ok: true });
  } catch (err) {
    console.error('[rides] start-ride', err.message);
    return res.status(500).json({ error: err.message });
  }
});

/** POST /api/rides/:id/complete – Driver app. Only when status = ride_started.
 * Deducts credits from driver wallet (PG) and writes WalletLedger. 1 Credit = 1 Sol of ride value. */
router.post('/:id/complete', requireRole('driver'), async (req, res) => {
  try {
    const ride = await db.getRideById(req.params.id);
    if (!ride) return res.status(404).json({ error: 'Ride not found' });
    if (ride.status !== 'ride_started') return res.status(400).json({ error: 'Ride must be started first. Current status: ' + ride.status });
    const phone = req.auth?.phone ? String(req.auth.phone).trim() : '';
    if (ride.driverPhone && phone && String(ride.driverPhone).trim() !== phone) return res.status(403).json({ error: 'Forbidden' });

    const driverId = ride.driverId;
    const creditsToDeduct = estimatedFareCredits(ride.userPrice);

    if (driverId && creditsToDeduct > 0) {
      const [wallet] = await DriverWallet.findOrCreate({
        where: { driverId },
        defaults: { driverId, balance: 0 },
      });
      const today = new Date().toISOString().slice(0, 10);
      const validUntil = wallet.creditsValidUntil ? String(wallet.creditsValidUntil).slice(0, 10) : null;
      const effectiveBalance = (validUntil && validUntil >= today) ? (wallet.balance || 0) : 0;
      if (effectiveBalance < creditsToDeduct) {
        return res.status(400).json({
          error: 'Insufficient wallet balance or credits expired',
          balance: effectiveBalance,
          required: creditsToDeduct,
        });
      }
      await wallet.decrement('balance', { by: creditsToDeduct });
      await WalletLedger.create({
        driverId,
        type: 'deduction',
        creditsChange: -creditsToDeduct,
        refId: String(ride.id),
      });
    }

    await db.updateRide(req.params.id, { status: 'completed' });
    return res.json({ ok: true });
  } catch (err) {
    console.error('[rides] complete', err.message);
    return res.status(500).json({ error: err.message });
  }
});

/** POST /api/rides/:id/driver-location – Driver app: update live position. */
router.post('/:id/driver-location', requireRole('driver'), async (req, res) => {
  try {
    const ride = await db.getRideById(req.params.id);
    if (!ride) return res.status(404).json({ error: 'Ride not found' });
    const phone = req.auth?.phone ? String(req.auth.phone).trim() : '';
    if (ride.driverPhone && phone && String(ride.driverPhone).trim() !== phone) return res.status(403).json({ error: 'Forbidden' });
    const lat = req.body && req.body.lat != null ? Number(req.body.lat) : null;
    const lng = req.body && req.body.lng != null ? Number(req.body.lng) : null;
    if (lat == null || lng == null) return res.status(400).json({ error: 'lat, lng required' });
    await db.updateRide(req.params.id, { driverLat: lat, driverLng: lng });
    return res.json({ ok: true });
  } catch (err) {
    console.error('[rides] driver-location post', err.message);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/drivers/:id/bids – Driver app: get all bids for a specific driver.
 * Production-grade driver-focused endpoint to replace ride polling.
 * Query params:
 *   - status: optional filter (pending|countered|accepted|rejected|expired)
 * Returns: array of bids with ride info, sorted by most recent first.
 */
router.get('/drivers/:id/bids', requireRole('driver'), async (req, res) => {
  try {
    const driverId = req.params.id;
    const authDriverId = await resolveAuthDriverId(req);
    
    // Security: driver can only fetch their own bids
    if (authDriverId && authDriverId !== driverId) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    
    const statusFilter = req.query.status || null;
    
    // Validate status filter if provided
    if (statusFilter && !Object.values(db.BID_STATUS).includes(statusFilter)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${Object.values(db.BID_STATUS).join(', ')}` });
    }
    
    // Fetch bids
    const bids = await db.getBidsByDriverId(driverId, { status: statusFilter });
    
    // Enrich with ride details for each bid
    const enrichedBids = await Promise.all(
      bids.map(async (bid) => {
        try {
          const ride = await db.getRideById(bid.rideId);
          return {
            ...bid,
            ride: ride ? {
              id: bid.rideId,
              pickupAddress: ride.pickupAddress,
              dropAddress: ride.dropAddress,
              userPrice: ride.userPrice,
              status: ride.status,
              distanceKm: ride.distanceKm,
              vehicleType: ride.vehicleType,
              createdAt: ride.createdAt,
            } : null,
          };
        } catch {
          return { ...bid, ride: null };
        }
      })
    );
    
    return res.json({ bids: enrichedBids });
  } catch (err) {
    console.error('[drivers] get bids', err.message);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
