/**
 * API Keys Verification Script
 * Checks if all required API keys and configs are set and working.
 * Run: node scripts/check-api-keys.js
 * Backend must be running on port 4000 for live API tests.
 */
require('dotenv').config();
const http = require('http');

const PORT = parseInt(process.env.PORT, 10) || 4001;
const BASE_URL = process.env.API_BASE_URL || `http://localhost:${PORT}`;

function httpGet(path) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: data ? JSON.parse(data) : {} });
        } catch {
          resolve({ status: res.statusCode, data: { raw: data } });
        }
      });
    }).on('error', reject);
  });
}

async function main() {
  console.log('=== TBidder API Keys Verification ===\n');

  const checks = [];

  // 1. Env vars (presence only, no values)
  const envVars = {
    'GOOGLE_MAPS_API_KEY (ya GOOGLE_API_KEY)': !!(process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_API_KEY),
    'PG_HOST': !!process.env.PG_HOST,
    'PG_PASSWORD': !!process.env.PG_PASSWORD,
    'JWT_SECRET': !!process.env.JWT_SECRET,
    'DLOCAL_API_KEY': !!process.env.DLOCAL_API_KEY,
    'DLOCAL_SECRET_KEY': !!process.env.DLOCAL_SECRET_KEY,
  };

  console.log('--- 1. Backend .env Variables ---');
  for (const [name, set] of Object.entries(envVars)) {
    const status = set ? '\x1b[32m✓ SET\x1b[0m' : '\x1b[31m✗ MISSING\x1b[0m';
    console.log(`  ${name}: ${status}`);
    checks.push({ name, ok: set });
  }

  // 2. Live API tests (if backend running)
  console.log('\n--- 2. Live API Tests (Backend on ' + BASE_URL + ') ---');

  try {
    const health = await httpGet('/health');
    if (health.status !== 200) {
      console.log('  Health: \x1b[31m✗ Backend not responding or error\x1b[0m');
      checks.push({ name: 'Backend Health', ok: false });
    } else {
      console.log('  Health: \x1b[32m✓ OK\x1b[0m');
      checks.push({ name: 'Backend Health', ok: true });
    }
  } catch (e) {
    console.log('  Health: \x1b[33m⚠ Backend not running (start with: npm start)\x1b[0m');
    checks.push({ name: 'Backend Health', ok: false });
  }

  try {
    const places = await httpGet('/api/places/autocomplete?input=lima');
    const hasPredictions = places.data?.predictions && places.data.predictions.length > 0;
    const isOk = places.status === 200 && (hasPredictions || places.data?.status === 'OK' || places.data?.status === 'ZERO_RESULTS');
    if (isOk) {
      console.log('  Places Autocomplete: \x1b[32m✓ OK\x1b[0m (Google Maps key working)');
      checks.push({ name: 'Places API', ok: true });
    } else if (places.status === 200 && places.data?.error_message) {
      console.log('  Places Autocomplete: \x1b[31m✗ Google API error: ' + (places.data.error_message || 'Unknown') + '\x1b[0m');
      checks.push({ name: 'Places API', ok: false });
    } else {
      console.log('  Places Autocomplete: \x1b[33m⚠ Unexpected response (status ' + places.status + ')\x1b[0m');
      checks.push({ name: 'Places API', ok: false });
    }
  } catch (e) {
    console.log('  Places Autocomplete: \x1b[33m⚠ Cannot reach backend\x1b[0m');
    checks.push({ name: 'Places API', ok: false });
  }

  try {
    const dir = await httpGet('/api/directions?origin=-12.046,-77.042&destination=-12.05,-77.03');
    if (dir.status === 200 && dir.data?.routes) {
      console.log('  Directions: \x1b[32m✓ OK\x1b[0m (Google Directions key working)');
      checks.push({ name: 'Directions API', ok: true });
    } else if (dir.status === 503) {
      console.log('  Directions: \x1b[31m✗ 503 - GOOGLE_MAPS_API_KEY .env mein set karo\x1b[0m');
      checks.push({ name: 'Directions API', ok: false });
    } else if (dir.data?.error_message) {
      console.log('  Directions: \x1b[31m✗ Google error: ' + dir.data.error_message + '\x1b[0m');
      checks.push({ name: 'Directions API', ok: false });
    } else {
      console.log('  Directions: \x1b[33m⚠ Unexpected (status ' + dir.status + ')\x1b[0m');
      checks.push({ name: 'Directions API', ok: false });
    }
  } catch (e) {
    console.log('  Directions: \x1b[33m⚠ Cannot reach backend\x1b[0m');
    checks.push({ name: 'Directions API', ok: false });
  }

  // 3. Flutter apps summary
  console.log('\n--- 3. Flutter Apps (User + Driver) ---');
  console.log('  Google Maps: Hardcoded key in index.html + AndroidManifest (Maps SDK, Places)');
  console.log('  Firebase: firebase_options.dart + google-services.json (Push, Auth)');
  console.log('  Backend proxy: Places/Directions backend se aate hain.');

  // Summary
  const okCount = checks.filter((c) => c.ok).length;
  const total = checks.length;
  console.log('\n=== Summary ===');
  console.log(`  ${okCount}/${total} checks passed`);

  if (!envVars['GOOGLE_MAPS_API_KEY (ya GOOGLE_API_KEY)']) {
    console.log('\n\x1b[33m⚠ FIX: backend/.env mein add karo:\x1b[0m');
    console.log('  GOOGLE_MAPS_API_KEY=your_google_maps_key');
    console.log('  (Same key jo user_app/driver_app mein hai - Directions ke liye zaroori)');
  }

  process.exit(okCount === total ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
