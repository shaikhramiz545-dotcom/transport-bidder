# Driver ID Collision Fix - Production Deployment Checklist

**Date:** 2026-02-17  
**Deployment Window:** [TBD]  
**Expected Duration:** 45-60 minutes  
**Rollback Time:** < 5 minutes

---

## PRE-DEPLOYMENT CHECKLIST

### Code Review
- [x] SHA-256 implementation verified (backend + functions)
- [x] Ownership middleware tested
- [x] Collision detection scripts tested
- [x] Migration SQL syntax validated
- [x] Rollback plan documented

### Environment Preparation
- [ ] Database backup completed (PostgreSQL)
- [ ] Firestore export completed
- [ ] Cloud Run current revision noted: `__________________`
- [ ] DBA on standby (Slack/Phone)
- [ ] DevOps on standby
- [ ] Monitoring dashboards open

### Communication
- [ ] Stakeholders notified (24h advance)
- [ ] Support team briefed (potential driver re-verification)
- [ ] Incident response team on alert

---

## DEPLOYMENT SEQUENCE

### ⏱️ PHASE 1: DEPLOY CODE (5 minutes, Zero Downtime)

**1.1 Deploy Backend to Cloud Run**
```bash
cd backend
gcloud run deploy tbidder-backend \
  --source . \
  --region us-central1 \
  --allow-unauthenticated

# Note new revision: ______________________
```

**1.2 Verify Deployment**
```bash
# Test health endpoint
curl https://tbidder-backend-XXXXX.run.app/api/health

# Test new signup (should get DRV-<12 hex> format)
# Use Postman/curl to create test driver account
```

**1.3 Checkpoint**
- [ ] Cloud Run deployment successful (100% traffic)
- [ ] Health check returns 200 OK
- [ ] New signups receive `DRV-[a-f0-9]{12}` format
- [ ] Existing drivers can still login (stored driverId unchanged)

**Rollback Trigger:** If health check fails or new signups broken
```bash
gcloud run services update-traffic tbidder-backend \
  --to-revisions=PREVIOUS_REVISION=100
```

---

### ⏱️ PHASE 2: AUDIT COLLISIONS (10 minutes, Read-Only)

**2.1 Detect PostgreSQL Collisions**
```bash
cd backend
node scripts/detect_collisions.js --detect > collision_report_pg.txt
cat collision_report_pg.txt
```

**2.2 Detect Firestore Collisions**
```bash
node scripts/detect_firestore_collisions.js > collision_report_fs.txt
cat collision_report_fs.txt
```

**2.3 Analyze Reports**
- [ ] Count collided driverIds: `__________`
- [ ] Count affected drivers: `__________`
- [ ] Total credits at risk: `__________`
- [ ] Decision: Proceed to repair? YES / NO

**If NO collisions found:** Skip Phase 3, proceed to Phase 4.

---

### ⏱️ PHASE 3: REPAIR COLLISIONS (20-30 minutes, CRITICAL)

**⚠️ CRITICAL: Must complete BEFORE Phase 4 (migration will fail otherwise)**

**3.1 Dry Run (PostgreSQL)**
```bash
node scripts/detect_collisions.js --repair --dry-run > repair_plan_pg.txt
cat repair_plan_pg.txt
# Review: Verify reassignments look correct
```

**3.2 Execute Repair (PostgreSQL)**
```bash
node scripts/detect_collisions.js --repair 2>&1 | tee repair_log_pg.txt
# Monitor output for errors
```

**3.3 Execute Repair (Firestore)**
```bash
node scripts/detect_firestore_collisions.js --repair 2>&1 | tee repair_log_fs.txt
```

**3.4 Verify Repair Success**
```bash
# Re-run detection (should return 0 collisions)
node scripts/detect_collisions.js --detect
node scripts/detect_firestore_collisions.js
```

**3.5 Checkpoint**
- [ ] PostgreSQL collisions resolved (count = 0)
- [ ] Firestore collisions resolved (count = 0)
- [ ] All repairs logged in audit tables
- [ ] No errors in repair logs

**Rollback Trigger:** If repair fails or creates data corruption
```bash
# Restore from audit log (manual process, use repair_log_*.txt)
# Contact DBA for assistance
```

---

### ⏱️ PHASE 4: APPLY CONSTRAINTS (5 minutes)

**4.1 Run Migration SQL**
```bash
cd backend
psql $DATABASE_URL < migrations/025_driver_id_collision_fix.sql
```

**4.2 Verify Constraints Active**
```sql
-- Connect to PostgreSQL
psql $DATABASE_URL

-- Check constraints
SELECT conname, contype, conrelid::regclass 
FROM pg_constraint 
WHERE conname LIKE '%driver%' 
ORDER BY conname;

-- Expected output:
-- driver_identity_driverid_format  | c | DriverIdentities
-- driver_identity_driverid_unique  | u | DriverIdentities
-- driver_identity_phone_unique     | u | DriverIdentities
-- driver_wallet_appuser_fk         | f | DriverWallets
-- driver_wallet_appuserid_unique   | u | DriverWallets
-- driver_wallet_driverid_unique    | u | DriverWallets
-- driver_verification_driverid_unique | u | DriverVerifications
```

**4.3 Test Constraint Enforcement**
```sql
-- Attempt to create duplicate driverId (should FAIL)
INSERT INTO "DriverIdentities" (phone, "driverId", "createdAt", "updatedAt")
VALUES ('+1234567890', 'DRV-test123', NOW(), NOW());

INSERT INTO "DriverIdentities" (phone, "driverId", "createdAt", "updatedAt")
VALUES ('+0987654321', 'DRV-test123', NOW(), NOW());
-- Expected: ERROR: duplicate key value violates unique constraint

-- Clean up test data
DELETE FROM "DriverIdentities" WHERE "driverId" = 'DRV-test123';
```

**4.4 Checkpoint**
- [ ] Migration executed successfully
- [ ] All 7 constraints active (verified in pg_constraint)
- [ ] Duplicate driverId insertion blocked (constraint working)
- [ ] No application errors after migration

**Rollback Trigger:** If migration fails or breaks application
```sql
-- Drop constraints (non-destructive)
ALTER TABLE "DriverIdentities" DROP CONSTRAINT IF EXISTS driver_identity_driverid_format;
ALTER TABLE "DriverWallets" DROP CONSTRAINT IF EXISTS driver_wallet_appuser_fk;
-- (Full rollback SQL in migration file comments)
```

---

### ⏱️ PHASE 5: MONITORING (24 hours, Ongoing)

**5.1 Immediate Checks (Within 1 Hour)**
- [ ] New driver signups working (test 3-5 signups)
- [ ] Existing drivers can login and go online
- [ ] Wallet balance API returns correct data
- [ ] No 500 errors in Cloud Run logs
- [ ] No `[SECURITY]` warnings in logs (ownership violations)

**5.2 Log Monitoring Commands**
```bash
# Cloud Run logs (last 1 hour)
gcloud logging read "resource.type=cloud_run_revision AND severity>=WARNING" \
  --limit 50 --format json --freshness 1h

# Search for security warnings
gcloud logging read "resource.type=cloud_run_revision AND textPayload=~'SECURITY'" \
  --limit 20 --format json --freshness 1h

# Search for collision-related errors
gcloud logging read "resource.type=cloud_run_revision AND textPayload=~'collision'" \
  --limit 20 --format json --freshness 1h
```

**5.3 Database Integrity Check**
```sql
-- Verify 1:1 mapping (phone → driverId)
SELECT phone, COUNT(*) as count 
FROM "DriverIdentities" 
GROUP BY phone 
HAVING COUNT(*) > 1;
-- Expected: 0 rows

-- Verify 1:1 mapping (driverId → wallet)
SELECT "driverId", COUNT(*) as count 
FROM "DriverWallets" 
GROUP BY "driverId" 
HAVING COUNT(*) > 1;
-- Expected: 0 rows
```

**5.4 24-Hour Monitoring Checklist**
- [ ] Hour 1: Immediate verification (above)
- [ ] Hour 4: Check error rate (should be < 0.1%)
- [ ] Hour 12: Review wallet access patterns (anomaly detection)
- [ ] Hour 24: Full audit (run collision detection again)

---

## POST-DEPLOYMENT TASKS

### Within 1 Week
- [ ] Notify affected drivers (if any were repaired)
  - Email: "Please re-verify your documents"
  - In-app notification
- [ ] Review support tickets (any wallet/verification issues?)
- [ ] Performance analysis (hash function overhead)
- [ ] Update runbook with lessons learned

### Within 1 Month
- [ ] Implement phone recycling protection (Recommendation 4)
- [ ] Add collision detection health endpoint (Recommendation 2)
- [ ] Set up weekly sync monitor (Firestore ↔ PostgreSQL)
- [ ] Add wallet access audit log (Recommendation 3)

---

## ROLLBACK DECISION MATRIX

| Symptom | Severity | Action | Rollback? |
|---|---|---|---|
| New signups broken | 🔴 CRITICAL | Revert Cloud Run | YES |
| Existing drivers can't login | 🔴 CRITICAL | Revert Cloud Run | YES |
| Migration constraint violation | 🔴 CRITICAL | Fix data, retry | NO (fix forward) |
| Wallet API 500 errors | 🟠 HIGH | Investigate, may revert | MAYBE |
| Slow hash performance | 🟡 MEDIUM | Monitor, optimize later | NO |
| 1-2 ownership warnings | 🟢 LOW | Log, investigate | NO |

---

## EMERGENCY CONTACTS

| Role | Name | Contact |
|---|---|---|
| Backend Lead | ____________ | ____________ |
| DBA | ____________ | ____________ |
| DevOps | ____________ | ____________ |
| Security Engineer | ____________ | ____________ |
| On-Call Engineer | ____________ | ____________ |

---

## SIGN-OFF

**Pre-Deployment Approval:**
- [ ] Backend Lead: ____________ (Date: ______)
- [ ] DBA: ____________ (Date: ______)
- [ ] Security Engineer: ____________ (Date: ______)
- [ ] Product Owner: ____________ (Date: ______)

**Post-Deployment Verification:**
- [ ] Phase 1 Complete: ____________ (Time: ______)
- [ ] Phase 2 Complete: ____________ (Time: ______)
- [ ] Phase 3 Complete: ____________ (Time: ______)
- [ ] Phase 4 Complete: ____________ (Time: ______)
- [ ] 24h Monitoring Complete: ____________ (Date: ______)

**Deployment Status:** ⬜ NOT STARTED | ⬜ IN PROGRESS | ⬜ COMPLETED | ⬜ ROLLED BACK

---

**Last Updated:** 2026-02-17 04:01 UTC+05:30  
**Version:** 1.0  
**Next Review:** After Phase 3 completion
