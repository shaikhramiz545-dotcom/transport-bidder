import 'package:shared_preferences/shared_preferences.dart';

const String _kName = 'driver_profile_name';
const String _kEmail = 'driver_profile_email';
const String _kPhone = 'driver_profile_phone';
const String _kPhotoBase64 = 'driver_profile_photo_base64';
const String _kVehicle = 'driver_profile_vehicle';
const String _kLicense = 'driver_profile_license';
const String _kVehicleType = 'driver_profile_vehicle_type';
const String _kAuthToken = 'driver_auth_token';
const String _kDriverId = 'driver_profile_driver_id';
const String _kCity = 'driver_profile_city';
const String _kDni = 'driver_profile_dni';

/// Stores driver profile (name, email, phone, photo) in SharedPreferences.
/// Signup/OTP success should call saveName/savePhone/saveEmail.
class ProfileStorageService {
  static Future<String?> getName() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_kName);
  }

  static Future<String?> getEmail() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_kEmail);
  }

  static Future<String?> getPhone() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_kPhone);
  }

  static Future<String?> getPhotoBase64() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_kPhotoBase64);
  }

  static Future<void> saveName(String value) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_kName, value.trim());
  }

  static Future<void> saveEmail(String value) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_kEmail, value.trim());
  }

  static Future<void> savePhone(String value) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_kPhone, value.trim());
  }

  static Future<void> savePhotoBase64(String? base64) async {
    final prefs = await SharedPreferences.getInstance();
    if (base64 == null || base64.isEmpty) {
      await prefs.remove(_kPhotoBase64);
    } else {
      await prefs.setString(_kPhotoBase64, base64);
    }
  }

  static Future<String?> getVehicle() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_kVehicle);
  }

  static Future<String?> getLicense() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_kLicense);
  }

  static Future<String?> getCity() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_kCity);
  }

  static Future<String?> getDni() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_kDni);
  }

  static Future<String?> getVehicleType() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_kVehicleType);
  }

  static Future<String?> getAuthToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_kAuthToken);
  }

  static Future<void> saveVehicle(String value) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_kVehicle, value.trim());
  }

  static Future<void> saveVehicleType(String value) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_kVehicleType, value.trim().toLowerCase());
  }

  static Future<void> saveLicense(String value) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_kLicense, value.trim());
  }

  static Future<void> saveCity(String value) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_kCity, value.trim());
  }

  static Future<void> saveDni(String value) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_kDni, value.trim());
  }

  static Future<void> saveAuthToken(String? token) async {
    final prefs = await SharedPreferences.getInstance();
    if (token == null || token.isEmpty) {
      await prefs.remove(_kAuthToken);
    } else {
      await prefs.setString(_kAuthToken, token);
    }
  }

  static Future<String?> getDriverId() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_kDriverId);
  }

  static Future<void> saveDriverId(String? driverId) async {
    final prefs = await SharedPreferences.getInstance();
    if (driverId == null || driverId.isEmpty) {
      await prefs.remove(_kDriverId);
    } else {
      await prefs.setString(_kDriverId, driverId);
    }
  }

  static Future<void> clear() async {
    // Bug fix: clear cached profile so logout doesn't auto-login again.
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_kName);
    await prefs.remove(_kEmail);
    await prefs.remove(_kPhone);
    await prefs.remove(_kPhotoBase64);
    await prefs.remove(_kVehicle);
    await prefs.remove(_kDriverId);
    await prefs.remove(_kLicense);
    await prefs.remove(_kVehicleType);
    await prefs.remove(_kAuthToken);
    await prefs.remove(_kCity);
    await prefs.remove(_kDni);
  }

  static Future<void> clearAll() async {
    // Clear all stored data
    await clear();
  }
}
