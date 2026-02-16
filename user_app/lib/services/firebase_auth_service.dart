import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:google_sign_in/google_sign_in.dart';
import 'package:sign_in_with_apple/sign_in_with_apple.dart';

/// Web Client ID for Google Sign-In. Get from: Google Cloud Console → APIs & Credentials → OAuth 2.0 Client IDs (Web client).
/// Format: XXXXX-XXXXX.apps.googleusercontent.com
const String _kGoogleWebClientId = '327333558755-d4u13t1ollr29l2de1khr726pemd4j5c.apps.googleusercontent.com';

/// Firebase Auth helper – Email/Password, Google, Apple, Phone, Anonymous.
class FirebaseAuthService {
  final FirebaseAuth _auth = FirebaseAuth.instance;

  User? get currentUser => _auth.currentUser;
  String? get uid => _auth.currentUser?.uid;
  String? get email => _auth.currentUser?.email;
  String? get displayName => _auth.currentUser?.displayName;
  String? get photoURL => _auth.currentUser?.photoURL;
  String? get phoneNumber => _auth.currentUser?.phoneNumber;

  Stream<User?> get authStateChanges => _auth.authStateChanges();

  /// Sign in with Google.
  Future<void> signInWithGoogle() async {
    // For web, use Firebase's GoogleAuthProvider directly
    if (kIsWeb) {
      final googleProvider = GoogleAuthProvider();
      googleProvider.addScope('email');
      googleProvider.addScope('profile');
      if (_kGoogleWebClientId.isNotEmpty && !_kGoogleWebClientId.contains('YOUR_')) {
        googleProvider.setCustomParameters({
          'client_id': _kGoogleWebClientId,
        });
      }
      await _auth.signInWithPopup(googleProvider);
    } else {
      // For mobile apps
      final googleSignIn = GoogleSignIn(
        serverClientId: _kGoogleWebClientId.contains('YOUR_') ? null : _kGoogleWebClientId,
      );
      final GoogleSignInAccount? googleUser = await googleSignIn.signIn();
      if (googleUser == null) throw FirebaseAuthException(code: 'cancelled', message: 'Sign in cancelled');
      final GoogleSignInAuthentication googleAuth = await googleUser.authentication;
      final credential = GoogleAuthProvider.credential(
        idToken: googleAuth.idToken,
        accessToken: googleAuth.accessToken,
      );
      await _auth.signInWithCredential(credential);
    }
  }

  /// Sign in with Apple. Works on iOS, macOS, Android, Web.
  /// For Web: Apple Developer Console mein redirect URL add karo: https://transport-bidder.firebaseapp.com/__/auth/handler
  Future<void> signInWithApple() async {
    if (kIsWeb) {
      // For web, use Firebase's OAuthProvider directly
      final appleProvider = OAuthProvider('apple.com');
      appleProvider.addScope('email');
      appleProvider.addScope('name');
      await _auth.signInWithPopup(appleProvider);
    } else {
      // For mobile apps
      final appleCredential = await SignInWithApple.getAppleIDCredential(
        scopes: [
          AppleIDAuthorizationScopes.email,
          AppleIDAuthorizationScopes.fullName,
        ],
      );
      final oauthCredential = OAuthProvider('apple.com').credential(
        idToken: appleCredential.identityToken,
        accessToken: appleCredential.authorizationCode,
      );
      await _auth.signInWithCredential(oauthCredential);
    }
  }

  /// Sign in with email and password.
  Future<void> signInWithEmailPassword({
    required String email,
    required String password,
  }) async {
    await _auth.signInWithEmailAndPassword(email: email.trim(), password: password);
  }

  /// Create account with email and password.
  Future<void> createUserWithEmailPassword({
    required String email,
    required String password,
  }) async {
    await _auth.createUserWithEmailAndPassword(email: email.trim(), password: password);
  }

  /// Sign in anonymously – useful for guest.
  Future<UserCredential?> signInAnonymously() async {
    try {
      return await _auth.signInAnonymously();
    } catch (e) {
      return null;
    }
  }

  /// Sign out from Firebase (and Google Sign-In).
  Future<void> signOut() async {
    try {
      await GoogleSignIn().signOut();
    } catch (_) {}
    await _auth.signOut();
  }

  /// Get user-friendly error message from Firebase Auth exception.
  static String authErrorMessage(FirebaseAuthException e) {
    switch (e.code) {
      case 'user-not-found':
        return 'No account found with this email.';
      case 'wrong-password':
        return 'Incorrect password.';
      case 'invalid-email':
        return 'Invalid email address.';
      case 'invalid-credential':
        return 'Invalid email or password.';
      case 'user-disabled':
        return 'This account has been disabled.';
      case 'email-already-in-use':
        return 'An account already exists with this email.';
      case 'weak-password':
        return 'Password should be at least 6 characters.';
      case 'operation-not-allowed':
        return 'This sign-in method is not enabled. Check Firebase Console.';
      case 'cancelled':
        return 'Sign in was cancelled.';
      case 'sign-in-failed':
        return 'Google/Apple sign-in failed. Check configuration.';
      case 'network-request-failed':
        return 'Network error. Check your connection.';
      default:
        return e.message ?? 'Authentication failed. Please try again.';
    }
  }
}
