# Driver Photo & Admin Panel Fixes

- **Date:** 2026-02-14
- **Scope:** admin_panel | backend | driver_app
- **Type:** bugfix | feature

## Summary

- Fixed driver profile photo not showing in Admin Panel (Drivers tab & Verification Hub)
- Added photo column to Verification Hub table
- Fixed driver detail page showing blank personal info (phone, email now populated from AppUser)
- Fixed document gallery not loading in driver detail (added admin-accessible documents endpoint)
- Added profile photo requirement in driver app before document submission

## Why

- Driver photos were broken because relative URLs weren't prefixed with the API base URL
- Verification Hub had no photo column at all
- Driver detail page hardcoded dashes for DNI/Phone/Email/City instead of using actual data
- Document fetch used driver-role auth endpoint which fails with admin token
- Profile photo was only stored locally; drivers could submit without one

## Files Changed

- `admin_panel/src/pages/Drivers.jsx` — added uploadsBase prefix for photo URLs
- `admin_panel/src/pages/VerificationHub.jsx` — added photo column with uploadsBase prefix
- `admin_panel/src/pages/DriverDetail.jsx` — use admin docs endpoint, show actual phone/email/city, fix doc URL prefix
- `backend/src/routes/admin.routes.js` — return email/phone in driver list & detail; added GET /admin/drivers/:id/documents
- `driver_app/lib/features/verification/verification_screen.dart` — require profile photo before submit
- `driver_app/lib/l10n/app_locale.dart` — added verification_photo_required translation

## Version Bumps

- **Flutter (driver_app):** `pubspec.yaml` version: 2.0.2+6 → 2.0.2+7
- **Admin panel:** `package.json` version: 0.0.1 → 0.0.2

## Notes / Verification

- After deploying backend, redeploy admin panel with `VITE_API_URL` set
- Driver app needs rebuild for profile photo requirement to take effect
