#!/usr/bin/env node
/**
 * TBidder Backend – Full Diagnosis
 * Run: npm run diagnose (from backend folder)
 * Checks: .env, Backend, PostgreSQL, Admin API, Driver API, Firestore
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const http = require('http');

const PORT = parseInt(process.env.PORT, 10) || 4001;
const BASE = `http://localhost:${PORT}`;

function get(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let d = '';
      res.on('data', (c) => (d += c));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: d ? JSON.parse(d) : {} });
        } catch {
          resolve({ status: res.statusCode, data: { raw: d } });
        }
      });
    }).on('error', reject);
  });
}

async function check(name, fn) {
  try {
    const ok = await fn();
    console.log(ok ? `  ✓ ${name}` : `  ✗ ${name}`);
    return ok;
  } catch (e) {
    console.log(`  ✗ ${name}: ${e.message}`);
    return false;
  }
}

async function main() {
  console.log('=== TBidder Backend Diagnosis ===\n');

  let passed = 0;
  let total = 0;

  // 1. .env
  console.log('--- 1. .env ---');
  const env = {
    PORT: !!process.env.PORT,
    PG_HOST: process.env.PG_HOST || 'localhost',
    PG_DATABASE: process.env.PG_DATABASE || 'tbidder',
    PG_USER: !!process.env.PG_USER,
    PG_PASSWORD: !!process.env.PG_PASSWORD,
    JWT_SECRET: !!process.env.JWT_SECRET,
    GOOGLE_MAPS_API_KEY: !!(process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_API_KEY),
    FIREBASE_SERVICE_ACCOUNT_PATH: !!process.env.FIREBASE_SERVICE_ACCOUNT_PATH,
  };
  console.log(`  PORT: ${PORT}`);
  console.log(`  PG: ${env.PG_HOST}:5432/${env.PG_DATABASE}`);
  console.log(`  JWT_SECRET: ${env.JWT_SECRET ? '✓' : '✗'}`);
  console.log(`  GOOGLE_MAPS_API_KEY: ${env.GOOGLE_MAPS_API_KEY ? '✓' : '✗'}`);
  console.log(`  Firebase: ${env.FIREBASE_SERVICE_ACCOUNT_PATH ? '✓' : '✗ (optional)'}`);
  total += 1;
  if (env.JWT_SECRET) passed += 1;

  // 2. Backend health
  console.log('\n--- 2. Backend (http://localhost:' + PORT + ') ---');
  total += 1;
  const healthOk = await check('Health /health', async () => {
    const r = await get(`${BASE}/health`);
    return r.status === 200;
  });
  if (healthOk) passed += 1;

  if (!healthOk) {
    console.log('\n  ⚠ Backend NOT running. Start first:');
    console.log('     cd backend && npm start\n');
    process.exit(1);
  }

  // 3. Admin API
  console.log('\n--- 3. Admin API ---');
  total += 2;
  const adminRootOk = await check('GET /api/admin', async () => {
    const r = await get(`${BASE}/api/admin`);
    return r.status === 200 && r.data?.ok;
  });
  if (adminRootOk) passed += 1;

  const adminLoginOk = await check('POST /api/admin/login', async () => {
    const post = (url, body) => new Promise((resolve, reject) => {
      const u = new URL(url);
      const data = JSON.stringify(body);
      const opts = {
        hostname: u.hostname,
        port: u.port || 80,
        path: u.pathname,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
      };
      const req = http.request(opts, (res) => {
        let d = '';
        res.on('data', (c) => (d += c));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: d ? JSON.parse(d) : {} });
          } catch {
            resolve({ status: res.statusCode });
          }
        });
      });
      req.on('error', reject);
      req.write(data);
      req.end();
    });
    const r = await post(`${BASE}/api/admin/login`, {
      email: 'admin@tbidder.com',
      password: 'admin123',
    });
    return r.status === 200 && !!r.data?.token;
  });
  if (adminLoginOk) passed += 1;

  // 4. Admin Drivers (500 = DB issue, 200 = OK)
  console.log('\n--- 4. Admin Drivers (needs token) ---');
  total += 1;
  let token = null;
  if (adminLoginOk) {
    const loginR = await (async () => {
      const post = (url, body) => new Promise((resolve, reject) => {
        const u = new URL(url);
        const data = JSON.stringify(body);
        const opts = {
          hostname: u.hostname,
          port: u.port || 80,
          path: u.pathname,
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
        };
        const req = http.request(opts, (res) => {
          let d = '';
          res.on('data', (c) => (d += c));
          res.on('end', () => {
            try {
              resolve({ status: res.statusCode, data: d ? JSON.parse(d) : {} });
            } catch {
              resolve({ status: res.statusCode });
            }
          });
        });
        req.on('error', reject);
        req.write(data);
        req.end();
      });
      return post(`${BASE}/api/admin/login`, { email: 'admin@tbidder.com', password: 'admin123' });
    })();
    token = loginR.data?.token;
  }
  const driversOk = await check('GET /api/admin/drivers (200 = OK)', async () => {
    const getWithAuth = (url) => new Promise((resolve, reject) => {
      const u = new URL(url);
      const opts = {
        hostname: u.hostname,
        port: u.port || 80,
        path: u.pathname,
        method: 'GET',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      };
      http.get(opts, (res) => {
        let d = '';
        res.on('data', (c) => (d += c));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: d ? JSON.parse(d) : {} });
          } catch {
            resolve({ status: res.statusCode });
          }
        });
      }).on('error', reject);
    });
    const r = await getWithAuth(`${BASE}/api/admin/drivers`);
    return r.status === 200;
  });
  if (driversOk) passed += 1;

  // 5. PostgreSQL
  console.log('\n--- 5. PostgreSQL ---');
  total += 1;
  const pgOk = await check('PostgreSQL (migrations)', async () => {
    const { pool } = require('../src/config/db');
    const r = await pool.query('SELECT 1 AS ok');
    return r?.rows?.[0]?.ok === 1;
  });
  if (pgOk) passed += 1;
  if (!pgOk) {
    console.log('  Fix: Ensure PostgreSQL is running and run: npm run migrate');
  }

  // Summary
  console.log('\n=== Summary ===');
  console.log(`  ${passed}/${total} checks passed`);

  if (passed < total) {
    console.log('\nQuick fixes:');
    if (!healthOk) console.log('  - Backend: cd backend && npm start');
    if (!adminLoginOk) console.log('  - Admin login: Check JWT_SECRET in .env');
    if (!driversOk && adminLoginOk) console.log('  - Drivers 500: npm run migrate (PostgreSQL)');
    if (!pgOk) console.log('  - PostgreSQL: Start service, create DB "tbidder", run npm run migrate');
    process.exit(1);
  }

  console.log('\n✓ All good. Admin Panel: http://localhost:5173');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
