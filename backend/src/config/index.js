// Only load .env file in development — Cloud Run injects env vars at runtime
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

// Import environment validator
const validateEnvironment = require('./env-validator');

const env = process.env.NODE_ENV || 'development';

// Validate environment variables and fail fast in production
validateEnvironment();

const jwtSecret = process.env.JWT_SECRET;

if (!jwtSecret || jwtSecret.trim().length < 32) {
  console.error('FATAL: JWT_SECRET must be set and at least 32 characters long');
  process.exit(1);
}

// Parse DATABASE_URL if provided (Railway, Heroku, Render, etc.)
// Format: postgresql://user:password@host:port/database
const databaseUrl = process.env.DATABASE_URL;
let pgConfig;

if (databaseUrl) {
  try {
    const url = new URL(databaseUrl);
    pgConfig = {
      host: url.hostname,
      port: parseInt(url.port, 10) || 5432,
      database: url.pathname.slice(1), // Remove leading /
      user: url.username,
      password: url.password,
      ssl: true, // Always use SSL for cloud databases
    };
    console.log('[Config] Using DATABASE_URL for PostgreSQL connection');
  } catch (err) {
    console.error('[Config] Invalid DATABASE_URL format:', err.message);
    process.exit(1);
  }
} else {
  // Local dev: default to localhost, no SSL. Set PG_HOST + PG_SSL=true only for cloud (e.g. RDS).
  const pgHost = process.env.PG_HOST || 'localhost';
  const isLocalDb = pgHost === 'localhost' || pgHost === '127.0.0.1';
  const pgSslEnv = process.env.PG_SSL;
  const pgSsl = pgSslEnv === 'true' || pgSslEnv === '1' || (!isLocalDb && pgSslEnv !== 'false');

  pgConfig = {
    host: pgHost,
    port: parseInt(process.env.PG_PORT, 10) || 5432,
    database: process.env.PG_DATABASE || 'tbidder',
    user: process.env.PG_USER || 'postgres',
    password: process.env.PG_PASSWORD != null ? String(process.env.PG_PASSWORD) : '',
    ssl: pgSsl,
  };
}

module.exports = {
  env,
  port: parseInt(process.env.PORT, 10) || 4000,
  // Firebase Admin: set FIREBASE_SERVICE_ACCOUNT_PATH or GOOGLE_APPLICATION_CREDENTIALS to service account JSON path for password reset.
  firebaseServiceAccountPath: process.env.FIREBASE_SERVICE_ACCOUNT_PATH || process.env.GOOGLE_APPLICATION_CREDENTIALS,
  pg: pgConfig,
  jwtSecret,
  mockOtp: process.env.MOCK_OTP || null, // Set to null for live OTP; set MOCK_OTP env var only for local dev testing
};
