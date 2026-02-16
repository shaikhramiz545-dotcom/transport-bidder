import 'dart:io';

import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:local_auth/local_auth.dart';
import 'package:shared_preferences/shared_preferences.dart';

const String _kBiometricEnabled = 'biometric_enabled';
const String _kBiometricPromptShown = 'biometric_prompt_shown';
const String _kStoredEmail = 'tbidder_biometric_email';
const String _kStoredPassword = 'tbidder_biometric_password';

/// Biometric (Face ID / Touch ID / Fingerprint) service for quick login.
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

  /// Check if device supports biometric.
  Future<bool> canCheckBiometrics() async {
    if (!_isMobile()) return false;
    try {
      return await _auth.canCheckBiometrics;
    } catch (_) {
      return false;
    }
  }

  /// Check if device has biometric enrolled (e.g. fingerprint, face).
  Future<bool> isDeviceSupported() async {
    if (!_isMobile()) return false;
    try {
      return await _auth.canCheckBiometrics && (await _auth.getAvailableBiometrics()).isNotEmpty;
    } catch (_) {
      return false;
    }
  }

  /// Get biometric type for UI (e.g. "Face ID", "Fingerprint").
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
        localizedReason: reason ?? 'Verify identity to login',
        options: const AuthenticationOptions(
          stickyAuth: true,
          useErrorDialogs: true,
        ),
      );
    } catch (_) {
      return false;
    }
  }

  /// Is biometric login enabled (user has added it).
  Future<bool> isEnabled() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(_kBiometricEnabled) ?? false;
  }

  /// Has the one-time "Add biometric?" prompt been shown (and Add/Skip done).
  Future<bool> hasPromptBeenShown() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(_kBiometricPromptShown) ?? false;
  }

  /// Mark prompt as shown (user chose Add or Skip).
  Future<void> markPromptShown() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_kBiometricPromptShown, true);
  }

  /// Enable biometric and store credentials.
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

  /// Get stored credentials (after biometric auth). Returns null if not found.
  Future<({String email, String password})?> getStoredCredentials() async {
    final email = await _storage.read(key: _kStoredEmail);
    final password = await _storage.read(key: _kStoredPassword);
    if (email == null || password == null || email.isEmpty || password.isEmpty) {
      return null;
    }
    return (email: email, password: password);
  }

  /// Check if we have stored credentials (for showing biometric login option).
  Future<bool> hasStoredCredentials() async {
    final creds = await getStoredCredentials();
    return creds != null;
  }

  /// Open device settings (for user to add biometric if skipped).
  Future<void> openAppSettings() async {
    // Use permission_handler or url_launcher for app settings
    // For now we rely on platform - user can go to Settings manually
  }
}
