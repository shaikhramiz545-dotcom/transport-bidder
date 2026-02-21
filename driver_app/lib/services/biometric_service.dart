import 'dart:io';

import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:local_auth/local_auth.dart';
import 'package:shared_preferences/shared_preferences.dart';

const String _kBiometricEnabled = 'driver_biometric_enabled';
const String _kBiometricPromptShown = 'driver_biometric_prompt_shown';
const String _kStoredEmail = 'tbidder_driver_biometric_email';
const String _kStoredPassword = 'tbidder_driver_biometric_password';

/// Biometric (Face ID / Touch ID / Fingerprint) service for quick driver login.
class BiometricService {
  static BiometricService? _instance;
  factory BiometricService() => _instance ??= BiometricService._();

  BiometricService._();

  final LocalAuthentication _auth = LocalAuthentication();
  final FlutterSecureStorage _storage = const FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
    iOptions: IOSOptions(accessibility: KeychainAccessibility.first_unlock_this_device),
  );

  bool _isMobile() => !kIsWeb && (Platform.isAndroid || Platform.isIOS);

  /// Check if device has biometric enrolled (e.g. fingerprint, face).
  Future<bool> isDeviceSupported() async {
    if (!_isMobile()) return false;
    try {
      return await _auth.canCheckBiometrics &&
          (await _auth.getAvailableBiometrics()).isNotEmpty;
    } catch (_) {
      return false;
    }
  }

  /// Get biometric type label for UI (e.g. "Face ID", "Fingerprint").
  Future<String> getBiometricType() async {
    if (!_isMobile()) return 'Biometric';
    try {
      final list = await _auth.getAvailableBiometrics();
      if (list.contains(BiometricType.face)) return 'Face ID';
      if (list.contains(BiometricType.fingerprint)) return 'Fingerprint';
      if (list.contains(BiometricType.iris)) return 'Iris';
      return 'Biometric';
    } catch (_) {
      return 'Biometric';
    }
  }

  /// Authenticate user with biometric.
  Future<bool> authenticate({String? reason}) async {
    if (!_isMobile()) return false;
    try {
      return await _auth.authenticate(
        localizedReason: reason ?? 'Verify your identity to sign in',
        options: const AuthenticationOptions(
          stickyAuth: true,
          useErrorDialogs: true,
        ),
      );
    } catch (_) {
      return false;
    }
  }

  /// Is biometric login enabled by this driver.
  Future<bool> isEnabled() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(_kBiometricEnabled) ?? false;
  }

  /// Has the one-time "Enable biometric?" prompt been shown.
  Future<bool> hasPromptBeenShown() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(_kBiometricPromptShown) ?? false;
  }

  /// Enable biometric and store credentials securely.
  Future<void> enable(String email, String password) async {
    await _storage.write(key: _kStoredEmail, value: email);
    await _storage.write(key: _kStoredPassword, value: password);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_kBiometricEnabled, true);
    await prefs.setBool(_kBiometricPromptShown, true);
  }

  /// Disable biometric and clear stored credentials.
  Future<void> disable() async {
    await _storage.delete(key: _kStoredEmail);
    await _storage.delete(key: _kStoredPassword);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_kBiometricEnabled, false);
  }

  /// Get stored credentials (call only after successful biometric auth).
  Future<({String email, String password})?> getStoredCredentials() async {
    final email = await _storage.read(key: _kStoredEmail);
    final password = await _storage.read(key: _kStoredPassword);
    if (email == null || password == null || email.isEmpty || password.isEmpty) {
      return null;
    }
    return (email: email, password: password);
  }

  /// Returns true if stored credentials exist (to show biometric login button).
  Future<bool> hasStoredCredentials() async {
    final creds = await getStoredCredentials();
    return creds != null;
  }
}
