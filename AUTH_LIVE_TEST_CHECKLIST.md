# TBidder User App – Auth Live Test Checklist

Auth sahi se connect hai aur live testing ke liye ye steps follow karo.

---

## 1. Pre-Flight Check (Code)

| Item | Status | Notes |
|------|--------|-------|
| Firebase init | ✓ | main.dart – Firebase.initializeApp |
| Auth state routing | ✓ | StreamBuilder → LoginScreen / HomeScreen |
| Email/Password login | ✓ | signInWithEmailPassword |
| Email/Password signup | ✓ | createUserWithEmailAndPassword |
| Google sign-in | ✓ | signInWithGoogle |
| Apple sign-in | ✓ | signInWithApple |
| Logout | ✓ | Drawer → signOut + navigate to Login |
| Error handling | ✓ | FirebaseAuthException, SnackBar |
| Profile sync | ✓ | Email saved to ProfileStorageService |

---

## 2. Firebase Console (Required)

| Provider | Enable? | Where |
|----------|---------|-------|
| **Email/Password** | ☐ | Authentication → Sign-in method |
| **Google** | ☐ | Authentication → Sign-in method |
| **Apple** | ☐ | Authentication → Sign-in method |

---

## 3. Google Sign-In (Android) – Web Client ID

Agar **Android** par Google sign-in use karoge:

1. [Google Cloud Console](https://console.cloud.google.com/) → project **transport-bidder**
2. **APIs & Services** → **Credentials** → **OAuth 2.0 Client IDs**
3. **Web client** ka Client ID copy karo
4. `user_app/lib/services/firebase_auth_service.dart` line 7:
   ```dart
   const String _kGoogleWebClientId = 'YOUR_ACTUAL_ID.apps.googleusercontent.com';
   ```

**Web / iOS:** Bina Web Client ID bhi chal sakta hai (platform-specific config use hota hai).

---

## 4. Live Test Steps

### A. Email/Password

1. App run karo: `flutter run -d chrome` (ya device)
2. **Create Account** → Name, Email, Phone, Password bharo → Create
3. Home screen dikhna chahiye
4. Drawer → Logout → Login screen wapas
5. **Login** → same email/password → Home screen

### B. Google (Web / Android / iOS)

1. **Continue with Google** tap karo
2. Google account select karo
3. Home screen dikhna chahiye
4. Logout → Login → phir se Google se login

### C. Apple (iOS / Web)

1. **Continue with Apple** tap karo
2. Face ID / Apple ID se sign in
3. Home screen dikhna chahiye

### D. Session Persistence

1. Login karo (kisi bhi method se)
2. App **fully close** karo (swipe away)
3. App dobara open karo → **seedha HomeScreen** (Login screen nahi)

---

## 5. Common Errors

| Error | Fix |
|-------|-----|
| `operation-not-allowed` | Firebase Console mein woh provider Enable karo |
| `invalid-api-key` | firebase_options.dart / google-services.json sahi project se hai? |
| `idToken null` (Google) | Android: Web Client ID set karo |
| `network-request-failed` | Internet / firewall check karo |
| Web: CORS / redirect | Firebase Auth domain: transport-bidder.firebaseapp.com |

---

## 6. Quick Verify Command

```bash
cd user_app
dart run scripts/verify_auth.dart
```

Yeh script code-level checks karega (Firebase config, auth methods, etc.).
