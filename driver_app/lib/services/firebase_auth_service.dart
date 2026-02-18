import 'package:firebase_auth/firebase_auth.dart';

/// Firebase Auth helper – ready for Phone/Email/Anonymous when you need it.
/// Current app uses backend login; use this for Firebase Phone OTP or link with backend later.
class FirebaseAuthService {
  final FirebaseAuth _auth = FirebaseAuth.instance;

  User? get currentUser => _auth.currentUser;
  String? get uid => _auth.currentUser?.uid;

  Stream<User?> get authStateChanges => _auth.authStateChanges();

  /// Sign in anonymously – useful before linking to backend driver account.
  Future<UserCredential?> signInAnonymously() async {
    try {
      return await _auth.signInAnonymously();
    } catch (e) {
      return null;
    }
  }

  Future<void> signOut() async {
    await _auth.signOut();
  }

  /// When you add Phone Auth: verify phone, then signInWithCredential.
  /// Example: await _auth.verifyPhoneNumber(phoneNumber: '+51...', ...);
  /// Then: await _auth.signInWithCredential(PhoneAuthProvider.credential(...));
}
