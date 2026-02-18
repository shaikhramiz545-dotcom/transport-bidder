# TBidder Verification Rules (Peru)

Rules for driver and partner verification. Used for compliance and admin review.

---

## Driver verification (Peru)

### 3-step flow (Driver app)

1. **Step 1 — Personal**
   - Brevete (frente)
   - Brevete (dorso)
   - DNI
   - Selfie

2. **Step 2 — Vehicle**
   - SOAT
   - Tarjeta de propiedad
   - Foto del vehículo

3. **Step 3 — Review & submit**
   - User reviews all items and submits for review.
   - All documents are uploaded to the backend before profile is submitted.

### Backend document types

Allowed `documentType` values for `POST /api/drivers/documents`:

- `brevete_frente`
- `brevete_dorso`
- `dni`
- `selfie`
- `soat`
- `tarjeta_propiedad`
- `foto_vehiculo`

### Status lifecycle

- **pending** — Submitted, awaiting admin review. Driver cannot go online.
- **approved** — Admin approved. Driver can go online and receive ride requests.
- **rejected** — Admin rejected. Driver sees block reason; can re-upload and resubmit.
- **temp_blocked** — e.g. duplicate vehicle/account. Must contact support.
- **suspended** — Admin suspended. Driver cannot go online until resolved.

### Rules (current and target)

- **Go Online:** Blocked unless status is `approved`. Enforced in `POST /api/drivers/location`.
- **Source of truth:** Admin Panel writes to PostgreSQL; backend syncs to Firestore so the driver app sees status from both (PG preferred).
- **Status changes:** Every admin action (approve / reject / suspend / reupload request) should be logged (audit log in Phase 3).
- **Auto-block on expiry:** (Phase 2) Documents with expiry (e.g. SOAT, brevete) can trigger auto status change when expired.

### Sync (admin ↔ driver app)

- Admin uses **PostgreSQL** (DriverVerifications, DriverDocuments).
- Driver app reads status via `GET /api/drivers/verification-status` (PG first, then Firestore).
- When admin approves/rejects/suspends, backend updates PG and performs best-effort sync to Firestore so the driver app and `/api/drivers/location` see the new status immediately.

---

## Partner (Travel agency) verification

### Document types

- business_license  
- tax_id  
- id_proof  
- company_registration  

### Status

- **pending** — Awaiting review.  
- **approved** — Can create and manage tours.  
- **rejected** — Rejected; note shown to agency.  
- **needs_documents** — Admin requested more documents; agency can re-upload.

### Rules

- Any change (except images) to a tour → status set to **Pending** (requires admin re-approval).  
- Admin has final authority for approve / reject / request_documents.

---

## File storage

- **Driver documents:** `uploads/driver-docs/{driverId}/{documentType}.{ext}`  
- **Agency documents:** `uploads/agency-docs/{agencyId}/{documentType}.{ext}`  
- Served under `/uploads/...` by the backend.  
- Max file size: 10 MB per file (driver and agency uploads).
