# Firebase – Google & Apple Sign-In Setup

User App mein Google aur Apple sign-in ke liye Firebase Console aur required configuration.

---

## 1. Firebase Console – Sign-in Methods

### Google (pehle se enable hai ✓)
- Firebase Console → **Authentication** → **Sign-in method**
- **Google** → **Enabled**

### Apple Enable karo
1. **Authentication** → **Sign-in method**
2. **Apple** row par click karo
3. **Enable** toggle ON karo
4. **Save**

---

## 2. Google Sign-In – Web Client ID (Android ke liye)

Android par Google Sign-In ke liye **Web Client ID** chahiye.

### Kaise milega
1. [Google Cloud Console](https://console.cloud.google.com/) kholo
2. Project select karo: **transport-bidder** (ya jo Firebase project hai)
3. **APIs & Services** → **Credentials**
4. **OAuth 2.0 Client IDs** mein **Web client** dhundho  
   (Firebase ne enable karte waqt auto-create kiya hoga)
5. Client ID copy karo – format: `327333558755-xxxxxxxx.apps.googleusercontent.com`

### Code mein set karo
`user_app/lib/services/firebase_auth_service.dart` mein line 7:

```dart
const String _kGoogleWebClientId = 'APNA_WEB_CLIENT_ID.apps.googleusercontent.com';
```

Replace `APNA_WEB_CLIENT_ID` with actual value.

---

## 3. Apple Sign-In – Web Configuration

Web par Apple Sign-In ke liye redirect URL configure karo.

### Firebase Auth Handler URL
```
https://transport-bidder.firebaseapp.com/__/auth/handler
```

### Apple Developer Console
1. [Apple Developer](https://developer.apple.com/account/) → Sign In with Apple
2. **Services IDs** mein naya service banao (ya existing edit karo)
3. **Return URLs** mein add karo:
   ```
   https://transport-bidder.firebaseapp.com/__/auth/handler
   ```
4. **Domains** mein add karo: `transport-bidder.firebaseapp.com`

### iOS / macOS
- Xcode → Target → **Signing & Capabilities** → **Sign in with Apple** add karo
- Provisioning profile refresh karo

---

## 4. Summary Checklist

| Step | Action |
|------|--------|
| ☐ | Firebase: Google sign-in enabled |
| ☐ | Firebase: Apple sign-in enabled |
| ☐ | Google Cloud: Web Client ID copy kiya |
| ☐ | `firebase_auth_service.dart` mein `_kGoogleWebClientId` set kiya |
| ☐ | (Web) Apple: Return URL + Domain add kiye |
| ☐ | (iOS) Xcode: Sign in with Apple capability add ki |

---

## 5. Test

- **Email/Password** – pehle se chal raha hai
- **Continue with Google** – tap karo, Google account select karo
- **Continue with Apple** – tap karo, Face ID / Apple ID se sign in
