require('dotenv').config();

// Local dev: default to localhost, no SSL. Set PG_HOST + PG_SSL=true only for cloud (e.g. RDS).
const pgHost = process.env.PG_HOST || 'localhost';
const isLocalDb = pgHost === 'localhost' || pgHost === '127.0.0.1';
const pgSslEnv = process.env.PG_SSL;
const pgSsl = pgSslEnv === 'true' || pgSslEnv === '1' || (!isLocalDb && pgSslEnv !== 'false');

const env = process.env.NODE_ENV || 'development';
const jwtSecret = process.env.JWT_SECRET;

if (env === 'production' && !jwtSecret) {
  console.error('FATAL: JWT_SECRET must be set in production!');
  process.exit(1);
}

module.exports = {
  env,
  port: parseInt(process.env.PORT, 10) || 4000,
  // Firebase Admin: set FIREBASE_SERVICE_ACCOUNT_PATH or GOOGLE_APPLICATION_CREDENTIALS to service account JSON path for password reset.
  firebaseServiceAccountPath: process.env.FIREBASE_SERVICE_ACCOUNT_PATH || process.env.GOOGLE_APPLICATION_CREDENTIALS,
  pg: {
    host: pgHost,
    port: parseInt(process.env.PG_PORT, 10) || 5432,
    database: process.env.PG_DATABASE || 'tbidder',
    user: process.env.PG_USER || 'postgres',
    password: process.env.PG_PASSWORD != null ? String(process.env.PG_PASSWORD) : '',
    ssl: pgSsl,
  },
  jwtSecret: jwtSecret || 'tbidder-dev-secret-change-in-production',
  mockOtp: process.env.MOCK_OTP || null, // Set to null for live OTP; set MOCK_OTP env var only for local dev testing
};
