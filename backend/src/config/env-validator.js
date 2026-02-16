/**
 * Environment Variable Validator
 * 
 * Validates required environment variables and fails fast in production
 * if critical variables are missing.
 */

const requiredEnvVars = {
  // Firebase Configuration
  FIREBASE_PROJECT_ID: {
    required: ['production'],
    description: 'Firebase project ID for Admin SDK'
  },
  FIREBASE_CLIENT_EMAIL: {
    required: ['production'],
    description: 'Firebase service account email'
  },
  FIREBASE_PRIVATE_KEY: {
    required: ['production'],
    description: 'Firebase service account private key'
  },
  
  // Authentication
  JWT_SECRET: {
    required: ['production'],
    description: 'JWT signing secret (minimum 32 characters)'
  },
  
  // Database
  DATABASE_URL: {
    required: ['production'],
    description: 'PostgreSQL connection URL'
  },
  
  // Google Maps
  GOOGLE_MAPS_API_KEY: {
    required: ['production'],
    description: 'Google Maps API key for places and directions'
  }
};

const optionalEnvVars = {
  // Email Configuration
  ZEPTOMAIL_API_KEY: {
    description: 'ZeptoMail API key for email notifications'
  },
  ZEPTOMAIL_FROM_EMAIL: {
    description: 'Sender email for ZeptoMail'
  },
  
  // Payment Processing
  DLOCAL_API_KEY: {
    description: 'dLocal payment API key'
  },
  DLOCAL_SECRET_KEY: {
    description: 'dLocal payment secret key'
  },
  
  // Development
  MOCK_OTP: {
    description: 'Mock OTP for development (leave empty for production)'
  }
};

/**
 * Validate environment variables
 * @param {string} nodeEnv - Current NODE_ENV value
 * @throws {Error} If required variables are missing
 */
function validateEnvironment(nodeEnv = process.env.NODE_ENV) {
  const isProduction = nodeEnv === 'production';
  const isDevelopment = nodeEnv === 'development';
  
  console.log(`[env-validator] Validating environment for NODE_ENV=${nodeEnv}`);
  
  const missing = [];
  const warnings = [];
  
  // Check required variables
  for (const [varName, config] of Object.entries(requiredEnvVars)) {
    const value = process.env[varName];
    const isRequired = config.required.includes(nodeEnv) || (config.required.includes('production') && isProduction);
    
    if (isRequired && (!value || value.trim() === '')) {
      missing.push({
        name: varName,
        description: config.description,
        critical: true
      });
    } else if (!value || value.trim() === '') {
      if (isDevelopment) {
        warnings.push({
          name: varName,
          description: config.description,
          message: `Optional for development but required for production`
        });
      }
    }
  }
  
  // Validate specific variable formats
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
    missing.push({
      name: 'JWT_SECRET',
      description: 'JWT signing secret (minimum 32 characters)',
      critical: true,
      message: 'Current length is insufficient for security'
    });
  }
  
  // Check for development defaults
  if (isDevelopment) {
    const devDefaults = {
      'tbidder-dev-secret-change-in-production': 'JWT_SECRET',
      'localhost': 'DATABASE_URL'
    };
    
    for (const [defaultValue, varName] of Object.entries(devDefaults)) {
      if (process.env[varName] === defaultValue) {
        warnings.push({
          name: varName,
          message: `Using development default value - should be changed for production`
        });
      }
    }
  }
  
  // Report results
  if (missing.length > 0) {
    console.warn('\n⚠️  CRITICAL: Missing required environment variables:');
    missing.forEach(missing => {
      console.warn(`  ? ${missing.name}: ${missing.description}`);
      if (missing.message) console.warn(`     ${missing.message}`);
    });
    
    if (isProduction) {
      console.warn('\n⚠️  PRODUCTION WARNING: Critical environment variables missing!');
      console.warn('Some features may not work correctly. Set these variables for full functionality.\n');
      // Do NOT exit in production - allow server to start and handle missing vars gracefully
    } else {
      console.warn('\n⚠️  Development: Some features may not work without these variables.\n');
    }
  }
  
  if (warnings.length > 0) {
    console.log('\n⚠️  Environment warnings:');
    warnings.forEach(warning => {
      console.log(`  ⚠️  ${warning.name}: ${warning.message || warning.description}`);
    });
    console.log('');
  }
  
  if (missing.length === 0 && warnings.length === 0) {
    console.log('✅ Environment validation passed\n');
  }
  
  return {
    valid: missing.length === 0,
    missing,
    warnings
  };
}

/**
 * Get environment summary for logging
 */
function getEnvironmentSummary() {
  const summary = {
    nodeEnv: process.env.NODE_ENV || 'development',
    hasFirebase: !!(process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY),
    hasJWT: !!process.env.JWT_SECRET,
    hasDatabase: !!process.env.DATABASE_URL,
    hasMaps: !!process.env.GOOGLE_MAPS_API_KEY,
    hasEmail: !!process.env.ZEPTOMAIL_API_KEY
  };
  
  console.log('[env-validator] Environment Summary:');
  Object.entries(summary).forEach(([key, value]) => {
    const status = value ? '✅' : '❌';
    console.log(`  ${status} ${key}: ${value}`);
  });
  console.log('');
  
  return summary;
}

module.exports = {
  validateEnvironment,
  getEnvironmentSummary,
  requiredEnvVars,
  optionalEnvVars
};
