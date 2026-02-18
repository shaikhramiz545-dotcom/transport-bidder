# CRITICAL: Driver ID Collision Vulnerability – Complete Fix Plan

**Severity:** CRITICAL (P0)
**Date:** 2026-02-17
**Status:** Active Remediation

---

## 1. Root Cause Technical Explanation

### The Vulnerability

```javascript
// VULNERABLE CODE (backend/src/db/firestore.js:90-96 & functions/src/db/firestore.js:90-96)
function _stableDriverIdFromPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  const last5 = digits.slice(-5).padStart(5, '0');
  return `DRV-${last5}`;
}
```

**Only 100,000 possible IDs** (00000–99999). With ~500+ drivers, birthday paradox gives ~50% collision probability at ~350 drivers.

### Why This Is Catastrophic

1. **Identity Collapse:** Two distinct phone numbers map to the same `driverId`. The system treats two different human beings as one entity.

2. **Relational Mapping Compromise:**
   - `DriverVerification.driverId` (unique) → First registrant "owns" the verification record
   - `DriverWallet.driverId` (unique) → Wallet credits shared/stolen between strangers
   - `DriverDocument.driverId` → PII documents (DNI, license, selfie) exposed cross-user
   - `WalletTransaction.driverId` → Financial transaction history leaked
   - `WalletLedger.driverId` → Audit trail corrupted
   - `Ride.driverId` → Ride history cross-contaminated
   - `Bids.driverId` → Bid history attributed to wrong driver

3. **Indirect Wallet/Verification Linkage:**
   - Wallet is keyed by `driverId` (not by `AppUser.id` or phone)
   - When User B signs up with a phone ending in the same 5 digits as User A:
     - `upsertUserByPhone()` generates `DRV-12345` for User B
     - `DriverWallet.findOrCreate({ where: { driverId: 'DRV-12345' } })` returns **User A's wallet**
     - `DriverVerification` lookup returns **User A's verification status** (possibly "approved")
     - User B inherits approved status, credits, documents — full identity takeover

4. **Secondary Collision Source:** `generateShortDriverId()` uses `Math.random()` (non-cryptographic, 5–7 digit range) — another collision vector, though less severe since it's only used when no phone mapping exists.

---

## 2. Immediate Emergency Fix (Hotfix)

### Updated `_stableDriverIdFromPhone` Implementation

**Strategy:** Use SHA-256 hash of the **full normalized phone number** (with country code), truncated to 12 hex chars. This gives 16^12 = ~281 trillion possible IDs — collision probability negligible even at millions of drivers.

```javascript
const crypto = require('crypto');

function _stableDriverIdFromPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits || digits.length < 7) {
    // Fallback: generate a random unique ID if phone is too short/invalid
    return `DRV-${crypto.randomBytes(6).toString('hex')}`;
  }
  // SHA-256 of full phone digits → take first 12 hex chars → DRV-xxxxxxxxxxxx
  const hash = crypto.createHash('sha256').update(digits).digest('hex');
  return `DRV-${hash.slice(0, 12)}`;
}
```

### Backward Compatibility

- **Existing drivers are NOT broken.** Their `driverId` is already stored in:
  - Firestore `users` collection (field: `driverId`)
  - PostgreSQL `DriverIdentity` table (phone → driverId mapping)
  - PostgreSQL `DriverVerification` table
- The `upsertUserByPhone()` function **only generates a new driverId when the existing record has none**. Existing drivers keep their old ID.
- The new function only affects **new signups** going forward.

### Safe Migration Strategy

1. Deploy the new `_stableDriverIdFromPhone` to both `backend/src/db/firestore.js` and `functions/src/db/firestore.js`
2. Existing drivers with a stored `driverId` are unaffected (the backfill path only triggers when `driverId` is empty/null)
3. New drivers get collision-free IDs immediately
4. Run the collision detection script (Section 4) to find and repair any existing damage

---

## 3. Long-Term Architectural Fix

### Option Analysis

| Approach | Uniqueness | Deterministic | Human-Readable | Performance | Recommendation |
|---|---|---|---|---|---|
| **UUID v4** | Excellent (2^122) | No | No | O(1) generate | Good for internal PKs |
| **DB Auto-Increment** | Perfect | Yes | Yes | Requires DB round-trip | Not suitable for distributed (Firestore) |
| **Crypto Hash (SHA-256 of phone)** | Excellent (12 hex = 2^48) | Yes (same phone = same ID) | Moderate | O(1) generate | **RECOMMENDED** |
| **CUID2 / NanoID** | Excellent | No | Moderate | O(1) generate | Good alternative |

### Recommended Production-Grade Approach: **Crypto Hash (SHA-256)**

**Why:**
- **Deterministic:** Same phone always produces the same ID (important for idempotent upserts)
- **Collision-resistant:** 12 hex chars = 281 trillion combinations
- **No DB dependency:** Works in serverless/Cloud Run without sequence coordination
- **Backward-compatible format:** Still `DRV-xxxxxxxxxxxx` prefix
- **Irreversible:** Cannot derive phone from hash (privacy protection)

**Long-term (Phase 2):** Migrate wallet FK from `driverId` to `AppUser.id` (integer PK). This decouples the financial system from the identity derivation entirely.

---

## 4. Database Repair Strategy

### 4a. Detect All driverId Collisions

**PostgreSQL (DriverIdentity table):**
```sql
-- Find driverIds mapped to multiple phones (collision indicator)
SELECT "driverId", COUNT(*) as phone_count, array_agg(phone) as phones
FROM "DriverIdentities"
WHERE "driverId" IS NOT NULL
GROUP BY "driverId"
HAVING COUNT(*) > 1;
```

**PostgreSQL (DriverWallet with multiple users):**
```sql
-- Wallets where driverId appears in multiple identity rows
SELECT dw."driverId", dw.balance, di.phone
FROM "DriverWallets" dw
JOIN "DriverIdentities" di ON di."driverId" = dw."driverId"
WHERE dw."driverId" IN (
  SELECT "driverId" FROM "DriverIdentities"
  GROUP BY "driverId" HAVING COUNT(*) > 1
);
```

**Firestore (users collection):**
```javascript
// Node.js script to detect Firestore collisions
async function detectFirestoreCollisions() {
  const db = getDb();
  const snap = await db.collection('users').where('role', '==', 'driver').get();
  const idMap = new Map(); // driverId -> [{ docId, phone }]
  for (const doc of snap.docs) {
    const d = doc.data();
    if (!d.driverId) continue;
    if (!idMap.has(d.driverId)) idMap.set(d.driverId, []);
    idMap.get(d.driverId).push({ docId: doc.id, phone: d.phone });
  }
  const collisions = [];
  for (const [driverId, entries] of idMap) {
    if (entries.length > 1) collisions.push({ driverId, entries });
  }
  return collisions;
}
```

### 4b. Repair Corrupted Mappings

For each collision group:
1. **Identify the original owner** (earliest `createdAt`)
2. **Assign new unique driverId** to the newer user(s) using the fixed hash function
3. **Create fresh wallet** for reassigned users (balance = 0, since they never legitimately earned those credits)
4. **Create fresh DriverVerification** (status = 'pending') for reassigned users
5. **Re-link DriverDocuments** if the newer user uploaded their own documents

### 4c. Prevent Data Corruption During Migration

- Run inside a transaction (PostgreSQL) or batch (Firestore)
- Log every change to an audit table before executing
- Dry-run mode first: output proposed changes without executing

---

## 5. Hard Constraints

### PostgreSQL Unique Indexes (already present but must be enforced)

```sql
-- DriverIdentity: phone and driverId must both be unique (already defined in model)
CREATE UNIQUE INDEX IF NOT EXISTS "driver_identity_phone_unique" ON "DriverIdentities" (phone);
CREATE UNIQUE INDEX IF NOT EXISTS "driver_identity_driverid_unique" ON "DriverIdentities" ("driverId");

-- DriverWallet: one wallet per driverId
CREATE UNIQUE INDEX IF NOT EXISTS "driver_wallet_driverid_unique" ON "DriverWallets" ("driverId");

-- DriverVerification: one record per driverId
CREATE UNIQUE INDEX IF NOT EXISTS "driver_verification_driverid_unique" ON "DriverVerifications" ("driverId");
```

### Application-Level Validation

- Before creating a DriverIdentity row, verify no existing row has that driverId
- Before creating a DriverWallet, verify no existing wallet exists for that driverId
- Add CHECK constraint: `driverId LIKE 'DRV-%' OR driverId LIKE 'd-%'`

---

## 6. Authentication Flow Hardening

### Signup Must Always Create Isolated Resources

```
Driver Signup Flow (fixed):
1. Normalize phone number (E.164 format)
2. Check DriverIdentity for existing mapping
   → If exists: use existing driverId (this is the SAME person re-installing)
   → If NOT exists:
     a. Generate new driverId via SHA-256 hash of full phone
     b. Verify driverId doesn't already exist in DriverIdentity (collision guard)
     c. If collision (astronomically unlikely): append random suffix
     d. INSERT into DriverIdentity (phone, driverId)
     e. CREATE fresh DriverWallet (balance=0)
     f. CREATE fresh DriverVerification (status='pending')
3. Never inherit another driver's wallet or verification
```

### Prevent Accidental Relinking

- The `/location` endpoint currently creates DriverIdentity rows on-the-fly (line 473). This must be guarded:
  - Only create if no existing row for that phone exists
  - Never overwrite an existing phone→driverId mapping

### Phone Number Reuse Protection

- When a phone number is reused (new SIM owner), the old driver's data should NOT transfer
- Solution: Require re-verification (document upload) for any phone that already has a driverId mapping older than N days

---

## 7. Security Hardening Recommendations

### 7a. Prevent ID-Based Data Exposure

- Never expose `driverId` in public-facing APIs without authentication
- Remove driverId from any unauthenticated response payloads

### 7b. Validate Ownership Before Returning Wallet Data

```javascript
// BEFORE (vulnerable):
const driverId = req.query.driverId; // Client can pass ANY driverId
const wallet = await DriverWallet.findOne({ where: { driverId } });

// AFTER (secure):
const authDriverId = await resolveAuthDriverId(req); // From JWT/session
if (requestedDriverId && requestedDriverId !== authDriverId) {
  return res.status(403).json({ error: 'Forbidden' });
}
```

### 7c. Middleware-Level Ownership Check

```javascript
function enforceDriverOwnership(req, res, next) {
  const authDriverId = req.resolvedDriverId; // Set by auth middleware
  const requestedDriverId = req.body?.driverId || req.query?.driverId || req.params?.driverId;
  if (requestedDriverId && authDriverId && requestedDriverId !== authDriverId) {
    console.warn('[SECURITY] Ownership violation attempt', {
      authDriverId, requestedDriverId, ip: req.ip, path: req.path
    });
    return res.status(403).json({ error: 'Forbidden: ownership mismatch' });
  }
  next();
}
```

### 7d. Logging & Anomaly Detection

- Log every wallet access with requester identity
- Alert on: same driverId accessed from multiple distinct auth tokens in 24h
- Alert on: wallet balance accessed by phone not matching DriverIdentity record
- Log driverId generation events with full phone hash for forensics

---

## 8. Credit System Isolation Fix

### Current Problem

```
DriverWallet.driverId ← derived from phone (collision-prone)
                       ← NOT linked to AppUser.id (actual identity)
```

### Target Architecture

```
DriverWallet
  ├── id (PK, auto-increment)
  ├── appUserId (FK → AppUser.id, UNIQUE, NOT NULL)  ← PRIMARY LINK
  ├── driverId (STRING, UNIQUE, NOT NULL)             ← SECONDARY (for backward compat)
  ├── balance
  └── ...
```

### Migration Path

1. Add `appUserId` column to `DriverWallets` (nullable initially)
2. Backfill: for each wallet, find the AppUser via DriverIdentity.phone → AppUser.phone
3. Set NOT NULL constraint after backfill
4. Add UNIQUE constraint on `appUserId`
5. Update all wallet queries to prefer `appUserId` lookup

---

## 9. Migration Plan (Step-by-Step)

### Phase 1: Stop New Collisions (IMMEDIATE — deploy within hours)
- [x] Replace `_stableDriverIdFromPhone` with SHA-256 based implementation
- [x] Replace `generateShortDriverId` with crypto-safe random
- [x] Deploy to Cloud Run

### Phase 2: Audit Old Data (within 24 hours)
- [ ] Run collision detection queries (Section 4a)
- [ ] Generate report of affected driverIds, phones, wallets
- [ ] Quantify financial exposure (sum of shared wallet balances)

### Phase 3: Repair Corrupted Mappings (within 48 hours)
- [ ] For each collision group: reassign newer users to fresh driverIds
- [ ] Create fresh wallets and verification records
- [ ] Archive old shared records (don't delete)

### Phase 4: Deploy Constraints (within 72 hours)
- [ ] Run constraint migration SQL
- [ ] Add ownership middleware to all driver-facing endpoints
- [ ] Add appUserId FK to DriverWallet

### Phase 5: Monitor Logs (ongoing)
- [ ] Monitor for any collision warnings in logs
- [ ] Set up alerts for ownership violation attempts
- [ ] Weekly audit: verify 1:1 mapping phone → driverId → wallet

---

## 10. Risk & Downtime Assessment

### Can This Be Done Without Downtime?

**Phase 1 (Hotfix): YES — Zero downtime.**
- The `_stableDriverIdFromPhone` change only affects NEW signups
- Existing drivers keep their stored driverId (read from DB, not re-derived)
- Deploy as normal Cloud Run revision

**Phase 2 (Audit): YES — Read-only queries.**
- Detection queries are SELECT-only

**Phase 3 (Repair): MINIMAL RISK — Can be done live.**
- Use transactions for atomicity
- Affected users may see brief inconsistency during the migration window
- Consider: temporarily block affected driverIds from going online during repair (minutes, not hours)

**Phase 4 (Constraints): YES — Additive migrations.**
- Adding columns and indexes is non-blocking in PostgreSQL
- Adding UNIQUE constraint may fail if violations exist → must complete Phase 3 first

### Rollback Plan

- **Phase 1:** Revert Cloud Run to previous revision (instant)
- **Phase 3:** All repairs are logged with before/after state; can be reversed from audit log
- **Phase 4:** Drop new constraints/columns (non-destructive)

### Read-Only Mode Required?

**No.** All changes are backward-compatible. However, during Phase 3 repair:
- Temporarily disable signup for affected phone numbers (block list)
- Or: accept that a ~5 minute window of inconsistency is tolerable

---

## Files Modified

| File | Change |
|---|---|
| `backend/src/db/firestore.js` | Replace `_stableDriverIdFromPhone` with SHA-256 hash |
| `functions/src/db/firestore.js` | Same change (functions copy) |
| `backend/src/routes/drivers.js` | Replace `generateShortDriverId` with crypto-safe; add ownership guard |
| `backend/src/routes/wallet.routes.js` | Strengthen ownership checks |
| `backend/scripts/detect_collisions.js` | NEW: Collision detection & repair script |
| `backend/migrations/025_driver_id_collision_fix.sql` | NEW: Add constraints & appUserId column |
