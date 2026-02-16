const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const config = require('./config');

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
  console.log(`🚀 [Tbidder] API listening on http://localhost:${config.port}`);
  console.log(`🔗 [Tbidder] Health check: http://localhost:${config.port}/health`);
});
