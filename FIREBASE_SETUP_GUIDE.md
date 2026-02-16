# Firebase Setup Guide for TransportBidder v2.0.0

This guide explains how to configure Firebase for the TransportBidder apps (User App & Driver App).

## 🔥 CRITICAL: Firebase Index Creation (Password Reset Fix)

The password reset feature shows Firebase errors because composite indexes are missing.

### Create Composite Indexes

1. Go to the **Firebase Console**.
2. Select your **Firebase project** (e.g. Tbidder).
3. Click on **Firestore**.
4. Click on **Indexes**.
5. Click on **Add index**.
6. Create the following composite indexes:
	* **users** collection:
		+ Field 1: **email** (Ascending)
		+ Field 2: **uid** (Ascending)
	* **drivers** collection:
		+ Field 1: **email** (Ascending)
		+ Field 2: **uid** (Ascending)

### Verify Indexes

After creating the indexes, verify that they are active and working correctly.

If you **already installed Git** but still get the error (e.g. in Cursor’s terminal), the terminal was opened **before** Git was installed, so Git is not in PATH.

**Run this once at the start of every PowerShell session** (or restart Cursor):

```powershell
cd "C:\Users\Alexender The Great\Desktop\Tbidder_Project"
. .\fix-terminal-path.ps1
```

This adds both **Git** and **Pub cache bin** (so `flutterfire` works) to PATH for this session.

Then run FlutterFire **inside each Flutter app** (not in project root). For **user_app**:

```powershell
cd user_app
flutterfire configure --project=transport-bidder
```

For **driver_app**:

```powershell
cd ..\driver_app
flutterfire configure --project=transport-bidder
```

You must run `flutterfire configure` from inside `user_app` or `driver_app` (where `pubspec.yaml` and Flutter code live). Running it from `Tbidder_Project` root gives: "The current directory does not appear to be a Flutter application project."

To make Git permanent for all new terminals: **fully close Cursor and open it again** after installing Git, so new terminals get the updated PATH.

---

## Step 1: Install Git (Required – Fixes Your Current Error)

Flutter and FlutterFire CLI need **Git**. Without it you get: `git is not recognized`.

### Option A – Using winget (easiest)
1. Open **PowerShell** as normal user.
2. Run:
   ```powershell
   winget install --id Git.Git -e --source winget
   ```
3. When asked, accept the license (Y).
4. **Close and reopen** your terminal (or Cursor) so that `git` is in PATH.

### Option B – Manual download
1. Go to: **https://git-scm.com/download/win**
2. Download **64-bit Git for Windows Setup**.
3. Run the installer. Keep default options; ensure **"Git from the command line and also from 3rd-party software"** is selected.
4. Finish and **restart your terminal/Cursor**.

### Verify Git
```powershell
git --version
```
You should see something like `git version 2.x.x`.

---

## Step 2: Activate FlutterFire CLI

After Git is in PATH (use **Quick fix** at top if needed):

```powershell
dart pub global activate flutterfire_cli
```

If you get “package not found”, ensure Dart/Flutter is on PATH:

```powershell
flutter doctor
dart pub global activate flutterfire_cli
```

---

## Step 2.5: Install Firebase CLI (required for FlutterFire)

FlutterFire needs the **official Firebase CLI**. If you see "The FlutterFire CLI currently requires the official Firebase CLI to also be installed" or "Found 0 Firebase projects", install it:

```powershell
npm install -g firebase-tools
```

(Requires Node.js/npm. Your backend uses Node.) Verify: `firebase --version`

Then **log in** so FlutterFire can see your Firebase projects (e.g. transport-bidder):

```powershell
firebase login
```

A browser will open; sign in with the same Google account you use in Firebase Console. After that, run `flutterfire configure --project=transport-bidder` again from inside `user_app` or `driver_app`.

---

## Step 3: Create / Use a Firebase Project

### 3.1 Create Firebase account (if you don’t have one)
1. Go to **https://console.firebase.google.com**
2. Sign in with your **Google account**.
3. Click **“Create a project”** (or **“Add project”**).

### 3.2 Create a new project
1. **Project name:** e.g. `Tbidder` or `Tbidder-Dev`
2. Click **Continue**.
3. **Google Analytics:** optional (you can enable later). Click **Create project**.
4. When ready, click **Continue** to open the project.

---

## Step 4: Add Apps to Your Firebase Project

### Android (user_app / driver_app)
1. In Firebase Console, click the **Android** icon.
2. **Android package name:**  
   - User app: e.g. `com.tbidder.user` (check `user_app/android/app/build.gradle` → `applicationId`)  
   - Driver app: e.g. `com.tbidder.driver` (check `driver_app/android/app/build.gradle` → `applicationId`)
3. **App nickname:** e.g. `Tbidder User` / `Tbidder Driver` (optional).
4. **Debug signing certificate SHA-1 (optional for now):** you can add later for Auth/Phone.
5. Click **Register app**.
6. Download **google-services.json** and place it in:
   - User app: `user_app/android/app/google-services.json`
   - Driver app: `driver_app/android/app/google-services.json`
7. Follow the on-screen steps (add Firebase SDK / Gradle plugin). You can do this manually or use FlutterFire CLI in the next step.

### iOS (if you will test on iPhone)
1. In Firebase Console, click the **iOS** icon.
2. **iOS bundle ID:** from Xcode or `ios/Runner.xcodeproj` (e.g. `com.tbidder.user`).
3. Download **GoogleService-Info.plist** and add it to the app in Xcode (e.g. `ios/Runner/GoogleService-Info.plist`).

### Web (if you use Flutter web or admin/agency portals)
1. In Firebase Console, click the **Web** icon (`</>`).
2. **App nickname:** e.g. `Tbidder Web`.
3. Copy the **firebaseConfig** object; you’ll use it in your web app later.

---

## Step 5: Configure Flutter Apps with FlutterFire CLI

From your **project root** (e.g. `C:\Users\Alexender The Great\Desktop\Tbidder_Project`):

```powershell
cd "C:\Users\Alexender The Great\Desktop\Tbidder_Project"
```

### Login to Firebase (first time only)
```powershell
firebase login
```
Or if you use FlutterFire only:
```powershell
dart pub global run flutterfire_cli:flutterfire login
```
Browser will open; sign in with the same Google account used in Firebase Console.

### Configure each Flutter app
**User app:**
```powershell
cd user_app
dart pub global run flutterfire_cli:flutterfire configure
```
- Select your **Firebase project** (e.g. Tbidder).
- Select **platforms** (Android, iOS, Web as needed).
- This creates/updates `lib/firebase_options.dart` and can add `google-services.json` / `GoogleService-Info.plist` for you.

**Driver app:**
```powershell
cd ..\driver_app
dart pub global run flutterfire_cli:flutterfire configure
```
- Same project, select platforms. This configures the driver app.

---

## Step 6: Add Firebase to Your Flutter Project (Dependencies)

If not already added:

**user_app/pubspec.yaml** and **driver_app/pubspec.yaml**:
```yaml
dependencies:
  flutter:
    sdk: flutter
  firebase_core: ^3.6.0
  # Add only what you need, e.g.:
  # firebase_auth: ^5.3.1
  # firebase_messaging: ^15.1.3
```

Then in **main.dart** (before `runApp`):
```dart
import 'package:firebase_core/firebase_core.dart';
import 'firebase_options.dart';  // generated by FlutterFire

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp(
    options: DefaultFirebaseOptions.currentPlatform,
  );
  runApp(MyApp());
}
```

Run:
```powershell
flutter pub get
```

---

## Step 7: Test Run & Verification

### Run on device/emulator
```powershell
cd user_app
flutter run
```
Or for driver app:
```powershell
cd driver_app
flutter run
```

### Verify Firebase connection
- If you use **Firebase Auth**: try sign-in/sign-up; check Firebase Console → Authentication → Users.
- If you use **Cloud Messaging**: send a test notification from Console → Cloud Messaging.
- If you use **Firestore/Realtime Database**: write a test value and see it in Console.

### Common issues
| Issue | Fix |
|-------|-----|
| `git is not recognized` | **Option 1:** In PowerShell run: `$env:Path = "C:\Program Files\Git\bin;$env:Path"` then retry. **Option 2:** In project folder run: `. .\fix-terminal-path.ps1` (dot-space) then retry. **Option 3:** Close Cursor completely and open again so new terminals get Git in PATH. |
| `Android toolchain - cmdline-tools component is missing` | Install [Android Studio](https://developer.android.com/studio) or [command-line tools only](https://developer.android.com/studio#command-line-tools-only). Set `ANDROID_HOME` if needed. Then run `flutter doctor`. |
| `flutterfire_cli` not found | Run `dart pub global activate flutterfire_cli` and ensure Dart global bins are in PATH: `dart pub global activate flutterfire_cli` then use `dart pub global run flutterfire_cli:flutterfire configure`. |
| SHA-1 for Android | Run `cd android && ./gradlew signingReport` (or on Windows `gradlew.bat signingReport`) and add the SHA-1 in Firebase Console → Project settings → Your Android app. |
| Build fails after adding Firebase | Ensure `google-services.json` is in `android/app/` and that `android/build.gradle` has the Google services classpath and `apply plugin: 'com.google.gms.google-services'` in app-level `build.gradle`. |

---

## Quick Checklist

- [ ] Git installed and `git --version` works
- [ ] Terminal/Cursor restarted after installing Git
- [ ] `dart pub global activate flutterfire_cli` runs without error
- [ ] Firebase project created at console.firebase.google.com
- [ ] Android (and optionally iOS/Web) apps added in Firebase Console
- [ ] `firebase login` or `flutterfire login` done
- [ ] `dart pub global run flutterfire_cli:flutterfire configure` run inside `user_app` and `driver_app`
- [ ] `firebase_core` (and other Firebase packages) in `pubspec.yaml`
- [ ] `Firebase.initializeApp()` in `main.dart` with `DefaultFirebaseOptions.currentPlatform`
- [ ] `flutter run` works and app connects to Firebase (test Auth/Messaging/etc.)
- [ ] **Auth:** Firebase Console → Authentication → Anonymous **Enabled**
- [ ] **Push:** Profile screen pe Firebase UID & FCM Token dikh rahe; test message se SnackBar/notification aa rahi (see **Step 8**)

---

## What's ready in the apps (after setup)

- **Firebase Core** – Initialized in `main.dart` with `firebase_options.dart`.
- **Firebase Auth** – Package added; `FirebaseAuthService` in `lib/services/firebase_auth_service.dart` (anonymous sign-in, sign-out, ready for Phone/Email when you add it).
- **Firebase Cloud Messaging (FCM)** – Package added; `FcmService` in `lib/services/fcm_service.dart`:
  - Requests notification permission on start.
  - Gets FCM token (send to backend for targeting).
  - Handles foreground messages and notification tap (background/opened app).
  - Background handler registered in `main.dart`.
- **Android** – `POST_NOTIFICATIONS` added for Android 13+.

**Next:** In Firebase Console enable **Cloud Messaging** and **Authentication (Anonymous)**. Backend can send FCM using the token you get from `FcmService().getToken()`.

---

## Step 8: Test Auth & Push Notifications (Step by Step)

Yeh section batata hai ki **Firebase Authentication (Anonymous)** aur **Push Notifications (FCM)** ko kaise enable karein aur app se kaise test karein.

### 8.1 Firebase Console – Authentication enable karein

1. **Firebase Console** kholen: https://console.firebase.google.com  
2. Apna project select karein (e.g. Tbidder / transport-bidder).  
3. Left sidebar se **Build → Authentication** pe jayein.  
4. **Get started** pe click karein (agar pehle enable nahi kiya).  
5. **Sign-in method** tab pe jayein.  
6. **Anonymous** provider ko enable karein:
   - List mein **Anonymous** pe click karein.  
   - Toggle **Enable** karein.  
   - **Save** karein.

Ab app Anonymous sign-in use karti hai; Profile screen pe **Firebase UID** dikhega.

### 8.2 Firebase Console – Cloud Messaging (FCM) ready

- **Cloud Messaging** Firebase project ke saath by default enabled hota hai.  
- Koi extra step zaroori nahi; bas **Project settings → Cloud Messaging** se server key / credentials dekh sakte hain (backend ke liye).  
- Test notification bhejne ke liye **Step 8.4** use karein.

### 8.3 App mein Auth & FCM token dekhna

**User app:**

1. `cd user_app` → `flutter run` (device/emulator pe).  
2. Login karein (agar flow hai) aur **menu (☰) → Profile** open karein.  
3. Neeche **Firebase & Push (testing)** section mein:
   - **Firebase UID** – Anonymous user ka ID (Auth test).  
   - **FCM Token** – pehle ~40 chars dikhenge; **copy icon** pe tap karke **pura token** clipboard mein copy ho jata hai.

**Driver app:**

1. `cd driver_app` → `flutter run`.  
2. Login karein, **menu → Profile** open karein.  
3. Same **Firebase & Push (testing)** section: **Firebase UID** aur **FCM Token** (copy icon se pura token copy karein).

**Verify Auth:**  
- UID **—** ya blank nahi hona chahiye; kuch alphanumeric string honi chahiye (Anonymous sign-in successful).

### 8.4 Push notification test karna (single device)

1. **FCM token copy karein** (Profile → FCM Token → copy icon).  
2. Firebase Console → **Build → Engage → Messaging** (ya **Cloud Messaging**).  
3. **Create your first campaign** / **New campaign** → **Firebase Notification messages**.  
4. **Notification title** aur **Notification text** likhen (e.g. "Test", "Hello from Firebase").  
5. **Send test message** (ya **Test on device**) pe click karein.  
6. **FCM registration token** field mein wahi token paste karein jo app se copy kiya.  
7. **Test** pe click karein.

**Expected:**

- **App foreground (open):** Neeche **SnackBar** mein message dikhna chahiye (e.g. "Test: Hello from Firebase").  
- **App background/minimized:** Device pe system notification aani chahiye.  
- **App closed:** Bhi system notification aani chahiye.

### 8.5 Agar notification nahi aaye

| Problem | Check |
|--------|--------|
| Token copy nahi ho raha | Profile pe FCM row pe **copy icon** tap karein; "Copied to clipboard" SnackBar aana chahiye. |
| Foreground mein SnackBar nahi | `main.dart` mein `FcmService.onForegroundMessage` set hai aur `scaffoldMessengerKey` use ho raha hai – dubara run karein. |
| Background/closed mein notification nahi | Android: App notification permission on honi chahiye (Settings → Apps → your app → Notifications). |
| "Invalid token" | Naya token lo (app restart / reinstall), Profile se copy karke phir se test message bhejen. |

### 8.6 Short checklist (Auth + Push)

- [ ] Firebase Console → Authentication → Anonymous **Enabled**
- [ ] User app: Profile open → Firebase UID dikh raha (blank nahi)
- [ ] Driver app: Profile open → Firebase UID dikh raha (blank nahi)
- [ ] Dono apps: Profile → FCM Token copy ho raha
- [ ] Firebase Console → Messaging → Test message → token paste → **Test**
- [ ] App open rehne pe test bhejne par SnackBar dikh raha
- [ ] App background pe test bhejne par system notification aa rahi
