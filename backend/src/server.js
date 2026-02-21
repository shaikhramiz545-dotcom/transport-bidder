const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const config = require('./config');
const errorHandler = require('./middleware/error-handler');
const { db: firestoreDb } = require('./config/firebase');
const { sequelize } = require('./config/db');

// Auto-run pending SQL migrations on startup THEN sync Sequelize tables.
// Migrations MUST complete before Sequelize sync to avoid "column does not exist" errors.
(async () => {
  // Step 1: Run pending SQL migrations
  const dbUrl = process.env.DATABASE_URL || 
    (process.env.PG_HOST && process.env.PG_DATABASE ? 
      `postgresql://${process.env.PG_USER}:${process.env.PG_PASSWORD}@${process.env.PG_HOST}:${process.env.PG_PORT || 5432}/${process.env.PG_DATABASE}` 
      : null);
  
  if (dbUrl) {
    try {
      const path = require('path');
      const fs   = require('fs');
      const { Pool } = require('pg');
      
      const poolConfig = {
        connectionString: dbUrl,
        connectionTimeoutMillis: 8000,
      };
      
      // Only require SSL if connecting to an external DB like AWS RDS (i.e., not localhost)
      if (!dbUrl.includes('localhost') && !dbUrl.includes('127.0.0.1')) {
        poolConfig.ssl = { rejectUnauthorized: false };
      }
      
      const pool = new Pool(poolConfig);
      await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY, name TEXT UNIQUE NOT NULL, run_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`);
      const migrationsDir = path.join(__dirname, '..', 'migrations');
      if (fs.existsSync(migrationsDir)) {
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
      }
      await pool.end();
    } catch (err) {
      console.error('[startup-migrate] Error (non-fatal, server continues):', err.message);
    }
  } else {
    console.log('[startup-migrate] Database credentials not set — skipping migrations.');
  }

  // Step 2: Sync Sequelize tables (runs AFTER migrations complete)
  try {
    await sequelize.authenticate();
    console.log('✅ PostgreSQL connected');
    require('./models');
    try {
      await sequelize.sync({ alter: true });
      console.log('✅ Sequelize tables synced (alter: true — all model columns guaranteed)');
    } catch (alterErr) {
      console.warn('⚠️ sync({ alter: true }) failed, falling back:', alterErr.message);
      // Fallback: create missing tables without altering existing ones
      try { await sequelize.sync({ alter: false }); } catch (_) {}
      // Then add critical missing columns via raw SQL (idempotent)
      const addCol = async (table, col, type) => {
        try { await sequelize.query(`ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "${col}" ${type}`); } catch (_) {}
      };
      await addCol('DriverVerifications', 'authUid', 'VARCHAR(255)');
      await addCol('DriverVerifications', 'email', 'VARCHAR(255)');
      await addCol('DriverVerifications', 'phone', 'VARCHAR(255)');
      await addCol('DriverVerifications', 'city', 'VARCHAR(255)');
      await addCol('DriverVerifications', 'dni', 'VARCHAR(255)');
      await addCol('DriverVerifications', 'license', 'VARCHAR(255)');
      await addCol('DriverVerifications', 'photoUrl', 'TEXT');
      await addCol('DriverVerifications', 'hasAntecedentesPoliciales', 'BOOLEAN');
      await addCol('DriverVerifications', 'hasAntecedentesPenales', 'BOOLEAN');
      await addCol('DriverVerifications', 'customRatePerKm', 'DOUBLE PRECISION');
      await addCol('DriverVerifications', 'reuploadDocumentTypes', 'JSONB');
      await addCol('DriverVerifications', 'reuploadMessage', 'TEXT');
      await addCol('DriverVerifications', 'adminNotes', 'TEXT');
      await addCol('DriverVerifications', 'vehicleBrand', 'VARCHAR(100)');
      await addCol('DriverVerifications', 'vehicleModel', 'VARCHAR(100)');
      await addCol('DriverVerifications', 'vehicleColor', 'VARCHAR(50)');
      await addCol('DriverVerifications', 'registrationYear', 'INTEGER');
      await addCol('DriverVerifications', 'vehicleCapacity', 'INTEGER');
      await addCol('DriverVerifications', 'licenseClass', 'VARCHAR(20)');
      await addCol('DriverVerifications', 'licenseIssueDate', 'DATE');
      await addCol('DriverVerifications', 'licenseExpiryDate', 'DATE');
      await addCol('DriverVerifications', 'dniIssueDate', 'DATE');
      await addCol('DriverVerifications', 'dniExpiryDate', 'DATE');
      await addCol('DriverVerifications', 'engineNumber', 'VARCHAR(50)');
      await addCol('DriverVerifications', 'chassisNumber', 'VARCHAR(50)');
      await addCol('DriverVerifications', 'registrationStartedAt', 'TIMESTAMP WITH TIME ZONE');
      await addCol('DriverVerifications', 'registrationDeadline', 'TIMESTAMP WITH TIME ZONE');
      await addCol('DriverVerifications', 'collisionRepaired', 'BOOLEAN DEFAULT false');
      await addCol('DriverVerifications', 'previousDriverId', 'VARCHAR(64)');
      await addCol('DriverDocuments', 'expiryDate', 'DATE');
      await addCol('DriverDocuments', 'issueDate', 'DATE');
      await addCol('DriverDocuments', 'policyNumber', 'VARCHAR(100)');
      await addCol('DriverDocuments', 'insuranceCompany', 'VARCHAR(100)');
      await addCol('DriverDocuments', 'certificateNumber', 'VARCHAR(100)');
      await addCol('DriverDocuments', 'inspectionCenter', 'VARCHAR(200)');
      await addCol('DriverDocuments', 'status', "VARCHAR(50) DEFAULT 'pending'");
      await addCol('DriverDocuments', 'adminFeedback', 'TEXT');
      console.log('✅ Sequelize fallback sync done — all critical columns added via raw SQL');
    }
  } catch (err) {
    console.error('⚠️ PostgreSQL sync failed (auth endpoints may not work):', err.message);
  }
})();

const server = http.createServer(app);

const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'https://t-bidder.netlify.app,https://admin.transportbidder.com,https://tbidder-admin.web.app,http://admin.transportbidder.com.s3-website.ap-south-1.amazonaws.com')
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
  console.log(`🔗 [Tbidder] Health check: /api/v1/health`);
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
const cleanupInterval = setInterval(cleanupStaleRides, CLEANUP_INTERVAL_MS);
// Run once on startup after a short delay
setTimeout(cleanupStaleRides, 10000);

// Graceful shutdown: Docker/EB sends SIGTERM before SIGKILL.
// Without this handler Node.js won't exit within the 10s window causing force-kills
// and leaving old containers blocking new deployments.
process.on('SIGTERM', () => {
  console.log('[server] SIGTERM received — shutting down gracefully...');
  clearInterval(cleanupInterval);
  server.close(() => {
    console.log('[server] HTTP server closed.');
    process.exit(0);
  });
  // Force-exit after 8s if connections don't drain in time
  setTimeout(() => {
    console.error('[server] Forced exit after 8s timeout.');
    process.exit(1);
  }, 8000).unref();
});
