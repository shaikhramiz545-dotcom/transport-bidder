# Driver App - Antecedentes Questions Added

**Date:** 2026-02-14  
**App:** Driver App  
**Version:** 2.0.2+6  

## Changes Made

### New Features
- Added yes/no buttons for antecedentes questions in the verification tab
- Questions appear after the DNI field in Step 1 (Personal Documents)
- Two new questions added:
  - "¿Tienes -Antecedentes policiales?" (Do you have police records?)
  - "¿Tienes -Antecedentes penales?" (Do you have criminal records?)

### Technical Implementation
- Added state variables `_hasAntecedentesPoliciales` and `_hasAntecedentesPenales`
- Created `_yesNoButtonGroup` helper method for consistent UI
- Added translation strings in `app_locale.dart`:
  - `verification_antecedentes_policiales`
  - `verification_antecedentes_penales`
  - `verification_yes`
  - `verification_no`
- Modified `_buildStep1` method to include antecedentes questions between DNI and Selfie fields

### UI/UX
- Yes/No buttons use app theme colors (neon orange)
- Consistent styling with existing verification cards
- Proper spacing and layout integration
- Spanish language support as requested

## Files Modified
- `lib/features/verification/verification_screen.dart` - Main implementation
- `lib/l10n/app_locale.dart` - Translation strings
- `pubspec.yaml` - Version bump

## Testing
- Verify buttons appear correctly after DNI field
- Test yes/no selection functionality
- Confirm proper state management
- Validate Spanish text display
