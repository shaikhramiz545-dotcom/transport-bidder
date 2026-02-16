# Tbidder Driver App (Partner)

Flutter app for drivers. **Dark** background (`#1A1A1A`), **Neon Orange** (`#FF5F00`) for text/buttons, **Poppins** typography.

## Theme

- **Background:** `#1A1A1A` (dark)
- **Accent / Buttons / Key text:** `#FF5F00` (neon orange)
- **Font:** Poppins (Google Fonts)

## Setup

1. Install [Flutter SDK](https://docs.flutter.dev/get-started/install) and add it to `PATH`.
2. Ensure `android/local.properties` exists with `sdk.dir` set to your Flutter SDK path.  
   Run `flutter pub get` from this directory — Flutter creates/updates `local.properties` automatically.
3. Install dependencies and run:

   ```bash
   flutter pub get
   flutter run
   ```

## Structure

- `lib/main.dart` — Entry point, `MaterialApp` with dark theme.
- `lib/core/app_theme.dart` — Dark theme (dark bg + orange + Poppins).

## Auth

- Login: phone number → **Login to Earn** → 4-digit OTP → Verify → Home.
- **Dev mock OTP:** `1234`.
- API base URL: `localhost` (iOS/web) or `10.0.2.2` (Android emulator). See `lib/core/api_config*.dart`.

## Maps & location

- Home uses a **full-screen Google Map** and a bottom **“Go Online”** toggle. Offline: grey “You are Offline”, map dimmed; Online: neon orange “You are Online”, map bright.
- **Android:** Replace `YOUR_API_KEY_HERE` in `android/app/src/main/AndroidManifest.xml` with your [Google Maps API key](https://developers.google.com/maps/documentation/android-sdk/get-api-key). Permissions: `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`.
- **iOS:** `NSLocationWhenInUseUsageDescription` in `ios/Runner/Info.plist`. Add Maps API key per Flutter iOS setup if needed.
- Permission denied is handled gracefully (message shown, map centered on Lima).

## Targets

- `flutter run` — Debug on connected device/emulator.
- `flutter run -d chrome` — Web.
- `flutter run -d windows` — Windows (if enabled).
