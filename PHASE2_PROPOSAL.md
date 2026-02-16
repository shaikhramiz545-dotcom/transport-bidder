# Phase 2: Driver Verification Control & Admin Review System — Proposal

**Status:** Awaiting approval before implementation.  
**Scope:** Admin Drivers UX, document gallery, automatic blocking rules, audit logging, driver app feedback.  
**Out of scope:** Auth, payments, ride dispatch/booking logic. No file deletion.

---

## 1) Admin Panel — Drivers Module

### A) Drivers List Page — Wireframe

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  Drivers                                    [Search: _______________] [Filters ▼] │
├─────────────────────────────────────────────────────────────────────────────────┤
│  [ All ]  [ Pending ]  [ Approved ]  [ Rejected ]  [ Suspended ]                 │
├──────┬──────────┬──────────┬────────┬──────────┬────────────┬──────────────────┤
│ Photo│ Name     │ Phone    │ Status │ Docs (x/7)│ Joined     │ Actions           │
├──────┼──────────┼──────────┼────────┼──────────┼────────────┼──────────────────┤
│  JD  │ Juan D.  │ —        │ pending│ 5/7      │ 6 Feb 2025 │ [View] [⋮]        │
│  MR  │ María R. │ —        │ approved│ 7/7     │ 1 Feb 2025 │ [View] [⋮]        │
│  ... │          │          │        │          │            │                   │
└──────┴──────────┴──────────┴────────┴──────────┴────────────┴──────────────────┘
                                        [< Prev]  Page 1 of N  [Next >]
```

**Prompts for implementation:**

- **Tabs:** Exactly five: **All**, **Pending**, **Approved**, **Rejected**, **Suspended**. Map tab to `status` filter (no "verified" alias; use `approved`). Optional: keep **temp_blocked** in the same list, show as "Suspended" or separate badge.
- **Table columns:**
  - **Photo:** Avatar (initial or placeholder); no backend change if we don’t store driver photo yet.
  - **Name:** `driverName` or "—".
  - **Phone:** From backend if available; else "—" (no auth change to fetch phone).
  - **Status:** Badge with current status (pending, approved, rejected, suspended, temp_blocked).
  - **Docs (x/7):** Count of uploaded document types (e.g. 5/7). Backend: add to driver list response a field like `documentsCount` (count of DriverDocuments for that driverId) or compute in frontend from a new endpoint that returns counts per driver.
  - **Joined:** `createdAt` or `updatedAt` (formatted date).
  - **Actions:** "View" (navigate to detail), optional "⋮" menu (same actions as detail: Approve/Reject/Suspend/Request reupload).
- **Search:** By name, driverId, vehiclePlate (existing behavior); keep current search box and filter logic.
- **Filters:** Status dropdown (same as tabs), optional City if we have city data later. No payment/auth filters.

---

### B) Driver Detail Page — Wireframe

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  [← Back to Drivers]                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────────┐│
│  │  [Avatar]  Juan Pérez                                        [pending]      ││
│  │            Driver ID: abc123                                                 ││
│  │  [Approve] [Reject] [Suspend] [Request reupload]                              ││
│  └─────────────────────────────────────────────────────────────────────────────┘│
│  Last review: 6 Feb 2025                                                         │
├──────────────────────────────────┬──────────────────────────────────────────────┤
│  Personal Info                    │  Document Gallery                           │
│  Name    Juan Pérez               │  ┌─────────┬─────────┬─────────┐             │
│  DNI     —                        │  │ Brevete │ Brevete │  DNI    │             │
│  Phone   —                        │  │ front   │ back    │         │             │
│  Email   —                        │  │ [img]   │ [img]   │ [img]   │             │
│  City    —                        │  │ ✓ OK    │ ✓ OK    │ ✓ OK    │ [Download] │
│                                   │  └─────────┴─────────┴─────────┘             │
│  Vehicle Info                     │  ┌─────────┬─────────┬─────────┐             │
│  Plate   ABC-123                  │  │ Selfie  │  SOAT   │ Tarjeta │             │
│  Type    car                      │  │ [img]   │ [img]   │ [img]   │             │
│  SOAT expiry  15 Mar 2026         │  │ ✓ OK    │ ✓ OK    │ ✓ OK    │ Expiry: …   │
│                                   │  └─────────┴─────────┴─────────┘             │
│                                   │  ┌─────────┐                                 │
│                                   │  │ Vehicle │                                 │
│                                   │  │ photo   │                                 │
│  Internal notes (admin only)      │  │ [img] ✓ │                                 │
│  ┌─────────────────────────────┐ │  └─────────┘                                 │
│  │ e.g. Recheck after renewal   │ │                                              │
│  └─────────────────────────────┘ │  Audit Log                                    │
│                                   │  • 6 Feb 2025  admin@…  Rejected  "Doc blur"  │
│                                   │  • 5 Feb 2025  admin@…  Pending  (submitted)  │
└──────────────────────────────────┴──────────────────────────────────────────────┘
│  Block reason (if rejected/suspended): Document unclear. Please resubmit SOAT.    │
└─────────────────────────────────────────────────────────────────────────────────┘
```

**Prompts for implementation:**

- **Personal Info card:** Keep Name, DNI, Phone, Email, City. Populate from driver + any backend fields we add (no auth change; use existing driver payload).
- **Vehicle Info card:** Plate, Type, **SOAT expiry** (from document metadata when we have it; see Backend).
- **Document Gallery:**
  - One tile per type: Brevete front, Brevete back, DNI, Selfie, SOAT, Tarjeta, Vehicle photo.
  - **Preview:** Thumbnail or link; open in new tab or lightbox (URL = base URL + `fileUrl` from API).
  - **Download:** Link to same URL with `download` or open in new tab.
  - **Status:** e.g. "Uploaded", "Missing", "Rejected" (from backend when we have per-doc status).
  - **Expiry date:** Shown for SOAT (and optionally Brevete) when backend provides it.
  - Data source: `GET /api/drivers/documents?driverId=...` (existing). Backend may add optional `expiryDate` and `reviewStatus` per document later.
- **Action buttons:** Approve, Reject, Suspend, Request reupload (existing modals).
- **Reject modal:** Mandatory reason (already implemented); ensure it’s sent as `blockReason` and stored.
- **Request reupload modal:** 
  - Checklist: which documents to request (e.g. SOAT, Brevete front, …).
  - Optional instructions text (stored and shown to driver).
  - Backend: new field or table to store "reupload requested" with document types + message; driver app reads this and shows "Fix documents" + which docs.
- **Internal notes:** New field (e.g. `adminNotes` on driver or separate table). Admin-only; not shown to driver. Editable in place or small modal.
- **Audit log:** New section; list from backend (see Audit Log below). Columns: timestamp, actor, action, reason, oldStatus → newStatus.

---

## 2) Backend Rules

**Prompts:**

- **canGoOnline (computed rule):**  
  Driver may go online only if all of the following hold:
  - Verification status = `approved`.
  - No required document missing (all 7 types uploaded).
  - No document in "rejected" state (if we add per-doc review status).
  - SOAT not expired (compare `expiryDate` to today when documentType = soat).
  - Not suspended (status ≠ suspended / temp_blocked).

- **Where to enforce:**  
  - In `POST /api/drivers/location`: before setting driver online, compute `canGoOnline` (query DriverVerification + DriverDocuments + optional expiry). If false, return 403 with `blockReason` and optional `code` (e.g. `DOC_MISSING`, `SOAT_EXPIRED`, `SUSPENDED`).
  - Optionally: lightweight check on driver app login or when toggling "Go Online" (same rules, same API).

- **Background check:**  
  - "On login" = when driver calls an endpoint that implies they’re active (e.g. verification-status or location). No separate login endpoint change.  
  - Reuse the same `canGoOnline` logic in `/location` and optionally in `/verification-status` so the app can show "You cannot go online because …" without attempting location post.

- **Expiry:**  
  - Add optional `expiryDate` (DATE) to `DriverDocuments` (migration). Used for SOAT and optionally brevete.  
  - When computing canGoOnline, if documentType = `soat` and `expiryDate` is set and `expiryDate < today`, treat as expired and block.

- **Logging:**  
  - Log all failures (e.g. canGoOnline false, missing doc, SOAT expired) at INFO level with driverId and reason; no auth/payment changes.

---

## 3) Audit Log

**Prompts:**

- **Schema (new table):**  
  `driver_verification_audit` (or similar):
  - `id`, `driverId`, `actor` (admin email or "system"), `action` (e.g. approved, rejected, suspended, reupload_requested), `reason` (blockReason or note), `oldStatus`, `newStatus`, `metadata` (optional JSON: e.g. which docs requested for reupload), `createdAt`.

- **When to write:**  
  - On every admin verify action: Approve, Reject, Suspend, Request reupload.  
  - Optionally: when driver submits (system action: "submitted" / "pending").

- **API:**  
  - `GET /api/admin/drivers/:id/audit` — returns list for that driver (ordered by createdAt desc).  
  - Admin Driver Detail page calls this and displays in Audit Log section.

- **No file deletion;** only insert audit rows.

---

## 4) Driver App

**Prompts:**

- **Rejection reason:**  
  - Already returned as `blockReason` in verification-status. Show it clearly on the verification screen when status is `rejected` or `suspended` (e.g. prominent card or banner above the steps).

- **Which doc needs reupload:**  
  - Backend: when admin sends "Request reupload", store requested document types (and optional message).  
  - New or existing endpoint: e.g. `GET /api/drivers/verification-status` extended to return `reuploadRequested: { documentTypes: ['soat', 'brevete_frente'], message: '...' }` when applicable.  
  - Driver app: if `reuploadRequested` is present, show message and list of document labels (e.g. "SOAT", "Brevete front") and highlight those tiles or show "Reupload requested" on them.

- **"Fix documents" button:**  
  - Shown when status is `rejected` or when `reuploadRequested` is set.  
  - Action: navigate to verification screen (or open same screen) and focus on Step 1/2 or the requested doc types so driver can re-upload and resubmit.

- **No auth or payment changes.**

---

## 5) Safety Checklist

- **No file deletion:** Do not delete driver or agency documents from disk or DB; only add/update status or metadata.
- **No auth changes:** Do not modify login, signup, or token logic.
- **No payment changes:** Do not modify wallet, recharge, or payout flows.
- **Logs:** Add structured logs for: canGoOnline false (reason), audit insert, and any verify/reupload API failure.

---

## Implementation Order (after approval)

1. **Backend: Audit log** — Migration + model + write on verify + `GET /api/admin/drivers/:id/audit`.
2. **Backend: canGoOnline + SOAT expiry** — Add `expiryDate` to DriverDocuments (migration), implement canGoOnline in `/location` (and optionally in verification-status), add failure logs.
3. **Backend: Reupload request** — Store reupload request (document types + message); extend verification-status for driver app.
4. **Admin: Driver list** — Tabs (All, Pending, Approved, Rejected, Suspended), Docs (x/7) column, search/filters (no new auth).
5. **Admin: Driver detail** — Load documents from API, gallery with preview/download/expiry, internal notes field, wire Request reupload to new API, show audit log.
6. **Driver app** — Show rejection reason clearly, show which doc needs reupload, add "Fix documents" button.

---

## Summary

| Item | Deliverable |
|------|-------------|
| Admin list | Tabs, table columns (Photo, Name, Phone, Status, Docs x/7, Joined, Actions), search + filters |
| Admin detail | Personal/Vehicle cards, document gallery (preview, download, status, expiry), Approve/Reject/Suspend/Request reupload, reject reason required, internal notes, audit log |
| Backend | canGoOnline rules (missing doc, rejected doc, SOAT expired, suspended), enforce in /location, optional in verification-status; audit log table + API; reupload request storage + API |
| Driver app | Rejection reason prominent, which doc reupload requested, "Fix documents" button |
| Safety | No file deletion, no auth/payment changes, add failure logs |

---

**If you approve this proposal, reply with "Approved" or requested changes. Implementation will then proceed step by step in the order above.**
