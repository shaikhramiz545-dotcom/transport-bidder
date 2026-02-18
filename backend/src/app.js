const express = require('express');
const path = require('path');
const cors = require('cors');
const trafficCounter = require('./utils/traffic-counter');
const apiMetrics = require('./utils/api-metrics');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// Middleware Imports
const logger = require('./middleware/logger');
const responseWrapper = require('./middleware/response-wrapper');
const errorHandler = require('./middleware/error-handler');

// Route Imports
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

// Cloud Run / reverse proxies: ensure req.ip uses X-Forwarded-For.
// Without this, many users can share the same IP bucket and hit rate limits.
app.set('trust proxy', 1);

// 1. Security Middleware (Helmet & Rate Limiting)
app.use(helmet());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  // Skip rate limiting for internal health pings (loopback)
  skip: (req) => {
    const ip = req.ip || req.connection?.remoteAddress || '';
    const p = req.path || req.url?.split('?')[0] || '';
    if (p === '/' || p === '/api/health' || p === '/api/v1/health' || p === '/health') return true;
    return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
  },
  message: {
    success: false,
    error: {
      message: 'Too many requests, please try again later.',
      code: 'RATE_LIMIT_EXCEEDED'
    }
  }
});
app.use(limiter);

// 2. CORS Configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim()) 
  : ['https://tbidder-admin.web.app', 'http://localhost:3000'];

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      // callback(new Error('Not allowed by CORS')); // Fail safely
      callback(null, false);
    }
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-signature', 'x-dlocal-signature'],
  credentials: true,
};

app.options('*', cors(corsOptions));
app.use(cors(corsOptions));

// 3. Request Parsing
// Screenshot base64 (wallet recharge) can be large – default 100kb too small
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 4. Logging & Metrics
app.use(logger);
app.use(responseWrapper);

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

// 5. Static Files
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// 6. API Routes (Versioned)
const apiV1 = express.Router();

apiV1.use('/health', healthRoutes);
apiV1.use('/auth', authRoutes);
apiV1.use('/places', placesProxy);
apiV1.use('/directions', directionsRoutes);
apiV1.use('/drivers', driversRoutes);
apiV1.use('/rides', ridesRoutes);
apiV1.use('/admin', adminRoutes);
apiV1.use('/tours', toursRoutes);
apiV1.use('/agency', uploadRoutes); // upload first so /upload matches before /tours/:id
apiV1.use('/agency', agencyRoutes);
apiV1.use('/wallet', walletRoutes);

// Mount API v1
app.use('/api/v1', apiV1);

// Root Route
app.get('/', (_req, res) => {
  res.json({ status: 'online', message: 'Tbidder API is Live' });
});

// 404 and Error handlers are now in server.js to allow route injection

module.exports = app;
