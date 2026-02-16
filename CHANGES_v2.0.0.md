# TransportBidder v2.0.0 - Changes Summary

## ✅ COMPLETED FIXES (Session 1)

### 1. Default Country Code → Peru (+51)
**Files Modified:**
- `user_app/lib/core/country_codes.dart` - Moved Peru to first position
- `driver_app/lib/core/country_codes.dart` - Moved Peru to first position

**Before:** Default was India (+91)
**After:** Default is Peru (+51)

---

### 2. Default Language → Spanish
**Files Verified:**
- `user_app/lib/l10n/app_locale.dart` - Already set to Spanish (es)
- `driver_app/lib/l10n/app_locale.dart` - Already set to Spanish (es)

**Status:** ✅ Already correct

---

### 3. Base Fare Reverted to 2.0 soles/km
**Files Modified:**
- `user_app/lib/services/fare_service.dart`

**Before:** `const double baseRatePerKm = 1.5;`
**After:** `const double baseRatePerKm = 2.0;`

**Note:** Admin custom pricing per driver needs to be added separately

---

### 4. Tour Vehicle Category Added
**Files Modified:**
- `user_app/lib/features/home/home_screen.dart`

**Before:** Only Taxi, Truck, Bike, Delivery, Ambulance
**After:** Added Tour category with 🗺️ emoji using `taxi_outstation` vehicle type

```dart
_VehicleCategory(id: 'tour', label: 'Tour', emoji: '🗺️', children: [], singleVehicle: VehicleType.taxi_outstation)
```

---

### 5. Auto-Submit OTP Implementation
**Files Modified:**
- `user_app/lib/features/auth/otp_screen.dart` - Added auto-submit after 4 digits
- `driver_app/lib/features/auth/otp_screen.dart` - Already had auto-submit (6 digits for Firebase, 4 for backend)

**Implementation:**
- Added `_autoVerifyFired` flag to prevent multiple submissions
- Added `_maybeAutoVerify()` listener on text controller
- Auto-triggers `_verify()` when correct digit count reached
- Resets flag on failure to allow retry

---

### 6. Join Us Agency Redirect Fixed
**Files Modified:**
- `user_app/lib/features/home/home_screen.dart` - Drawer menu

**Before:** `http://localhost:5174`
**After:** `https://www.transportbidder.com`

**Driver Button:** Still uses deep link `tbidder-driver://open`

---

### 7. App Version Updated
**Files Modified:**
- `user_app/pubspec.yaml` - Updated to `version: 2.0.0+2`
- `driver_app/pubspec.yaml` - Updated to `version: 2.0.0+2`
- `user_app/lib/features/profile/profile_screen.dart` - Shows v2.0.0
- `driver_app/lib/features/auth/login_screen.dart` - Shows v2.0.0

---

## ⏳ PENDING FIXES (High Priority)

### 8. Driver ID Generation & Display
**Required Changes:**
- Backend: Generate unique Driver ID on signup (format: DRV-XXXXX)
- Backend: Store driverId in users collection
- Backend: Return driverId in verification response
- Driver App: Display Driver ID in drawer after signup
- Driver App: Show "Go online to get ID" message when offline

**Files to Modify:**
- `backend/src/db/firestore.js` - Add driverId generation
- `backend/src/routes/auth.routes.js` - Return driverId
- `driver_app/lib/features/home/home_screen.dart` - Display in drawer

---

### 9. Admin Panel - Custom Pricing Per Driver
**Required Changes:**
- Add `customRatePerKm` field to driver profile
- Admin can set custom rate (overrides base 2.0)
- Backend API to get driver's custom rate
- User app fetches driver's rate when bid accepted

**Files to Create/Modify:**
- `backend/src/routes/drivers.js` - Add custom rate endpoints
- `admin_panel/src/pages/DriverDetail.jsx` - Add rate input field
- `backend/src/db/firestore.js` - Store custom rates

---

### 10. Missing Spanish Translations
**Files to Update:**
- `user_app/lib/l10n/app_locale.dart` - Add missing keys
- `driver_app/lib/l10n/app_locale.dart` - Add missing keys

**Keys to Add:**
- Tour-related translations
- Any English-only error messages
- Profile/settings screens

---

### 11. Firebase Index Creation (User Action Required)
**Issue:** Password reset shows Firebase index error

**Solution:** User must create composite indexes in Firebase Console

**Steps to Document:**
1. Go to Firebase Console → Firestore → Indexes
2. Create composite index for `password_reset_otp` collection:
   - Fields: `email` (Ascending), `role` (Ascending), `expiresAt` (Descending)
3. Wait 5-10 minutes for index to build

---

## 🚫 CANNOT BE FIXED IN CODE

### Email OTP Not Sending
**Reason:** SMTP configuration required

**Solution:** User must set environment variables:
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
MAIL_FROM=noreply@transportbidder.com
```

**File:** `backend/.env`

---

### Phone OTP Issues
**Reason:** Firebase Phone Auth requires SHA-1 fingerprint registration

**Solution:** User must:
1. Generate SHA-1: `cd android && ./gradlew signingReport`
2. Add SHA-1 to Firebase Console → Project Settings → Android App
3. Download new `google-services.json`
4. Replace in `user_app/android/app/` and `driver_app/android/app/`

---

## 📦 NEXT STEPS

1. ✅ Complete Driver ID implementation
2. ✅ Add admin custom pricing feature
3. ✅ Complete Spanish translations
4. ✅ Test both apps compile cleanly
5. ✅ Build User App APK
6. ✅ Build Driver App APK
7. ✅ Create user documentation for Firebase setup

---

## 🎯 TESTING CHECKLIST

### User App
- [ ] Default country code shows +51
- [ ] App language is Spanish
- [ ] Tour icon visible in vehicle selector
- [ ] OTP auto-submits after 4 digits
- [ ] Join Us → Agency opens transportbidder.com
- [ ] Base fare calculations use 2.0 soles/km

### Driver App
- [ ] Default country code shows +51
- [ ] App language is Spanish
- [ ] OTP auto-submits after 6 digits (Firebase) or 4 (backend)
- [ ] Driver ID shows in drawer after signup
- [ ] Email login works
- [ ] App doesn't crash on open

### Admin Panel
- [ ] Can set custom rate per driver
- [ ] Driver list shows custom rates
- [ ] All vehicle types visible

---

## 📝 NOTES

- All changes preserve existing functionality
- No API breaking changes
- No UI redesigns, only bug fixes
- Inline comments added where needed
- Version bumped to 2.0.0+2 in both apps

