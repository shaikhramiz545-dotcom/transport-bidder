/**
 * purge-all-test-data.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Wipes ALL test data from every storage layer:
 *   1. PostgreSQL (AWS RDS) — all user/driver/ride/wallet/document rows
 *   2. Firestore             — all collections (users, rides, bids, wallets, etc.)
 *   3. Redis                 — all keys (driver online, JWT tokens, OTPs)
 *   4. AWS S3                — all objects in tbidder-driver-docs bucket
 *
 * DOES NOT touch: schema_migrations, AdminSettings, AdminUser, AdminRole tables.
 * DOES NOT modify any code files.
 *
 * Usage (from backend/ directory):
 *   node scripts/purge-all-test-data.js
 *
 * Requires the same .env as the backend server.
 */

'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { Pool } = require('pg');
const admin = require('firebase-admin');
const { S3Client, ListObjectsV2Command, DeleteObjectsCommand } = require('@aws-sdk/client-s3');
const Redis = require('ioredis');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function log(msg)  { console.log(`[PURGE] ${msg}`); }
function warn(msg) { console.warn(`[PURGE] ⚠️  ${msg}`); }
function ok(msg)   { console.log(`[PURGE] ✅ ${msg}`); }
function err(msg)  { console.error(`[PURGE] ❌ ${msg}`); }

// ─── 1. PostgreSQL ────────────────────────────────────────────────────────────

async function purgePostgres() {
  log('=== PostgreSQL: connecting...');

  const dbUrl = process.env.DATABASE_URL ||
    (process.env.PG_HOST
      ? `postgresql://${process.env.PG_USER}:${process.env.PG_PASSWORD}@${process.env.PG_HOST}:${process.env.PG_PORT || 5432}/${process.env.PG_DATABASE}`
      : null);

  if (!dbUrl) {
    warn('PostgreSQL: no DATABASE_URL or PG_HOST set — skipping.');
    return;
  }

  const isLocal = dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1');
  const pool = new Pool({
    connectionString: dbUrl,
    ssl: isLocal ? false : { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });

  const client = await pool.connect();
  try {
    // Tables to TRUNCATE (all test data). Preserves AdminSettings, AdminUser, AdminRole, schema_migrations.
    const tables = [
      // Auth / users
      'AppUsers',
      'EmailOtps',
      // Driver verification
      'DriverVerifications',
      'DriverDocuments',
      'DriverVerificationAudits',
      'DriverIdentities',
      // Rides & messaging
      'rides',
      'messages',
      // Wallets
      'DriverWallets',
      'WalletTransactions',
      'WalletLedgers',
      // Tours / agencies
      'TourBookings',
      'TourReviews',
      'TourSlots',
      'TourPaxOptions',
      'Tours',
      'AgencyDocuments',
      'AgencyWallets',
      'AgencyPayoutRequests',
      'TravelAgencies',
      // Legacy users table (Sequelize User model)
      'users',
    ];

    await client.query('BEGIN');
    // Disable FK checks temporarily
    await client.query('SET session_replication_role = replica');

    for (const table of tables) {
      try {
        await client.query(`TRUNCATE TABLE "${table}" RESTART IDENTITY CASCADE`);
        ok(`PostgreSQL: truncated "${table}"`);
      } catch (e) {
        // Table may not exist yet — that's fine
        warn(`PostgreSQL: skipped "${table}" (${e.message.split('\n')[0]})`);
      }
    }

    // Re-enable FK checks
    await client.query('SET session_replication_role = DEFAULT');
    await client.query('COMMIT');
    ok('PostgreSQL: all test tables cleared.');
  } catch (e) {
    await client.query('ROLLBACK');
    err(`PostgreSQL: transaction failed — ${e.message}`);
  } finally {
    client.release();
    await pool.end();
  }
}

// ─── 2. Firestore ─────────────────────────────────────────────────────────────

async function deleteFirestoreCollection(db, collectionName, batchSize = 400) {
  let deleted = 0;
  let snap;
  do {
    snap = await db.collection(collectionName).limit(batchSize).get();
    if (snap.empty) break;
    const batch = db.batch();
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    deleted += snap.docs.length;
  } while (snap.docs.length === batchSize);
  ok(`Firestore: deleted ${deleted} docs from "${collectionName}"`);
}

async function purgeFirestore() {
  log('=== Firestore: connecting...');

  const rawPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
                  process.env.GOOGLE_APPLICATION_CREDENTIALS;

  if (!rawPath) {
    warn('Firestore: FIREBASE_SERVICE_ACCOUNT_PATH not set — skipping.');
    return;
  }

  // Resolve relative paths from backend root (not scripts/)
  const backendRoot = require('path').join(__dirname, '..');
  const serviceAccountPath = rawPath.startsWith('.')
    ? require('path').resolve(backendRoot, rawPath)
    : rawPath;

  let serviceAccount;
  try {
    serviceAccount = require(serviceAccountPath);
  } catch (e) {
    warn(`Firestore: cannot read service account file at "${serviceAccountPath}" (${e.message}) — skipping.`);
    return;
  }

  // Init a dedicated Firebase app for this script (avoid conflicts)
  const appName = 'purge-script-' + Date.now();
  const firebaseApp = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  }, appName);

  const db = admin.firestore(firebaseApp);

  const collections = [
    'users',
    'user_app_emails',
    'driver_app_emails',
    'driver_fcm_tokens',
    'password_reset_otp',
    'rides',
    'bids',
    'messages',
    'driver_wallets',
    'driver_verifications',
    'wallet_transactions',
    'agency_documents',
    'tour_reviews',
    'tour_bookings',
    'tour_slots',
    'tour_pax_options',
    'tours',
    'travel_agencies',
    'agency_wallets',
    'agency_payout_requests',
    'healthcheck',
  ];

  for (const col of collections) {
    try {
      await deleteFirestoreCollection(db, col);
    } catch (e) {
      warn(`Firestore: error clearing "${col}" — ${e.message}`);
    }
  }

  // Also delete Firebase Auth users (all test accounts)
  try {
    log('Firestore: deleting Firebase Auth users...');
    const auth = admin.auth(firebaseApp);
    let pageToken;
    let totalDeleted = 0;
    do {
      const listResult = await auth.listUsers(1000, pageToken);
      if (listResult.users.length > 0) {
        const uids = listResult.users.map(u => u.uid);
        await auth.deleteUsers(uids);
        totalDeleted += uids.length;
      }
      pageToken = listResult.pageToken;
    } while (pageToken);
    ok(`Firestore: deleted ${totalDeleted} Firebase Auth users.`);
  } catch (e) {
    warn(`Firestore: Firebase Auth user deletion failed — ${e.message}`);
  }

  await firebaseApp.delete();
  ok('Firestore: all collections cleared.');
}

// ─── 3. Redis ─────────────────────────────────────────────────────────────────

async function purgeRedis() {
  log('=== Redis: connecting...');

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    warn('Redis: REDIS_URL not set — using in-memory store in production (nothing to clear remotely).');
    return;
  }

  const redis = new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    tls: redisUrl.startsWith('rediss://') ? { rejectUnauthorized: true } : undefined,
    connectTimeout: 10000,
  });

  try {
    // Flush all keys — Redis is used only for ephemeral data (online drivers, JWTs, OTPs)
    await redis.flushall();
    ok('Redis: FLUSHALL — all keys cleared (driver online status, JWT tokens, OTPs).');
  } catch (e) {
    err(`Redis: FLUSHALL failed — ${e.message}`);
    // Fallback: delete known key patterns
    try {
      const patterns = ['driver:online:*', 'drivers:online:*', 'jti:*', 'otp:*'];
      for (const pattern of patterns) {
        const keys = await redis.keys(pattern);
        if (keys.length > 0) {
          await redis.del(...keys);
          ok(`Redis: deleted ${keys.length} keys matching "${pattern}"`);
        }
      }
    } catch (e2) {
      warn(`Redis: pattern delete also failed — ${e2.message}`);
    }
  } finally {
    redis.disconnect();
  }
}

// ─── 4. AWS S3 ────────────────────────────────────────────────────────────────

async function purgeS3() {
  log('=== S3: connecting...');

  const bucket = process.env.S3_DRIVER_DOCS_BUCKET || 'tbidder-driver-docs';
  const region = process.env.AWS_REGION || 'ap-south-1';

  if (!process.env.AWS_ACCESS_KEY_ID && !process.env.AWS_SECRET_ACCESS_KEY) {
    warn('S3: AWS credentials not set — will try IAM role. If this fails, S3 files remain.');
  }

  const s3 = new S3Client({
    region,
    credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY ? {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    } : undefined,
  });

  let totalDeleted = 0;
  let continuationToken;

  try {
    do {
      const listCmd = new ListObjectsV2Command({
        Bucket: bucket,
        MaxKeys: 1000,
        ContinuationToken: continuationToken,
      });
      const listResp = await s3.send(listCmd);

      if (!listResp.Contents || listResp.Contents.length === 0) break;

      const objects = listResp.Contents.map(obj => ({ Key: obj.Key }));
      const deleteCmd = new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: { Objects: objects, Quiet: true },
      });
      await s3.send(deleteCmd);
      totalDeleted += objects.length;
      log(`S3: deleted ${objects.length} objects (total so far: ${totalDeleted})`);

      continuationToken = listResp.IsTruncated ? listResp.NextContinuationToken : undefined;
    } while (continuationToken);

    ok(`S3: deleted ${totalDeleted} objects from bucket "${bucket}".`);
  } catch (e) {
    err(`S3: failed — ${e.message}`);
    warn('S3: You may need to manually empty the bucket via AWS Console → S3 → tbidder-driver-docs → Empty.');
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n' + '═'.repeat(60));
  console.log('  TBIDDER — FULL TEST DATA PURGE');
  console.log('═'.repeat(60));
  console.log('  Targets: PostgreSQL · Firestore · Redis · S3');
  console.log('  Preserves: AdminSettings · AdminUser · AdminRole · schema_migrations');
  console.log('═'.repeat(60) + '\n');

  try { await purgePostgres(); } catch (e) { err(`PostgreSQL top-level: ${e.message}`); }
  try { await purgeFirestore(); } catch (e) { err(`Firestore top-level: ${e.message}`); }
  try { await purgeRedis(); }    catch (e) { err(`Redis top-level: ${e.message}`); }
  try { await purgeS3(); }       catch (e) { err(`S3 top-level: ${e.message}`); }

  console.log('\n' + '═'.repeat(60));
  console.log('  PURGE COMPLETE — All test data cleared.');
  console.log('  Backend, admin panel, and apps are ready for fresh start.');
  console.log('═'.repeat(60) + '\n');
  process.exit(0);
}

main().catch(e => {
  err(`Fatal: ${e.message}`);
  process.exit(1);
});
