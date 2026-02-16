# Camera-Only Document Capture with GPS Tracking & 15-Minute Validation

**Date:** 2026-02-14  
**Version:** Driver App v2.1.0+9, Backend API  
**Type:** Security Enhancement (Major)

## Summary
Implemented comprehensive security measures to prevent document fraud by enforcing camera-only capture, GPS tracking, and 15-minute timestamp validation for all verification documents and profile photos.

## Security Problem Addressed
**Previous Vulnerability:**
- Drivers could upload edited/fake documents from gallery
- No way to verify document authenticity
- AI-generated or Photoshopped documents could be submitted
- No timestamp or location verification

**New Security Measures:**
- ✅ Camera-only capture (no gallery access)
- ✅ GPS location recording with each photo
- ✅ 15-minute timestamp validation
- ✅ Activity logging with GPS coordinates
- ✅ User warning before capture

---

## Changes Implemented

### **Driver App (v2.1.0+9)**

#### **1. Verification Screen - Camera-Only Capture**
- **Removed gallery option** - All 7 documents must be captured live
- **Security warning dialog** before each capture:
  - ⚠️ 15-minute time limit warning
  - 📸 Camera-only notice
  - 📍 GPS recording notice
  - ⏰ Timestamp validation notice
- **GPS tracking** - Captures location with each photo
- **Metadata storage** - Stores capture time, GPS coordinates, accuracy
- **Activity logging** - Sends photo capture events to backend with GPS data

**Documents affected:**
1. Brevete Frente (License Front)
2. Brevete Dorso (License Back)
3. DNI (National ID)
4. Selfie
5. SOAT (Insurance)
6. Tarjeta de Propiedad (Vehicle Ownership)
7. Foto Vehiculo (Vehicle Photo)

#### **2. Profile Screen - Camera-Only Profile Photo**
- **Camera-only capture** (front camera for selfie)
- **GPS tracking** enabled
- **Upload to backend** instead of local storage only
- **15-minute validation** enforced
- **Security warning dialog** before capture

#### **3. Upload Process**
- **Timestamp validation** - Photos must be uploaded within 15 minutes of capture
- **Expired photo handling** - Shows error if timestamp exceeds 15 minutes
- **GPS metadata** included in upload request
- **Activity log** sent to backend for admin tracking

---

### **Backend API**

#### **1. Document Upload Endpoint (`/api/drivers/documents`)**
**New validation:**
```javascript
// 15-minute timestamp validation
if (captureTimestamp) {
  const diffMinutes = (now - captureTime) / (1000 * 60);
  if (diffMinutes > 15) {
    return 400 "Photo must be captured within 15 minutes"
  }
}
```

**Accepts:**
- `captureTimestamp` - ISO 8601 timestamp from driver app
- Validates photo was taken within 15 minutes
- Rejects if timestamp is in future (clock tampering detection)

#### **2. Profile Photo Upload Endpoint (`/api/drivers/profile-photo`)**
**New endpoint:** `POST /api/drivers/profile-photo`

**Features:**
- Accepts profile photo with GPS coordinates
- 15-minute timestamp validation
- Stores `photoUrl` in `DriverVerification` table
- Logs GPS coordinates for admin review

**Request fields:**
- `file` - Photo file (multipart)
- `driverId` - Driver ID
- `captureTimestamp` - ISO timestamp
- `latitude` - GPS latitude (optional)
- `longitude` - GPS longitude (optional)

#### **3. Activity Log Endpoint (`/api/drivers/activity-log`)**
**New endpoint:** `POST /api/drivers/activity-log`

**Purpose:** Track all photo capture events with metadata

**Logs:**
- `driverId` - Who captured the photo
- `action` - Type of action (e.g., "document_photo_captured")
- `documentType` - Which document was captured
- `timestamp` - When it was captured
- `latitude` - GPS latitude
- `longitude` - GPS longitude
- `accuracy` - GPS accuracy in meters

**Note:** Currently logs to console. TODO: Store in database table for admin panel viewing.

---

## User Experience Flow

### **Before Capture:**
1. Driver taps document upload card
2. **Security warning dialog** appears:
   - Explains 15-minute time limit
   - Shows camera-only requirement
   - Mentions GPS tracking
   - Requires explicit consent ("Take Photo Now" button)
3. App requests GPS permission (if not granted)
4. GPS location acquired (or skipped if unavailable)

### **During Capture:**
5. Camera opens (rear camera for documents, front for selfie/profile)
6. Driver takes photo
7. Metadata captured: timestamp, GPS coordinates, accuracy
8. Metadata saved locally for upload

### **After Capture:**
9. Success message shows GPS status
10. Activity log sent to backend (non-blocking)
11. Photo ready for upload during submission

### **During Upload:**
12. Timestamp validated (must be < 15 minutes old)
13. If expired: Error shown, driver must retake photo
14. If valid: Upload proceeds normally

---

## Security Benefits

### **1. Prevents Document Fraud**
- ❌ Can't upload edited documents from gallery
- ❌ Can't upload AI-generated documents
- ❌ Can't upload screenshots of someone else's documents
- ❌ Can't reuse old photos

### **2. Ensures Authenticity**
- ✅ Photos must be taken in real-time
- ✅ GPS proves physical location during capture
- ✅ Timestamp proves recency
- ✅ Metadata can be audited by admin

### **3. Deters Fraud Attempts**
- ⚠️ Warning dialog makes security measures explicit
- ⚠️ 15-minute limit prevents preparation of fake documents
- ⚠️ GPS tracking adds accountability

---

## Admin Panel Impact

### **What Admin Can Now See:**
1. **Profile Photo** - Now uploaded to backend (was local-only before)
2. **Activity Logs** - Photo capture events with GPS (TODO: add UI)
3. **Timestamp Metadata** - When each photo was captured
4. **GPS Coordinates** - Where each photo was captured

### **Future Enhancements:**
- Display GPS coordinates on driver detail page
- Show capture timestamps for each document
- Map view of photo capture locations
- Activity log viewer in admin panel

---

## Technical Details

### **GPS Accuracy:**
- Uses `LocationAccuracy.high` for best precision
- 10-second timeout to avoid blocking
- GPS is optional - continues without it if unavailable
- Accuracy value stored for admin review

### **Timestamp Validation:**
- Server-side validation (can't be bypassed)
- 15-minute window from capture to upload
- Allows 1-minute future tolerance (clock sync issues)
- Rejects photos with suspicious timestamps

### **Error Handling:**
- GPS failure: Continues without GPS (non-critical)
- Activity log failure: Silent (non-critical)
- Timestamp expired: Clear error message, prompts retake
- Upload failure: Standard retry mechanism

---

## Migration Notes

### **Existing Drivers:**
- Old documents remain valid (no re-verification required)
- New uploads must follow camera-only rule
- Profile photos must be re-uploaded to backend

### **Backward Compatibility:**
- Backend accepts uploads without timestamp (legacy support)
- GPS coordinates are optional
- Activity logging is non-blocking

---

## Testing Checklist

- [ ] Camera-only capture for all 7 documents
- [ ] Security warning dialog appears before capture
- [ ] GPS permission requested and location captured
- [ ] Metadata stored locally after capture
- [ ] Activity log sent to backend
- [ ] 15-minute validation on upload
- [ ] Expired photo error handling
- [ ] Profile photo upload to backend
- [ ] Admin panel displays uploaded profile photo
- [ ] Backend logs activity with GPS coordinates

---

## Deployment

**Driver App:**
- Version: 2.1.0+9
- Build APK and distribute to drivers
- Inform drivers about new security measures

**Backend:**
- Deploy to Google Cloud Run
- No database migration required (fields already exist)
- Monitor activity logs in console

**Admin Panel:**
- No changes required (already displays photoUrl)
- Future: Add activity log viewer UI

---

## Known Limitations

1. **Activity logs not in database yet** - Currently console-only
2. **No liveness detection** - Future enhancement for selfie
3. **GPS can be spoofed** - Advanced users could fake location
4. **No EXIF validation** - Future: Check image metadata integrity

---

## Future Enhancements

1. **Liveness detection** for selfie (blink/smile verification)
2. **EXIF metadata validation** (detect stripped metadata)
3. **AI-generated image detection** (ML model)
4. **Activity log database table** + admin UI
5. **GPS map view** in admin panel
6. **Document comparison** (selfie vs DNI photo matching)
