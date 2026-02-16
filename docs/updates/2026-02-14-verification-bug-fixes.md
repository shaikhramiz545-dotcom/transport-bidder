# Driver App Verification Bug Fixes

**Date:** 2026-02-14  
**Version:** 2.2.1+11  
**Type:** Bug Fixes

---

## 🐛 **Issues Fixed**

### **1. Custom Vehicle Brand/Color Input**
- **Issue:** "Otro" (Other) option available but no text field to enter custom name
- **Fix:** Added conditional text fields that appear when "Otro" is selected
- **Impact:** Users can now enter custom brand/color names

### **2. Registration Year Range**
- **Issue:** Limited year range (only last 10 years)
- **Fix:** Extended range from 2010 to 2050 (41 years)
- **Impact:** Supports older vehicles and future registrations

### **3. Passenger Capacity Range**
- **Issue:** Limited capacity options (2, 4, 6, 8, 10, 12, 15, 20)
- **Fix:** Full range from 1 to 25 passengers
- **Impact:** Supports all vehicle types including motorcycles (1) and buses (25)

### **4. DNI Field Positioning**
- **Issue:** DNI issue/expiry dates were in Step 2 (Vehicle Documents)
- **Fix:** Moved DNI dates directly below DNI number field in Step 1 (Personal Info)
- **Impact:** Better UX, logical field grouping

### **5. Mandatory Field Validation**
- **Issue:** System allowed submission without filling mandatory fields
- **Fix:** Added comprehensive validation before submission
- **Validates:**
  - Vehicle Brand (+ custom if "Otro")
  - Vehicle Model
  - Vehicle Color (+ custom if "Otro")
  - Registration Year
  - Passenger Capacity
  - License Class
  - License Issue/Expiry Dates
  - All required documents
- **Impact:** Prevents incomplete submissions

### **6. Custom Brand/Color Submission**
- **Issue:** Custom brand/color not sent to backend when "Otro" selected
- **Fix:** Updated submission logic to use custom values when "Otro" is selected
- **Impact:** Custom vehicle information properly saved

---

## 📋 **Known Issues (Not Fixed Yet)**

### **7. Security Notice After Photo Capture**
- **Issue:** Security notice appears after clicking "Subir" button and after taking photo
- **Status:** Investigating camera permission flow
- **Priority:** HIGH

### **8. Camera Opening Slowly**
- **Issue:** Camera takes time to open
- **Status:** Performance optimization needed
- **Priority:** MEDIUM

### **9. Document Viewer (Ver Button)**
- **Issue:** Clicking "Ver" shows security notice instead of document
- **Status:** Document revision screen needs fix
- **Priority:** HIGH

### **10. Profile Photo Upload**
- **Issue:** Profile photo upload fails, but selfie photo should be used automatically
- **Status:** Need to implement auto-copy selfie to profile
- **Priority:** HIGH

---

## 🔧 **Technical Changes**

### **Files Modified:**
1. `driver_app/lib/features/verification/vehicle_fields_widget.dart`
   - Added "Otro" to color list
   - Changed capacity to generate 1-25
   - Added registration year range 2010-2050

2. `driver_app/lib/features/verification/verification_screen.dart`
   - Added `_customBrandController` and `_customColorController`
   - Added `_showCustomBrand` and `_showCustomColor` state
   - Added conditional custom text fields
   - Moved DNI date fields to Step 1
   - Added mandatory field validation
   - Updated submission to use custom values

3. `driver_app/pubspec.yaml`
   - Version: 2.2.0+10 → 2.2.1+11

---

## ✅ **Testing Checklist**

- [x] Custom brand field appears when "Otro" selected
- [x] Custom color field appears when "Otro" selected
- [x] Registration year shows 2010-2050
- [x] Passenger capacity shows 1-25
- [x] DNI dates positioned below DNI number
- [x] Validation prevents empty submission
- [x] Custom values sent to backend
- [ ] Security notice issue resolved
- [ ] Camera performance improved
- [ ] Document viewer working
- [ ] Profile photo auto-copy from selfie

---

## 🚀 **Next Steps**

1. Fix security notice appearing after photo capture
2. Optimize camera opening performance
3. Fix document viewer (Ver button)
4. Implement auto-copy selfie to profile photo
5. Test all fixes on physical device
6. Build and deploy new APK

---

**Status:** 6/10 issues fixed, 4 remaining
