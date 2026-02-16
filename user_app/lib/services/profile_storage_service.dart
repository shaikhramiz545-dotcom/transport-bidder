import 'package:shared_preferences/shared_preferences.dart';

const String _kProfileName = 'user_profile_name';
const String _kProfileEmail = 'user_profile_email';
const String _kProfilePhone = 'user_profile_phone';
const String _kProfilePhotoPath = 'user_profile_photo_path';
const String _kProfilePhotoBase64 = 'user_profile_photo_base64';
const String _kProfilePhotoUrl = 'user_profile_photo_url';
const String _kNotificationsEnabled = 'user_profile_notifications_enabled';
const String _kAuthToken = 'user_auth_token';

/// Stores user profile (name, email, phone, photo) in SharedPreferences.
/// Login/Signup should call saveEmail etc. when user registers.
class ProfileStorageService {
  static Future<String?> getName() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_kProfileName);
  }

  static Future<String?> getEmail() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_kProfileEmail);
  }

  static Future<String?> getPhone() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_kProfilePhone);
  }

  static Future<String?> getPhotoPath() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_kProfilePhotoPath);
  }

  static Future<String?> getPhotoBase64() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_kProfilePhotoBase64);
  }

  static Future<String?> getPhotoUrl() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_kProfilePhotoUrl);
  }

  static Future<void> saveName(String value) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_kProfileName, value.trim());
  }

  static Future<void> saveEmail(String value) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_kProfileEmail, value.trim());
  }

  static Future<void> savePhone(String value) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_kProfilePhone, value.trim());
  }

  static Future<void> savePhotoPath(String? path) async {
    final prefs = await SharedPreferences.getInstance();
    if (path == null || path.isEmpty) {
      await prefs.remove(_kProfilePhotoPath);
    } else {
      await prefs.setString(_kProfilePhotoPath, path);
    }
  }

  static Future<void> savePhotoBase64(String? base64) async {
    final prefs = await SharedPreferences.getInstance();
    if (base64 == null || base64.isEmpty) {
      await prefs.remove(_kProfilePhotoBase64);
    } else {
      await prefs.setString(_kProfilePhotoBase64, base64);
    }
  }

  static Future<void> savePhotoUrl(String? url) async {
    final prefs = await SharedPreferences.getInstance();
    if (url == null || url.isEmpty) {
      await prefs.remove(_kProfilePhotoUrl);
    } else {
      await prefs.setString(_kProfilePhotoUrl, url);
    }
  }

  static Future<bool> getNotificationsEnabled() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(_kNotificationsEnabled) ?? true;
  }

  static Future<void> saveNotificationsEnabled(bool value) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_kNotificationsEnabled, value);
  }

  static Future<String?> getAuthToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_kAuthToken);
  }

  static Future<void> saveAuthToken(String? token) async {
    final prefs = await SharedPreferences.getInstance();
    if (token == null || token.trim().isEmpty) {
      await prefs.remove(_kAuthToken);
      return;
    }
    await prefs.setString(_kAuthToken, token.trim());
  }

  static Future<void> clear() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_kProfileName);
    await prefs.remove(_kProfileEmail);
    await prefs.remove(_kProfilePhone);
    await prefs.remove(_kProfilePhotoPath);
    await prefs.remove(_kProfilePhotoBase64);
    await prefs.remove(_kProfilePhotoUrl);
    await prefs.remove(_kNotificationsEnabled);
    await prefs.remove(_kAuthToken);
  }
}
