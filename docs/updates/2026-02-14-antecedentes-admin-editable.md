# Driver Verification - Antecedentes persisted + Admin editable

**Date:** 2026-02-14  
**Areas:** Driver App, Admin Panel, Backend  

## Summary

Added two verification yes/no fields and ensured they are persisted in backend and editable in Admin Panel:

- "¿Tienes -Antecedentes policiales?" (Sí/No)
- "¿Tienes -Antecedentes penales?" (Sí/No)

## Backend

- Added DB columns in `DriverVerifications`:
  - `hasAntecedentesPoliciales` (BOOLEAN)
  - `hasAntecedentesPenales` (BOOLEAN)
- Driver API:
  - `GET /api/drivers/verification-status` now returns both fields
  - `POST /api/drivers/verification-register` now accepts and saves both fields
- Admin API:
  - `GET /api/admin/drivers/:id` returns both fields
  - Added `PATCH /api/admin/drivers/:id/antecedentes` to update both fields (with Firestore best-effort sync)

## Driver App

- Verification screen now loads saved antecedentes values from `verification-status`
- On submit for review, antecedentes values are included in `verification-register` payload

## Admin Panel

- Driver detail screen shows both antecedentes questions
- Both questions are editable via Sí/No buttons and saved to backend

## Versions

- Driver app: 2.0.2+6 (already bumped)
- Admin panel: 0.0.1

## Files

- `backend/migrations/020_driver_antecedentes_fields.sql`
- `backend/src/models.js`
- `backend/src/routes/drivers.js`
- `backend/src/routes/admin.routes.js`
- `driver_app/lib/features/verification/verification_screen.dart`
- `admin_panel/src/pages/DriverDetail.jsx`
- `admin_panel/package.json`
