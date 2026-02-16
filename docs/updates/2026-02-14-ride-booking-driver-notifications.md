# Ride booking: drivers not receiving requests/notifications

- **Date:** 2026-02-14
- **Scope:** backend, user_app
- **Type:** bugfix

## Summary

- Fixed backend vehicle-type matching so drivers reported as `car` are normalized to receive taxi-category ride requests.
- Fixed user app vehicle selector UI so the "Find" button is reachable on smaller screens.
- Improved user app `createRide` logging to show HTTP failures instead of silently returning null.

## Why

- Driver app defaults `vehicleType` to `car`, but user taxi rides are mapped to category `taxi`; backend filtering prevented matching.
- Vehicle selector bottom sheet could overflow and hide the action button.

## Files Changed

- `backend/src/routes/drivers.js`
- `backend/src/routes/rides.js`
- `user_app/lib/features/home/home_screen.dart`
- `user_app/lib/services/bidding_service.dart`
- `user_app/pubspec.yaml`

## Version Bumps

- **Flutter (user_app):** `pubspec.yaml` version: `2.0.0+2` → `2.0.0+3`

## Notes / Verification

- After backend deploy, verify:
  - Create taxi ride from user app
  - Driver goes online and sees the request in `/api/drivers/requests`
  - Driver receives FCM notification when applicable
