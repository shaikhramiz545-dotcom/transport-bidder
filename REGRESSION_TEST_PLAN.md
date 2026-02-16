# Regression Test Plan – Admin Panel & Backend Fixes

## 1. Driver Registration & Profile Updates

### 1.1 Verification Register (POST /api/drivers/verification-register)
- **Payload**: Include city, dni, license, soatExpiry, vehicleBrand, vehicleModel, vehicleColor, registrationYear, vehicleCapacity, licenseClass, licenseIssueDate, licenseExpiryDate, dniIssueDate, dniExpiryDate, engineNumber, chassisNumber, photoUrl/selfieUrl
- **Expected**: All fields persisted to PostgreSQL and Firestore
- **Check**: Admin panel driver list and detail show all fields correctly

### 1.2 SOAT Metadata Sync
- **Scenario**: Submit SOAT metadata without SOAT URL
- **Expected**: Existing SOAT document record updated with issueDate, expiryDate, policyNumber, insuranceCompany, certificateNumber, inspectionCenter
- **Check**: Documents API returns updated metadata

### 1.3 Document Upload (POST /api/drivers/documents)
- **Payload**: File + documentType + metadata fields (issueDate, expiryDate, policyNumber, insuranceCompany, certificateNumber, inspectionCenter)
- **Expected**: All metadata persisted
- **Check**: Documents API returns metadata fields

### 1.4 Profile Photo Upload (POST /api/drivers/profile-photo)
- **Payload**: File + optional captureTimestamp + GPS
- **Expected**: photoUrl updated in DriverVerification and selfie document record
- **Check**: Admin panel shows driver photo

## 2. Admin Panel API Contract

### 2.1 Driver List (GET /api/admin/drivers)
- **Expected Fields**: id, driverId, status, vehicleType, vehiclePlate, driverName, email, blockReason, city, dni, license, licenseNumber, vehicleBrand, vehicleModel, vehicleColor, registrationYear, vehicleCapacity, phone, updatedAt, createdAt, documentsCount, photoUrl, rating
- **Check**: All fields present and non-null where applicable

### 2.2 Driver Detail (GET /api/admin/drivers/:id)
- **Expected Fields**: All list fields + adminNotes, customRatePerKm, hasAntecedentesPoliciales, hasAntecedentesPenales, licenseClass, licenseIssueDate, licenseExpiryDate, dniIssueDate, dniExpiryDate, engineNumber, chassisNumber, selfieUrl, documentUrls (with all 7 types), soatIssueDate, soatExpiry, photoUrl
- **Check**: Document URLs populated from DriverDocument table; fallback to driver.documentUrls if empty

### 2.3 Driver Documents (GET /api/admin/drivers/:id/documents)
- **Expected Fields**: id, documentType, fileUrl, fileName, issueDate, expiryDate, policyNumber, insuranceCompany, createdAt
- **Check**: SOAT metadata returned for SOAT documents

## 3. Admin UI Rendering

### 3.1 Driver Photos
- **Check**: Photos render correctly with proper aspect ratio (no blur)
- **Check**: Fallback to initial when photoUrl missing

### 3.2 Field Bindings
- **Check**: DNI, city, license, vehicle details, SOAT issue/expiry display correctly
- **Check**: Aliases handled (licenseNumber vs license)

### 3.3 Document Gallery
- **Check**: Documents list populated from API; fallback to driver.documentUrls
- **Check**: Document thumbnails render correctly

## 4. Firestore Fallback

### 4.1 Admin APIs
- **Scenario**: PostgreSQL unavailable
- **Expected**: Firestore fallback returns same contract structure
- **Check**: All fields present including documentUrls and SOAT dates

### 4.2 Driver Profile
- **Scenario**: PostgreSQL unavailable
- **Expected**: Firestore path returns full profile fields
- **Check**: All verification fields present

## 5. Edge Cases

### 5.1 Timestamp Validation
- **Scenario**: Upload with old/future captureTimestamp
- **Expected**: Warnings logged; upload not blocked
- **Check**: Document/photo uploaded successfully

### 5.2 Reupload Restrictions
- **Scenario**: Driver pending verification without reupload request
- **Expected**: Upload allowed (minimal fix)
- **Check**: Document uploaded successfully

### 5.3 Duplicate Vehicle Plate
- **Scenario**: Two drivers with same plate
- **Expected**: Second driver set to temp_blocked
- **Check**: Admin panel shows blocked status

## 6. Performance & Monitoring

### 6.1 API Response Times
- **Check**: Admin driver list < 2s for 100 drivers
- **Check**: Driver detail < 500ms

### 6.2 Error Handling
- **Check**: Graceful fallback when Firestore unavailable
- **Check**: Admin panel shows error messages appropriately

## 7. Data Consistency

### 7.1 Cross-DB Sync
- **Check**: DriverVerification updates reflected in both PostgreSQL and Firestore
- **Check**: Document metadata consistent across databases

### 7.2 Selfie Photo Sync
- **Check**: Selfie URL synchronized between DriverDocument, DriverVerification, and Firestore
- **Check**: Admin panel shows consistent photo

## Test Data

### Sample Driver Registration Payload
```json
{
  "driverId": "TEST_DRIVER_001",
  "vehiclePlate": "ABC123",
  "driverName": "Test Driver",
  "email": "test@example.com",
  "city": "Lima",
  "dni": "12345678",
  "license": "A123456",
  "vehicleBrand": "Toyota",
  "vehicleModel": "Corolla",
  "vehicleColor": "Blue",
  "registrationYear": 2020,
  "vehicleCapacity": 4,
  "licenseClass": "A",
  "licenseIssueDate": "2020-01-01",
  "licenseExpiryDate": "2025-01-01",
  "dniIssueDate": "2020-01-01",
  "dniExpiryDate": "2025-01-01",
  "engineNumber": "ENG123",
  "chassisNumber": "CHS123",
  "soatExpiry": "2024-12-31",
  "soatIssueDate": "2023-01-01",
  "soatPolicyNumber": "POL123",
  "soatInsuranceCompany": "Seguros SA",
  "soatCertificateNumber": "CERT123",
  "soatInspectionCenter": "Centro Inspección",
  "photoUrl": "/uploads/driver-docs/TEST_DRIVER_001/selfie.jpg"
}
```

### Sample Document Upload
- **File**: Any image file
- **Form Data**:
  - driverId: TEST_DRIVER_001
  - documentType: soat
  - issueDate: 2023-01-01
  - expiryDate: 2024-12-31
  - policyNumber: POL123
  - insuranceCompany: Seguros SA
  - certificateNumber: CERT123
  - inspectionCenter: Centro Inspección

## Automation Scripts

### API Contract Test
```bash
# Test driver registration
curl -X POST http://localhost:3000/api/drivers/verification-register \
  -H "Content-Type: application/json" \
  -d @test_driver_payload.json

# Test admin driver list
curl -X GET http://localhost:3000/api/admin/drivers \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Test admin driver detail
curl -X GET http://localhost:3000/api/admin/drivers/TEST_DRIVER_001 \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### Database Consistency Check
```sql
-- Check driver verification records
SELECT driverId, city, dni, license, vehicleBrand, vehicleModel, vehicleColor, registrationYear, vehicleCapacity, licenseClass, licenseIssueDate, licenseExpiryDate, dniIssueDate, dniExpiryDate, engineNumber, chassisNumber, photoUrl
FROM DriverVerifications
WHERE driverId = 'TEST_DRIVER_001';

-- Check document metadata
SELECT documentType, issueDate, expiryDate, policyNumber, insuranceCompany, certificateNumber, inspectionCenter
FROM DriverDocuments
WHERE driverId = 'TEST_DRIVER_001';
```

## Success Criteria

1. All driver fields persisted and displayed correctly
2. SOAT metadata updates work without URL re-upload
3. Admin panel renders photos without blur
4. Document gallery shows all uploaded documents
5. Firestore fallback maintains same API contract
6. Cross-DB data consistency maintained
7. No blocking timestamp validation
8. Graceful error handling and fallbacks
