Date: 2026-02-06
Bug: Driver ID changed after app reopen; documents show unverified.
Files: driver_app/lib/features/home/home_screen.dart
Reason: Ensure stored driverId is loaded before going online and avoid overwriting an existing ID from /location.
