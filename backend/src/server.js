const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const config = require('./config');
const { sequelize } = require('./config/db');

// Safe startup migration: add missing columns to existing tables (idempotent)
async function runStartupMigrations() {
  try {
    const qi = sequelize.getQueryInterface();
    const addCol = async (table, col, type) => {
      try {
        await qi.addColumn(table, col, type);
        console.log(`[Migration] Added column ${table}.${col}`);
      } catch (e) {
        if (e.original && e.original.code === '42701') return; // column already exists
        console.warn(`[Migration] ${table}.${col} skipped:`, e.message);
      }
    };
    const { DataTypes } = require('sequelize');
    // DriverDocuments: metadata columns added in model but missing from DB
    await addCol('DriverDocuments', 'issueDate', { type: DataTypes.DATEONLY, allowNull: true });
    await addCol('DriverDocuments', 'policyNumber', { type: DataTypes.STRING, allowNull: true });
    await addCol('DriverDocuments', 'insuranceCompany', { type: DataTypes.STRING, allowNull: true });
    await addCol('DriverDocuments', 'certificateNumber', { type: DataTypes.STRING, allowNull: true });
    await addCol('DriverDocuments', 'inspectionCenter', { type: DataTypes.STRING, allowNull: true });

    // DriverVerifications: vehicle + license + DNI fields added in model but missing from DB
    await addCol('DriverVerifications', 'email', { type: DataTypes.STRING, allowNull: true });
    await addCol('DriverVerifications', 'city', { type: DataTypes.STRING, allowNull: true });
    await addCol('DriverVerifications', 'dni', { type: DataTypes.STRING, allowNull: true });
    await addCol('DriverVerifications', 'phone', { type: DataTypes.STRING, allowNull: true });
    await addCol('DriverVerifications', 'license', { type: DataTypes.STRING, allowNull: true });
    await addCol('DriverVerifications', 'photoUrl', { type: DataTypes.STRING, allowNull: true });
    await addCol('DriverVerifications', 'adminNotes', { type: DataTypes.TEXT, allowNull: true });
    await addCol('DriverVerifications', 'customRatePerKm', { type: DataTypes.DOUBLE, allowNull: true });

    await addCol('DriverVerifications', 'vehicleBrand', { type: DataTypes.STRING, allowNull: true });
    await addCol('DriverVerifications', 'vehicleModel', { type: DataTypes.STRING, allowNull: true });
    await addCol('DriverVerifications', 'vehicleColor', { type: DataTypes.STRING, allowNull: true });
    await addCol('DriverVerifications', 'registrationYear', { type: DataTypes.INTEGER, allowNull: true });
    await addCol('DriverVerifications', 'vehicleCapacity', { type: DataTypes.INTEGER, allowNull: true });

    await addCol('DriverVerifications', 'licenseClass', { type: DataTypes.STRING, allowNull: true });
    await addCol('DriverVerifications', 'licenseIssueDate', { type: DataTypes.DATEONLY, allowNull: true });
    await addCol('DriverVerifications', 'licenseExpiryDate', { type: DataTypes.DATEONLY, allowNull: true });

    await addCol('DriverVerifications', 'dniIssueDate', { type: DataTypes.DATEONLY, allowNull: true });
    await addCol('DriverVerifications', 'dniExpiryDate', { type: DataTypes.DATEONLY, allowNull: true });

    await addCol('DriverVerifications', 'engineNumber', { type: DataTypes.STRING, allowNull: true });
    await addCol('DriverVerifications', 'chassisNumber', { type: DataTypes.STRING, allowNull: true });

    await addCol('DriverVerifications', 'registrationStartedAt', { type: DataTypes.DATE, allowNull: true });
    await addCol('DriverVerifications', 'registrationDeadline', { type: DataTypes.DATE, allowNull: true });

    await addCol('DriverVerifications', 'reuploadMessage', { type: DataTypes.TEXT, allowNull: true });
    console.log('[Migration] Startup migrations complete.');
  } catch (err) {
    console.error('[Migration] Startup migration error:', err.message);
  }
}
runStartupMigrations();

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
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
