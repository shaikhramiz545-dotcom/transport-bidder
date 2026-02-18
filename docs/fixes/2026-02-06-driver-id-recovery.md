Date: 2026-02-06
Bug: Driver ID resets after app reopen/reinstall, causing docs to appear unverified.
Files: backend/src/routes/drivers.js, backend/src/models.js, backend/migrations/015_driver_identity.sql, driver_app/lib/services/ride_bid_service.dart, driver_app/lib/features/home/home_screen.dart
Reason: Add phone->driverId mapping and resolve ID before going online; send phone with /location; fallback to FirebaseAuth phone if local prefs are cleared.
