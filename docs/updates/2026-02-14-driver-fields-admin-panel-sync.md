# Driver App Fields Sync with Admin Panel

**Date:** 2026-02-14  
**Version:** Driver App v2.0.3+8, Backend API  
**Type:** Feature Enhancement

## Summary
Added missing driver profile fields to match admin panel expectations. Driver app now collects and sends all information that admin panel displays.

## Changes

### Driver App (v2.0.3+8)
- **Verification Screen**: Added text input fields for:
  - City (location)
  - DNI number (national ID)
  - License number (driver's license)
  - Vehicle plate number (moved from ambiguous "vehicle" field)
- **Profile Screen**: Added city and DNI fields for editing
- **ProfileStorageService**: Added `getCity()`, `getDni()`, `saveCity()`, `saveDni()` methods
- **Verification Submit**: Now sends `city`, `dni`, `phone`, `license`, and `vehiclePlate` to backend

### Backend API
- **`/api/drivers/verification-register`**: Now accepts and stores:
  - `city` (string)
  - `dni` (string)
  - `phone` (string)
  - `license` (string)
  - `photoUrl` (string, prepared for future photo upload)
- Updated both PostgreSQL and Firestore paths to handle new fields

## Fields Now Aligned
| Field | Admin Panel | Driver App | Backend |
|-------|-------------|------------|---------|
| City | ✅ Shows | ✅ Collects | ✅ Stores |
| DNI (text) | ✅ Shows | ✅ Collects | ✅ Stores |
| Phone | ✅ Shows | ✅ Sends | ✅ Stores |
| License | ✅ Shows | ✅ Collects | ✅ Stores |
| Vehicle Plate | ✅ Shows | ✅ Collects | ✅ Stores |
| Photo | ✅ Shows | ⚠️ Local only | ⏳ Prepared |

## Remaining Work
- Photo upload to backend (currently stored locally as base64)
- Rating field (backend-managed, not user input)
- Timestamps (backend-managed automatically)

## Testing Required
1. Driver app verification flow with all new fields
2. Profile screen editing of city and DNI
3. Admin panel display of newly submitted driver data
4. Backend API validation of new fields

## Migration Notes
- Existing drivers will have null values for new fields until they update their profile
- No database migration required (fields already exist or are nullable)
- Backward compatible with existing driver records
