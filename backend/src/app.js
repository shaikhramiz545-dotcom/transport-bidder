const express = require('express');
const path = require('path');
const cors = require('cors');
const trafficCounter = require('./utils/traffic-counter');
const apiMetrics = require('./utils/api-metrics');
const healthRoutes = require('./routes/health');
const authRoutes = require('./routes/auth.routes');
const placesProxy = require('./routes/places.proxy');
const directionsRoutes = require('./routes/directions');
const driversRoutes = require('./routes/drivers');
const ridesRoutes = require('./routes/rides');
const adminRoutes = require('./routes/admin.routes');
const toursRoutes = require('./routes/tours');
const agencyRoutes = require('./routes/agency.routes');
const uploadRoutes = require('./routes/upload.routes');
const walletRoutes = require('./routes/wallet.routes');

const app = express();

const corsOptions = {
  origin: ['https://tbidder-admin.web.app', 'http://localhost:3000'],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
};

app.options('*', cors(corsOptions));
app.use(cors(corsOptions));
// Screenshot base64 (wallet recharge) can be large – default 100kb too small
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use((req, res, next) => {
  const p = req.path || req.url.split('?')[0];
  if (p.startsWith('/api/') || p.startsWith('/uploads')) trafficCounter.record(p);
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const isError = res.statusCode >= 500;
    if (p.startsWith('/api/') || p.startsWith('/uploads')) apiMetrics.record(duration, isError);
  });
  next();
});

app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

app.use('/health', healthRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/places', placesProxy);
app.use('/api/directions', directionsRoutes);
app.use('/api/drivers', driversRoutes);
app.use('/api/rides', ridesRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/tours', toursRoutes);
app.use('/api/agency', uploadRoutes); // upload first so /upload matches before /tours/:id
app.use('/api/agency', agencyRoutes);
app.use('/api/wallet', walletRoutes);

app.get('/', (_req, res) => {
  res.json({ status: 'online', message: 'Tbidder API is Live' });
});

// 404 for unknown API routes
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not found', path: req.path });
});

// Central error handler: unhandled rejections in route handlers should be caught by each route;
// this catches any thrown errors from middleware and sends consistent JSON
app.use((err, req, res, next) => {
  console.error('[app] error', err.message || err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: 'Internal server error', message: err.message || 'Something went wrong' });
});

module.exports = app;
