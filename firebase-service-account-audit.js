#!/usr/bin/env node

/**
 * Firebase Service Account Key Audit Tool
 * 
 * This script audits Firebase service account configuration and provides
 * recommendations for key management and security.
 */

const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(color, message) {
  console.log(`${color}${message}${colors.reset}`);
}

function logSection(title) {
  log(colors.cyan, `\n=== ${title} ===`);
}

function logSuccess(message) {
  log(colors.green, `✅ ${message}`);
}

function logWarning(message) {
  log(colors.yellow, `⚠️  ${message}`);
}

function logError(message) {
  log(colors.red, `❌ ${message}`);
}

function logInfo(message) {
  log(colors.blue, `ℹ️  ${message}`);
}

/**
 * Extract key ID from private key
 */
function extractKeyIdFromPrivateKey(privateKey) {
  if (!privateKey) return null;
  
  // Try to extract key ID from private key (this is approximate)
  // In practice, you'd need to decode the key or check with Google Cloud API
  const lines = privateKey.split('\n');
  for (const line of lines) {
    if (line.includes('PRIVATE KEY')) {
      // This is a simplified approach - actual key ID extraction requires crypto libraries
      return 'extracted-from-private-key';
    }
  }
  return null;
}

/**
 * Check environment variables for Firebase configuration
 */
function checkEnvironmentVariables() {
  logSection('Environment Variables Check');
  
  const envVars = {
    'FIREBASE_SERVICE_ACCOUNT_PATH': process.env.FIREBASE_SERVICE_ACCOUNT_PATH,
    'GOOGLE_APPLICATION_CREDENTIALS': process.env.GOOGLE_APPLICATION_CREDENTIALS,
    'FIREBASE_PRIVATE_KEY': process.env.FIREBASE_PRIVATE_KEY,
    'FIREBASE_CLIENT_EMAIL': process.env.FIREBASE_CLIENT_EMAIL,
    'FIREBASE_PROJECT_ID': process.env.FIREBASE_PROJECT_ID
  };
  
  let configMethod = null;
  let configDetails = {};
  
  for (const [key, value] of Object.entries(envVars)) {
    if (value) {
      logSuccess(`${key}: ${key.includes('KEY') || key.includes('PATH') ? '***CONFIGURED***' : value}`);
      
      if (key.includes('PATH')) {
        configMethod = 'file-based';
        configDetails.filePath = value;
      } else if (key.includes('PRIVATE_KEY')) {
        configMethod = 'environment-based';
        configDetails.privateKeyId = extractKeyIdFromPrivateKey(value);
        configDetails.clientEmail = envVars.FIREBASE_CLIENT_EMAIL;
        configDetails.projectId = envVars.FIREBASE_PROJECT_ID;
      }
    } else {
      logWarning(`${key}: Not set`);
    }
  }
  
  return { configMethod, configDetails };
}

/**
 * Check for service account JSON files
 */
function checkServiceAccountFiles() {
  logSection('Service Account Files Check');
  
  const possiblePaths = [
    'firebase-admin-key.json',
    'firebase-admin-key-functions.json',
    'service-account.json',
    'google-credentials.json',
    'firebase-credentials.json'
  ];
  
  const foundFiles = [];
  
  for (const filePath of possiblePaths) {
    if (fs.existsSync(filePath)) {
      foundFiles.push(filePath);
      logError(`Found service account file: ${filePath}`);
      
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        const serviceAccount = JSON.parse(content);
        
        logInfo(`  Project ID: ${serviceAccount.project_id || 'N/A'}`);
        logInfo(`  Client Email: ${serviceAccount.client_email || 'N/A'}`);
        logInfo(`  Key ID: ${serviceAccount.private_key_id || 'N/A'}`);
        
        // Check if this is the old compromised key
        if (serviceAccount.private_key_id === '1935375dade4b30a7c646d1aa25214b1aea6a3e2') {
          logError(`  ⚠️  OLD COMPROMISED KEY DETECTED!`);
        }
      } catch (err) {
        logError(`  Could not parse JSON: ${err.message}`);
      }
    } else {
      logSuccess(`No file found: ${filePath}`);
    }
  }
  
  return foundFiles;
}

/**
 * Check Firebase configuration in source code
 */
function checkSourceCodeConfiguration() {
  logSection('Source Code Configuration Check');
  
  const configFiles = [
    'Tbidder_Project-63a33f4b/backend/src/services/firebase-admin.js',
    'Tbidder_Project-63a33f4b/functions/src/services/firebase-admin.js',
    'Tbidder_Project-63a33f4b/backend/src/config/index.js',
    'Tbidder_Project-63a33f4b/functions/src/config/index.js'
  ];
  
  const findings = [];
  
  for (const filePath of configFiles) {
    if (fs.existsSync(filePath)) {
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        
        logInfo(`Checking: ${filePath}`);
        
        // Check for hardcoded credentials
        if (content.includes('-----BEGIN PRIVATE KEY-----')) {
          logError(`  Hardcoded private key found!`);
          findings.push({ file: filePath, issue: 'hardcoded_private_key' });
        }
        
        if (content.includes('"client_email":')) {
          logError(`  Hardcoded client email found!`);
          findings.push({ file: filePath, issue: 'hardcoded_client_email' });
        }
        
        // Check for environment variable usage
        if (content.includes('process.env.FIREBASE_')) {
          logSuccess(`  Uses environment variables`);
        }
        
        if (content.includes('FIREBASE_SERVICE_ACCOUNT_PATH')) {
          logSuccess(`  Supports file-based configuration`);
        }
        
        if (content.includes('FIREBASE_PRIVATE_KEY')) {
          logSuccess(`  Supports environment-based configuration`);
        }
        
      } catch (err) {
        logError(`  Could not read file: ${err.message}`);
      }
    } else {
      logWarning(`File not found: ${filePath}`);
    }
  }
  
  return findings;
}

/**
 * Generate security recommendations
 */
function generateRecommendations(envConfig, foundFiles, sourceFindings) {
  logSection('Security Recommendations');
  
  const recommendations = [];
  
  // Environment-based recommendations
  if (envConfig.configMethod === 'file-based') {
    logWarning('Using file-based configuration');
    recommendations.push({
      priority: 'HIGH',
      action: 'Switch to environment-based configuration',
      reason: 'More secure, no file system dependencies'
    });
    
    if (foundFiles.length > 0) {
      recommendations.push({
        priority: 'CRITICAL',
        action: 'Remove service account JSON files',
        reason: 'Files can be accidentally committed or exposed'
      });
    }
  } else if (envConfig.configMethod === 'environment-based') {
    logSuccess('Using environment-based configuration');
  } else {
    logWarning('No Firebase configuration detected');
    recommendations.push({
      priority: 'MEDIUM',
      action: 'Configure Firebase for full functionality',
      reason: 'Password reset and FCM require Firebase Admin SDK'
    });
  }
  
  // File-based security issues
  if (foundFiles.length > 0) {
    recommendations.push({
      priority: 'CRITICAL',
      action: 'Delete all service account JSON files',
      reason: 'Security risk - files can be exposed'
    });
  }
  
  // Source code security issues
  if (sourceFindings.some(f => f.issue === 'hardcoded_private_key')) {
    recommendations.push({
      priority: 'CRITICAL',
      action: 'Remove hardcoded private keys from source code',
      reason: 'Critical security vulnerability'
    });
  }
  
  if (sourceFindings.some(f => f.issue === 'hardcoded_client_email')) {
    recommendations.push({
      priority: 'HIGH',
      action: 'Remove hardcoded client emails from source code',
      reason: 'Security vulnerability'
    });
  }
  
  // Display recommendations
  recommendations.sort((a, b) => {
    const priorityOrder = { 'CRITICAL': 0, 'HIGH': 1, 'MEDIUM': 2, 'LOW': 3 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
  
  for (const rec of recommendations) {
    const color = rec.priority === 'CRITICAL' ? colors.red : 
                  rec.priority === 'HIGH' ? colors.yellow : colors.blue;
    log(color, `${rec.priority}: ${rec.action}`);
    logInfo(`  Reason: ${rec.reason}`);
  }
  
  return recommendations;
}

/**
 * Generate Firebase Console commands
 */
function generateFirebaseConsoleCommands() {
  logSection('Firebase Console Actions Required');
  
  logInfo('To complete the audit, perform these actions in Firebase Console:');
  logInfo('');
  logInfo('1. Go to Firebase Console: https://console.firebase.google.com/');
  logInfo('2. Select project: transport-bidder');
  logInfo('3. Go to Project Settings > Service Accounts');
  logInfo('4. Click "Manage Service Accounts"');
  logInfo('5. Review all active service account keys');
  logInfo('6. Delete any old/unused keys');
  logInfo('7. Generate new key if needed');
  logInfo('');
  logWarning('Look for the old compromised key ID: 1935375dade4b30a7c646d1aa25214b1aea6a3e2');
  logWarning('If found, delete it immediately!');
}

/**
 * Main audit function
 */
function runAudit() {
  log(colors.magenta, 'Firebase Service Account Key Audit');
  log(colors.magenta, '=====================================');
  
  // Check environment variables
  const envConfig = checkEnvironmentVariables();
  
  // Check for service account files
  const foundFiles = checkServiceAccountFiles();
  
  // Check source code configuration
  const sourceFindings = checkSourceCodeConfiguration();
  
  // Generate recommendations
  const recommendations = generateRecommendations(envConfig, foundFiles, sourceFindings);
  
  // Generate Firebase console commands
  generateFirebaseConsoleCommands();
  
  // Summary
  logSection('Audit Summary');
  
  if (foundFiles.length === 0 && sourceFindings.length === 0) {
    logSuccess('No security issues found in repository');
  } else {
    logWarning(`${foundFiles.length} service account files found`);
    logWarning(`${sourceFindings.length} source code issues found`);
  }
  
  if (envConfig.configMethod) {
    logInfo(`Configuration method: ${envConfig.configMethod}`);
  } else {
    logWarning('No Firebase configuration detected');
  }
  
  logInfo(`Total recommendations: ${recommendations.length}`);
  
  const criticalCount = recommendations.filter(r => r.priority === 'CRITICAL').length;
  if (criticalCount > 0) {
    logError(`${criticalCount} CRITICAL issues require immediate attention`);
  }
}

// Run the audit
if (require.main === module) {
  runAudit();
}

module.exports = {
  runAudit,
  checkEnvironmentVariables,
  checkServiceAccountFiles,
  checkSourceCodeConfiguration,
  generateRecommendations
};
