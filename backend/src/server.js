const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const config = require('./config');
const errorHandler = require('./middleware/error-handler');
const { db: firestoreDb } = require('./config/firebase');
const { sequelize } = require('./config/db');

// Auto-run pending SQL migrations on startup using DATABASE_URL already set in the environment.
// This ensures schema changes (like migration 028) apply automatically on every EB deploy.
(async () => {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.log('[startup-migrate] DATABASE_URL not set — skipping migrations.');
    return;
  }
  try {
    const path = require('path');
    const fs   = require('fs');
    const { Pool } = require('pg');
    const pool = new Pool({
      connectionString: dbUrl,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 8000,
    });
    await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY, name TEXT UNIQUE NOT NULL, run_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
    const migrationsDir = path.join(__dirname, '..', 'migrations');
    if (!fs.existsSync(migrationsDir)) { await pool.end(); return; }
    const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
    for (const file of files) {
      const { rows } = await pool.query('SELECT 1 FROM schema_migrations WHERE name=$1', [file]);
      if (rows.length > 0) continue;
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log('[startup-migrate] Ran:', file);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error('[startup-migrate] Failed (non-fatal):', file, err.message);
      } finally { client.release(); }
    }
    console.log('[startup-migrate] Done.');
    await pool.end();
  } catch (err) {
    console.error('[startup-migrate] Error (non-fatal, server continues):', err.message);
  }
})();

// Auto-create Sequelize-managed tables (AppUsers, EmailOtps, etc.) if they
// don't exist yet. `alter: false` avoids mutating existing columns; it only
// creates tables that are missing.
(async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ PostgreSQL connected');
    // Import models so their definitions are registered before sync
    require('./models');
    await sequelize.sync({ alter: false });
    console.log('✅ Sequelize tables synced');
  } catch (err) {
    console.error('⚠️ PostgreSQL sync failed (auth endpoints may not work):', err.message);
  }
})();

const server = http.createServer(app);

const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'https://t-bidder.netlify.app,https://admin.transportbidder.com,https://tbidder-admin.web.app')
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
  res.status(404).json({ success: false, message: 'Not found', error: 'Not found', path: req.path });
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
