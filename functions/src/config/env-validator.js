/**
 * Environment Variable Validator for Firebase Functions
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
  
  // Database
  DATABASE_URL: {
    description: 'PostgreSQL connection URL (if using external DB)'
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
      'tbidder-dev-secret-change-in-production': 'JWT_SECRET'
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
    console.error('\n🚨 CRITICAL: Missing required environment variables:');
    missing.forEach(missing => {
      console.error(`  ❌ ${missing.name}: ${missing.description}`);
      if (missing.message) console.error(`     ${missing.message}`);
    });
    
    if (isProduction) {
      console.error('\n💥 PRODUCTION HALT: Critical environment variables missing!');
      console.error('Set these variables and restart the application.\n');
      throw new Error('Critical environment variables missing for production');
    } else {
      console.error('\n⚠️  Development: Some features may not work without these variables.\n');
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
