# iOS Audit & Bug Fixes

- **Date:** 2026-02-14
- **Scope:** driver_app | user_app
- **Type:** bugfix

## Summary

- Added missing `NSPhotoLibraryUsageDescription` and `NSCameraUsageDescription` to both apps' Info.plist (crash fix for image_picker on iOS)
- Added `remote-notification` and `fetch` to `UIBackgroundModes` in both apps for push notifications on iOS
- Created `Runner.entitlements` for both apps (push notifications + Sign in with Apple for user_app)
- Created missing iOS storyboards (`Main.storyboard`, `LaunchScreen.storyboard`) and `Assets.xcassets` for driver_app

## Why

- **Critical crash**: Without `NSPhotoLibraryUsageDescription`, iOS terminates the app immediately when the user tries to pick a photo (profile photo upload, document upload). Both apps use `image_picker` but had no iOS photo library permission string.
- **Push notifications broken on iOS**: `UIBackgroundModes` only had `location` — missing `remote-notification` means FCM push notifications silently fail on iOS.
- **Sign in with Apple**: User app uses `sign_in_with_apple` plugin but had no entitlements file — Apple Sign In would fail on iOS devices.
- **Driver app iOS unbuildable**: Missing storyboards and asset catalog referenced by Info.plist.

## Files Changed

- `driver_app/ios/Runner/Info.plist` — added photo/camera permissions, push notification background modes
- `user_app/ios/Runner/Info.plist` — added photo/camera permissions, push notification background modes
- `driver_app/ios/Runner/Runner.entitlements` — new file (push notifications)
- `user_app/ios/Runner/Runner.entitlements` — new file (push notifications + Sign in with Apple)
- `driver_app/ios/Runner/Base.lproj/Main.storyboard` — new file
- `driver_app/ios/Runner/Base.lproj/LaunchScreen.storyboard` — new file
- `driver_app/ios/Runner/Assets.xcassets/AppIcon.appiconset/Contents.json` — new file

## Version Bumps

- **Flutter (driver_app):** `pubspec.yaml` version: 2.0.2+6 → 2.0.2+7 (bumped in previous changeset)
- **Flutter (user_app):** `pubspec.yaml` version: 2.0.0+4 → 2.0.0+5

## Manual Steps Required (cannot be done from code)

1. **Driver app missing `Runner.xcodeproj`**: Run `flutter create .` inside `driver_app/` on a Mac to regenerate the Xcode project
2. **Both apps missing `GoogleService-Info.plist`**: Download from Firebase Console → Project Settings → iOS apps → download `GoogleService-Info.plist` and place in `ios/Runner/`
3. **Driver app `iosBundleId`**: Verify `iosBundleId: 'Tbidder'` in `firebase_options.dart` matches the actual bundle ID in Xcode and Firebase Console (should be reverse-domain like `com.tbidder.driverApp`)
4. **Icon images**: Run `flutter pub run flutter_launcher_icons` on a Mac to generate iOS app icon PNGs from the logo asset
5. **Sign in with Apple**: Enable "Sign in with Apple" capability in Xcode for the user_app target, and configure in Apple Developer Portal
