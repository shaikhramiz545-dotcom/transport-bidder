/**
 * Environment Variable Validator
 * 
 * Validates required environment variables and fails fast in production
 * if critical variables are missing.
 */
const envalid = require('envalid');
const { str, port, url, cleanEnv } = envalid;

function validateEnvironment() {
  // Trim all environment variables
  Object.keys(process.env).forEach(key => {
    if (typeof process.env[key] === 'string') {
      process.env[key] = process.env[key].trim();
    }
  });

  try {
    const env = cleanEnv(process.env, {
      PORT: port({ default: 4000, desc: 'Port to listen on' }),
      // DATABASE_URL is optional if PG_HOST etc are provided
      DATABASE_URL: url({ default: '', desc: 'PostgreSQL connection URL' }),
      JWT_SECRET: str({ 
        desc: 'JWT signing secret',
        default: 'tbidder-dev-secret-change-in-production',
      }),
      GOOGLE_MAPS_API_KEY: str({ 
        desc: 'Google Maps API Key',
        default: '' 
      }),
      DLOCAL_API_KEY: str({ desc: 'dLocal API Key', default: '' }),
      DLOCAL_SECRET_KEY: str({ desc: 'dLocal Secret Key', default: '' }),
      NODE_ENV: str({ choices: ['development', 'test', 'production', 'provision'], default: 'development' }),
      ALLOWED_ORIGINS: str({ default: 'http://localhost:3000,https://tbidder-admin.web.app', desc: 'Comma separated allowed origins' }),
    }, {
      reporter: ({ errors, env }) => {
        if (Object.keys(errors).length > 0) {
          console.error('\n❌ Invalid environment variables:');
          for (const [key, err] of Object.entries(errors)) {
             console.error(`    ${key}: ${err.message}`);
          }
          console.error('\n🚫 Server startup aborted due to configuration errors.\n');
          process.exit(1);
        }
      }
    });

    return env;
  } catch (err) {
    console.error('Environment validation failed:', err.message);
    process.exit(1);
  }
}

module.exports = validateEnvironment;
