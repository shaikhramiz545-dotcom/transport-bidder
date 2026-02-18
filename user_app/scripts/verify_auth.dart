/// Auth verification script – run: dart run scripts/verify_auth.dart
/// Checks Firebase Auth setup without full Flutter runtime.
library;
import 'dart:io';

void main() async {
  print('=== TBidder User App – Auth Verification ===\n');

  final checks = <String, bool>{};

  // 1. Firebase options
  try {
    final f = File('lib/firebase_options.dart');
    if (await f.exists()) {
      final content = await f.readAsString();
      checks['firebase_options.dart exists'] = true;
      checks['Firebase project: transport-bidder'] = content.contains('transport-bidder');
      checks['Web/Android/iOS configs'] = content.contains('web') && content.contains('android') && content.contains('ios');
    } else {
      checks['firebase_options.dart'] = false;
    }
  } catch (e) {
    checks['firebase_options.dart'] = false;
  }

  // 2. Auth service
  try {
    final f = File('lib/services/firebase_auth_service.dart');
    if (await f.exists()) {
      final content = await f.readAsString();
      checks['FirebaseAuthService exists'] = true;
      checks['signInWithEmailPassword'] = content.contains('signInWithEmailAndPassword');
      checks['signInWithGoogle'] = content.contains('signInWithGoogle');
      checks['signInWithApple'] = content.contains('signInWithApple');
      checks['signOut'] = content.contains('signOut');
      checks['authStateChanges'] = content.contains('authStateChanges');
    } else {
      checks['FirebaseAuthService'] = false;
    }
  } catch (e) {
    checks['FirebaseAuthService'] = false;
  }

  // 3. Login screen
  try {
    final f = File('lib/features/auth/login_screen.dart');
    if (await f.exists()) {
      final content = await f.readAsString();
      checks['LoginScreen uses Firebase'] = content.contains('signInWithEmailPassword') && content.contains('FirebaseAuthException');
      checks['Google/Apple buttons'] = content.contains('_loginWithGoogle') && content.contains('_loginWithApple');
    }
  } catch (e) {
    checks['LoginScreen'] = false;
  }

  // 4. Main.dart auth flow
  try {
    final f = File('lib/main.dart');
    if (await f.exists()) {
      final content = await f.readAsString();
      checks['main: Firebase.initializeApp'] = content.contains('Firebase.initializeApp');
      checks['main: authStateChanges StreamBuilder'] = content.contains('authStateChanges') && content.contains('StreamBuilder');
    }
  } catch (e) {
    checks['main.dart'] = false;
  }

  // 5. Google Web Client ID
  try {
    final f = File('lib/services/firebase_auth_service.dart');
    final content = await f.readAsString();
    final hasPlaceholder = content.contains('YOUR_WEB_CLIENT_ID') || content.contains('YOUR_');
    checks['Google Web Client ID configured'] = !hasPlaceholder;
  } catch (_) {
    checks['Google Web Client ID'] = false;
  }

  // Print results
  for (final e in checks.entries) {
    final status = e.value ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m';
    print('  $status ${e.key}');
  }

  final passed = checks.values.where((v) => v).length;
  final total = checks.length;
  print('\n=== Result: $passed/$total checks passed ===\n');

  if (checks['Google Web Client ID configured'] == false) {
    print('⚠ Google Sign-In (Android): firebase_auth_service.dart mein _kGoogleWebClientId set karo.');
    print('  Get from: Google Cloud Console → APIs & Credentials → OAuth 2.0 Client IDs (Web client)\n');
  }

  exit(passed == total ? 0 : 1);
}
