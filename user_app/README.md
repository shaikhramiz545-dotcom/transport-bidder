# Tbidder User App (Passenger)

Flutter app for passengers. **Cream/Off-White** background, **Neon Orange** accent, **Poppins** typography.

## Theme

- **Background:** `#FDFBF7` (cream)
- **Accent:** `#FF5F00` (neon orange)
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

- `lib/main.dart` — Entry point, `MaterialApp` with theme.
- `lib/core/app_theme.dart` — Light theme (cream + orange + Poppins).

## Auth

- Login: phone number → **Get OTP** → 4-digit OTP → Verify → Home.
- **Dev mock OTP:** `1234`.
- API base URL: `localhost` (iOS/web) or `10.0.2.2` (Android emulator = host). See `lib/core/api_config*.dart`.

## Maps & location

- Home uses a **full-screen Google Map** with a floating **“Where to? / ¿A dónde vas?”** search box and a **recenter** FAB.
- **Android:** Replace `YOUR_API_KEY_HERE` in `android/app/src/main/AndroidManifest.xml` with your [Google Maps API key](https://developers.google.com/maps/documentation/android-sdk/get-api-key). Permissions: `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`.
- **iOS:** `NSLocationWhenInUseUsageDescription` is set in `ios/Runner/Info.plist`. Add your Maps API key per Flutter iOS setup if needed.
- If location permission is denied, a message is shown and the map stays centered on Lima.

## Targets

- `flutter run` — Debug on connected device/emulator.
- `flutter run -d chrome` — Web.
- `flutter run -d windows` — Windows (if enabled).
