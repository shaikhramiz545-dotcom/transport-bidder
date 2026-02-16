# Admin Panel CORS preflight fix

- **Date:** 2026-02-14
- **Scope:** backend
- **Type:** bugfix

## Summary

- Updated backend CORS configuration to allow Admin Panel hosted on Firebase to make `PUT`/`PATCH` requests.
- Added explicit preflight handling for all routes.

## Why

- Admin Panel `PATCH` requests (e.g. antecedentes update) were failing with a 204 preflight/CORS error on Cloud Run.

## Files Changed

- `backend/src/app.js`
- `backend/package.json`

## Version Bumps

- **Web panel:** N/A
- **Backend:** `backend/package.json` version: 1.0.0 → 1.0.1

## Notes / Verification

- Verify `OPTIONS` preflight succeeds for `/api/admin/*`.
- Confirm Admin Panel can `PATCH /api/admin/drivers/:id/antecedentes` from `https://tbidder-admin.web.app`.
