const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const config = require('./config');
const errorHandler = require('./middleware/error-handler');
const { db: firestoreDb } = require('./config/firebase');

// NOTE: Startup migrations have been moved to scripts/migrate.js
// Run `npm run migrate` to apply schema changes.

const server = http.createServer(app);

const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'https://tbidder-admin.web.app')
  .split(',').map(o => o.trim()).filter(Boolean);

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
  },
});

io.on('connection', (socket) => {
  console.log('[Socket] Client connected:', socket.id);

  socket.on('disconnect', (reason) => {
    console.log('[Socket] Client disconnected:', socket.id, reason);
  });
});

app.set('io', io);

// Backend DB: Firebase Firestore (auth, rides, drivers). No PostgreSQL required for core API.
const { getFirestore } = require('./services/firebase-admin');
if (getFirestore()) {
  console.log('✅ DB: Firestore connected (auth, rides, drivers, health).');
} else {
  console.warn('⚠️ Firestore not configured. Set FIREBASE_SERVICE_ACCOUNT_PATH in .env for auth/rides/drivers.');
}

// New Firestore Test Route
app.get('/test-firestore', async (req, res, next) => {
  try {
    const docRef = firestoreDb.collection('healthcheck').doc();
    await docRef.set({
      message: 'Firestore connected via env vars',
      timestamp: new Date().toISOString()
    });
    res.status(200).json({ success: true, docId: docRef.id });
  } catch (error) {
    next(error);
  }
});

// 404 Handler
app.use((req, res, next) => {
  if (res.jsonError) {
    return res.jsonError('Not found', 'NOT_FOUND', 404);
  }
  res.status(404).json({ error: 'Not found', path: req.path });
});

// Global Error Handler
app.use(errorHandler);

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${config.port} is already in use.`);
    console.error('   Fix: (1) Stop the other process using this port, or (2) Set PORT=4001 (or another free port) in .env');
  } else {
    console.error('❌ Server error:', err.message);
  }
  process.exitCode = 1;
});

server.listen(config.port, () => {
  console.log(`🚀 [Tbidder] API listening on port ${config.port}`);
  console.log(`🔗 [Tbidder] Health check: /health`);
});

// Stale ride cleanup: expire pending rides older than RIDE_EXPIRY_MINUTES every 5 minutes
const db = require('./db/firestore');
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
async function cleanupStaleRides() {
  try {
    const fdb = db.getDb();
    if (!fdb) return;
    const expiryMs = db.RIDE_EXPIRY_MINUTES * 60 * 1000;
    const cutoff = new Date(Date.now() - expiryMs);
    const snap = await fdb.collection(db.COL.rides)
      .where('status', '==', db.RIDE_STATUS.PENDING)
      .limit(100)
      .get();
    // Filter by cutoff client-side to avoid requiring a composite Firestore index
    const staleDocs = snap.docs.filter((doc) => {
      const d = doc.data();
      const createdAt = d.createdAt?.toDate?.() || d.createdAt;
      return createdAt && new Date(createdAt) < cutoff;
    }).slice(0, 20);
    if (staleDocs.length === 0) return;
    let expired = 0;
    for (const doc of staleDocs) {
      try {
        await db.expireRideAndBids(doc.id);
        expired++;
      } catch (_) {}
    }
    if (expired > 0) console.log(`[Cleanup] Expired ${expired} stale pending rides`);
  } catch (err) {
    console.warn('[Cleanup] stale ride cleanup error:', err.message);
  }
}
setInterval(cleanupStaleRides, CLEANUP_INTERVAL_MS);
// Run once on startup after a short delay
setTimeout(cleanupStaleRides, 10000);
