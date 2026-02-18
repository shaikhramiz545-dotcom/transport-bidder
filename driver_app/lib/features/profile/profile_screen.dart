import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:image_picker/image_picker.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:geolocator/geolocator.dart';
import 'package:tbidder_driver_app/core/app_theme.dart';
import 'package:tbidder_driver_app/core/api_config.dart';
import 'package:tbidder_driver_app/core/firm_config.dart';
import 'package:tbidder_driver_app/l10n/app_locale.dart';
import 'package:tbidder_driver_app/services/profile_storage_service.dart';
import 'package:tbidder_driver_app/features/verification/verification_screen.dart';

const String _kDriverIdKey = 'driver_on_duty_id';
const Set<String> _kVehicleTypes = {'car', 'bike', 'taxi', 'van', 'truck', 'ambulance'};

/// Driver Profile – name/phone/email from signup, editable, photo upload, language.
class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  String _name = '';
  String _phone = '';
  String _email = '';
  String _vehicle = '';
  String _license = '';
  String _city = '';
  String _dni = '';
  String? _photoBase64;
  bool _loading = true;
  String? _verificationStatus;
  int _documentsCount = 0;
  bool _hasVerification = false;
  String? _blockReason;

  @override
  void initState() {
    super.initState();
    _loadProfile();
  }

  Future<void> _loadProfile() async {
    final name = await ProfileStorageService.getName();
    final email = await ProfileStorageService.getEmail();
    final phone = await ProfileStorageService.getPhone();
    final photoBase64 = await ProfileStorageService.getPhotoBase64();
    final vehicle = await ProfileStorageService.getVehicle();
    final license = await ProfileStorageService.getLicense();
    final city = await ProfileStorageService.getCity();
    final dni = await ProfileStorageService.getDni();
    var nextName = name ?? '';
    var nextEmail = email ?? '';
    var nextPhone = phone ?? '';
    var nextVehicle = vehicle ?? '';
    final prefs = await SharedPreferences.getInstance();
    var driverId = prefs.getString(_kDriverIdKey) ?? '';
    if (driverId.isEmpty && nextPhone.isNotEmpty) {
      driverId = await _resolveDriverIdFromPhone(nextPhone) ?? '';
      if (driverId.isNotEmpty) {
        await prefs.setString(_kDriverIdKey, driverId);
      }
    }
    if (driverId.isNotEmpty && (nextName.isEmpty || nextEmail.isEmpty || nextVehicle.isEmpty)) {
      final profile = await _fetchProfileFromBackend(driverId);
      if (profile != null) {
        final fetchedName = (profile['driverName'] as String?)?.trim() ?? '';
        final fetchedEmail = (profile['email'] as String?)?.trim() ?? '';
        final fetchedVehicle = (profile['vehicleType'] as String?)?.trim() ?? '';
        if (nextName.isEmpty && fetchedName.isNotEmpty) {
          nextName = fetchedName;
          await ProfileStorageService.saveName(nextName);
        }
        if (nextEmail.isEmpty && fetchedEmail.isNotEmpty) {
          nextEmail = fetchedEmail;
          await ProfileStorageService.saveEmail(nextEmail);
        }
        if (nextVehicle.isEmpty && fetchedVehicle.isNotEmpty) {
          nextVehicle = fetchedVehicle;
          await ProfileStorageService.saveVehicle(nextVehicle);
        }
      }
    }
    if (mounted) {
      setState(() {
      _name = nextName;
      _email = nextEmail;
      _phone = nextPhone;
      _vehicle = nextVehicle;
      _license = license ?? '';
      _city = city ?? '';
      _dni = dni ?? '';
      _photoBase64 = photoBase64;
      _loading = false;
    });
    }
    await _loadVerificationStatus();
  }

  void _showLanguageSelector() {
    final scope = AppLocaleScope.of(context);
    if (scope == null) return;
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: AppTheme.surfaceDark,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(16))),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 24, horizontal: 20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(scope.t('select_language'), style: GoogleFonts.poppins(fontSize: 18, fontWeight: FontWeight.w700, color: AppTheme.onDark)),
              const SizedBox(height: 16),
              ...supportedLocales.map((loc) => ListTile(
                leading: Text(scope.locale.languageCode == loc.languageCode ? '✓' : '', style: GoogleFonts.poppins(fontSize: 18, color: AppTheme.onDark)),
                title: Text(languageName(loc), style: GoogleFonts.poppins(fontSize: 16, color: AppTheme.onDark)),
                onTap: () {
                  scope.setLocale(loc);
                  Navigator.of(ctx).pop();
                },
              )),
            ],
          ),
        ),
      ),
    );
  }

  Widget _languageTile(BuildContext context, String Function(String) t) {
    final scope = AppLocaleScope.of(context);
    final currentName = scope != null ? languageName(scope.locale) : 'Language';
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      elevation: 0,
      color: AppTheme.surfaceDark,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: ListTile(
        leading: Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: AppTheme.neonOrange.withValues(alpha: 0.2),
            borderRadius: BorderRadius.circular(10),
          ),
          child: const Icon(Icons.translate, color: AppTheme.neonOrange, size: 22),
        ),
        title: Text(t('language'), style: GoogleFonts.poppins(fontSize: 13, color: Colors.grey.shade400)),
        subtitle: Text(currentName, style: GoogleFonts.poppins(fontSize: 16, fontWeight: FontWeight.w600, color: AppTheme.onDark)),
        trailing: const Icon(Icons.chevron_right, color: Colors.grey, size: 22),
        onTap: _showLanguageSelector,
      ),
    );
  }

  String _t(String key) => AppLocaleScope.of(context)?.t(key) ?? translate(key, defaultLocale);

  Future<void> _loadVerificationStatus() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final driverId = prefs.getString(_kDriverIdKey) ?? '';
      if (driverId.isEmpty) return;
      final token = await ProfileStorageService.getAuthToken();
      final headers = <String, String>{};
      if (token != null && token.trim().isNotEmpty) {
        headers['Authorization'] = 'Bearer ${token.trim()}';
      }
      final uri = Uri.parse('$kApiBaseUrl/api/drivers/verification-status').replace(queryParameters: {'driverId': driverId});
      final res = await http.get(uri, headers: headers).timeout(const Duration(seconds: 10));
      if (res.statusCode != 200) return;
      final data = json.decode(res.body) as Map<String, dynamic>? ?? {};
      final status = data['status'] as String?;
      final blockReason = data['blockReason'] as String?;
      final hasVerification = data['hasVerification'] == true;
      final documentsCount = (data['documentsCount'] as num?)?.toInt() ?? 0;
      if (mounted) {
        setState(() {
          _verificationStatus = status;
          _blockReason = blockReason;
          _hasVerification = hasVerification;
          _documentsCount = documentsCount;
        });
      }
    } catch (_) {}
  }

  Future<Map<String, dynamic>?> _fetchProfileFromBackend(String driverId) async {
    try {
      final token = await ProfileStorageService.getAuthToken();
      final headers = <String, String>{};
      if (token != null && token.trim().isNotEmpty) {
        headers['Authorization'] = 'Bearer ${token.trim()}';
      }
      final uri = Uri.parse('$kApiBaseUrl/api/drivers/profile').replace(queryParameters: {'driverId': driverId});
      final res = await http.get(uri, headers: headers).timeout(const Duration(seconds: 10));
      if (res.statusCode != 200) return null;
      final data = json.decode(res.body) as Map<String, dynamic>?;
      final profile = data?['profile'] as Map<String, dynamic>?;
      return profile;
    } catch (_) {
      return null;
    }
  }

  Future<String?> _resolveDriverIdFromPhone(String phone) async {
    try {
      final token = await ProfileStorageService.getAuthToken();
      final headers = <String, String>{};
      if (token != null && token.trim().isNotEmpty) {
        headers['Authorization'] = 'Bearer ${token.trim()}';
      }
      final uri = Uri.parse('$kApiBaseUrl/api/drivers/resolve-id').replace(queryParameters: {'phone': phone});
      final res = await http.get(uri, headers: headers).timeout(const Duration(seconds: 10));
      if (res.statusCode != 200) return null;
      final data = json.decode(res.body) as Map<String, dynamic>?;
      return data?['driverId'] as String?;
    } catch (_) {
      return null;
    }
  }

  Future<void> _saveProfileToBackend({
    required String name,
    required String email,
    required String vehicle,
  }) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      var driverId = prefs.getString(_kDriverIdKey) ?? '';
      if (driverId.isEmpty && _phone.isNotEmpty) {
        driverId = await _resolveDriverIdFromPhone(_phone) ?? '';
        if (driverId.isNotEmpty) {
          await prefs.setString(_kDriverIdKey, driverId);
        }
      }
      if (driverId.isEmpty) return;
      final body = <String, dynamic>{'driverId': driverId};
      if (name.trim().isNotEmpty) body['driverName'] = name.trim();
      if (email.trim().isNotEmpty) body['email'] = email.trim();
      final normalizedVehicle = vehicle.trim().toLowerCase();
      if (_kVehicleTypes.contains(normalizedVehicle)) body['vehicleType'] = normalizedVehicle;
      final token = await ProfileStorageService.getAuthToken();
      final headers = <String, String>{'Content-Type': 'application/json'};
      if (token != null && token.trim().isNotEmpty) {
        headers['Authorization'] = 'Bearer ${token.trim()}';
      }
      final res = await http.post(
        Uri.parse('$kApiBaseUrl/api/drivers/verification-register'),
        headers: headers,
        body: json.encode(body),
      ).timeout(const Duration(seconds: 10));
      if (res.statusCode < 200 || res.statusCode >= 300) return;
    } catch (_) {}
  }

  Future<void> _showEditDialog(String field, String currentValue, String label, Future<void> Function(String) onSave) async {
    final initial = currentValue == '—' ? '' : currentValue;
    final controller = TextEditingController(text: initial);
    final result = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppTheme.surfaceDark,
        title: Text(label, style: const TextStyle(color: AppTheme.onDark)),
        content: TextField(
          controller: controller,
          autofocus: true,
          keyboardType: field == 'email' ? TextInputType.emailAddress : (field == 'phone' ? TextInputType.phone : TextInputType.name),
          style: const TextStyle(color: AppTheme.onDark),
          decoration: InputDecoration(
            hintText: label,
            hintStyle: TextStyle(color: Colors.grey.shade500),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
            enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppTheme.neonOrange)),
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: Text(_t('cancel'), style: const TextStyle(color: AppTheme.neonOrange))),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: AppTheme.neonOrange),
            onPressed: () => Navigator.pop(ctx, controller.text.trim()),
            child: Text(_t('save')),
          ),
        ],
      ),
    );
    if (result != null) {
      await onSave(result);
      var nextName = _name;
      var nextEmail = _email;
      var nextVehicle = _vehicle;
      if (mounted) {
        setState(() {
        if (field == 'name') _name = result;
        if (field == 'email') _email = result;
        if (field == 'phone') _phone = result;
        if (field == 'vehicle') _vehicle = result;
        if (field == 'license') _license = result;
        if (field == 'city') _city = result;
        if (field == 'dni') _dni = result;
      });
      }
      if (field == 'name') nextName = result;
      if (field == 'email') nextEmail = result;
      if (field == 'vehicle') nextVehicle = result;
      await _saveProfileToBackend(name: nextName, email: nextEmail, vehicle: nextVehicle);
    }
  }

  Future<void> _pickPhoto() async {
    try {
      // Show security warning
      final proceed = await showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
          backgroundColor: AppTheme.surfaceDark,
          title: Text('Profile Photo', style: GoogleFonts.poppins(color: AppTheme.neonOrange)),
          content: Text(
            '📸 Camera-only capture for security\n'
            '📍 GPS location will be recorded\n'
            '⏰ Photo must be taken within 15 minutes\n\n'
            'This ensures your profile photo matches your verification documents.',
            style: GoogleFonts.poppins(color: AppTheme.onDark, fontSize: 14),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(ctx).pop(false),
              child: Text('Cancel', style: TextStyle(color: Colors.grey.shade400)),
            ),
            ElevatedButton(
              onPressed: () => Navigator.of(ctx).pop(true),
              style: ElevatedButton.styleFrom(backgroundColor: AppTheme.neonOrange),
              child: const Text('Take Photo', style: TextStyle(color: AppTheme.darkBg)),
            ),
          ],
        ),
      );
      
      if (proceed != true) return;
      
      // Get GPS location
      Position? position;
      try {
        final permission = await Geolocator.checkPermission();
        if (permission == LocationPermission.denied || permission == LocationPermission.deniedForever) {
          await Geolocator.requestPermission();
        }
        position = await Geolocator.getCurrentPosition(
          desiredAccuracy: LocationAccuracy.high,
          timeLimit: const Duration(seconds: 10),
        );
      } catch (_) {
        position = null;
      }
      
      // Camera-only capture
      final picker = ImagePicker();
      final xFile = await picker.pickImage(
        source: ImageSource.camera,
        preferredCameraDevice: CameraDevice.front,
        maxWidth: 512,
        maxHeight: 512,
        imageQuality: 85,
      );
      
      if (xFile == null || !mounted) return;
      
      final captureTime = DateTime.now();
      final bytes = await xFile.readAsBytes();
      
      // Upload to backend
      final prefs = await SharedPreferences.getInstance();
      final driverId = prefs.getString(_kDriverIdKey) ?? '';
      if (driverId.isEmpty) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Please go online first to upload profile photo')),
          );
        }
        return;
      }
      
      final token = await ProfileStorageService.getAuthToken();
      final uri = Uri.parse('$kApiBaseUrl/api/drivers/profile-photo');
      final request = http.MultipartRequest('POST', uri);
      if (token != null && token.trim().isNotEmpty) {
        request.headers['Authorization'] = 'Bearer ${token.trim()}';
      }
      request.fields['driverId'] = driverId;
      request.fields['captureTimestamp'] = captureTime.toUtc().toIso8601String();
      if (position != null) {
        request.fields['latitude'] = position.latitude.toString();
        request.fields['longitude'] = position.longitude.toString();
      }
      request.files.add(http.MultipartFile.fromBytes(
        'file',
        bytes,
        filename: 'profile_photo.jpg',
      ));
      
      final streamed = await request.send().timeout(const Duration(seconds: 15));
      
      if (streamed.statusCode >= 200 && streamed.statusCode < 300) {
        // Also save locally for immediate display
        final base64 = base64Encode(bytes);
        await ProfileStorageService.savePhotoBase64(base64);
        if (mounted) {
          setState(() => _photoBase64 = base64);
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('✅ Profile photo uploaded\n📍 GPS: ${position != null ? 'Recorded' : 'Not available'}'),
              backgroundColor: Colors.green.shade700,
            ),
          );
        }
      } else {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Failed to upload photo. Please try again.'),
              backgroundColor: Colors.red,
            ),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: ${e.toString()}')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = AppLocaleScope.of(context)?.t ?? (String k, [Map<String, dynamic>? p]) => translate(k, defaultLocale, p);
    return Scaffold(
      backgroundColor: AppTheme.darkBg,
      appBar: AppBar(
        title: Text(t('drawer_profile'), style: GoogleFonts.poppins(fontSize: 18, fontWeight: FontWeight.w600, color: AppTheme.neonOrange)),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: AppTheme.neonOrange),
          onPressed: () => Navigator.pop(context),
        ),
        backgroundColor: AppTheme.darkBg,
        elevation: 0,
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: AppTheme.neonOrange))
          : SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 8),
              Center(
                child: Column(
                  children: [
                    GestureDetector(
                      onTap: _pickPhoto,
                      child: Stack(
                        children: [
                          CircleAvatar(
                            radius: 48,
                            backgroundColor: AppTheme.neonOrange.withValues(alpha: 0.25),
                            backgroundImage: _photoBase64 != null
                                ? MemoryImage(base64Decode(_photoBase64!))
                                : null,
                            child: _photoBase64 != null
                                ? null
                                : Text('🚗', style: GoogleFonts.poppins(fontSize: 40)),
                          ),
                          Positioned(
                            right: 0,
                            bottom: 0,
                            child: Container(
                              padding: const EdgeInsets.all(6),
                              decoration: const BoxDecoration(
                                color: AppTheme.neonOrange,
                                shape: BoxShape.circle,
                                boxShadow: [BoxShadow(color: Colors.black26, blurRadius: 4)],
                              ),
                              child: const Icon(Icons.camera_alt, color: Colors.white, size: 20),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),
                    Text(
                      _name.isEmpty ? t('profile_driver_name') : _name,
                      style: GoogleFonts.poppins(fontSize: 22, fontWeight: FontWeight.w700, color: AppTheme.onDark),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      t('profile_partner'),
                      style: GoogleFonts.poppins(fontSize: 14, color: Colors.grey.shade400),
                    ),
                    const SizedBox(height: 8),
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.star, color: AppTheme.neonOrange, size: 20),
                        const SizedBox(width: 6),
                        Text(
                          '—',
                          style: GoogleFonts.poppins(fontSize: 16, fontWeight: FontWeight.w600, color: AppTheme.onDark),
                        ),
                        Text(
                          ' ${t('profile_rating')}',
                          style: GoogleFonts.poppins(fontSize: 14, color: Colors.grey.shade400),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              _verificationTile(t),
              const SizedBox(height: 32),
              _sectionTitle(t('profile_personal_info')),
              const SizedBox(height: 12),
              _editableInfoCard(context, t, Icons.person_outline, t('profile_name'), _name.isEmpty ? '—' : _name, 'name'),
              _editableInfoCard(context, t, Icons.phone_outlined, t('profile_phone'), _phone.isEmpty ? '—' : _phone, 'phone'),
              _editableInfoCard(context, t, Icons.email_outlined, t('profile_email'), _email.isEmpty ? '—' : _email, 'email'),
              _editableInfoCard(context, t, Icons.location_city_outlined, 'City', _city.isEmpty ? '—' : _city, 'city'),
              _editableInfoCard(context, t, Icons.badge_outlined, 'DNI Number', _dni.isEmpty ? '—' : _dni, 'dni'),
              const SizedBox(height: 24),
              _sectionTitle(t('profile_driver_info')),
              const SizedBox(height: 12),
              _editableInfoCard(context, t, Icons.directions_car_outlined, t('profile_vehicle'), _vehicle.isEmpty ? '—' : _vehicle, 'vehicle'),
              _editableInfoCard(context, t, Icons.badge_outlined, t('profile_license'), _license.isEmpty ? '—' : _license, 'license'),
              const SizedBox(height: 24),
              _sectionTitle(t('language')),
              const SizedBox(height: 12),
              _languageTile(context, t),
              const SizedBox(height: 32),
              Center(
                child: Text(
                  kDriverAppTitle,
                  style: GoogleFonts.poppins(fontSize: 12, fontWeight: FontWeight.w600, color: Colors.grey.shade500),
                ),
              ),
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }

  Widget _verificationTile(String Function(String) t) {
    String label = 'Verification';
    String value = 'Not submitted';
    Color valueColor = Colors.red.shade400;
    if (_verificationStatus == 'approved') {
      value = 'Verified';
      valueColor = Colors.green;
    } else if (_verificationStatus == 'pending') {
      if (_hasVerification || _documentsCount > 0) {
        value = 'Under review';
        valueColor = Colors.orange.shade400;
      }
    } else if (_verificationStatus == 'rejected' || _verificationStatus == 'temp_blocked' || _verificationStatus == 'suspended') {
      value = _blockReason != null && _blockReason!.isNotEmpty ? _blockReason! : 'Blocked';
      valueColor = Colors.red.shade400;
    }
    return Card(
      elevation: 0,
      color: AppTheme.surfaceDark,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: ListTile(
        leading: Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: AppTheme.neonOrange.withValues(alpha: 0.2),
            borderRadius: BorderRadius.circular(10),
          ),
          child: const Icon(Icons.verified_user_outlined, color: AppTheme.neonOrange, size: 22),
        ),
        title: Text(label, style: GoogleFonts.poppins(fontSize: 13, color: Colors.grey.shade400)),
        subtitle: Text(value, style: GoogleFonts.poppins(fontSize: 16, fontWeight: FontWeight.w600, color: valueColor)),
        trailing: const Icon(Icons.chevron_right, color: Colors.grey, size: 22),
        onTap: () {
          Navigator.of(context).push(MaterialPageRoute(builder: (_) => const VerificationScreen()));
        },
      ),
    );
  }

  Widget _editableInfoCard(BuildContext context, String Function(String) t, IconData icon, String label, String value, String field) {
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      elevation: 0,
      color: AppTheme.surfaceDark,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: ListTile(
        leading: Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: AppTheme.neonOrange.withValues(alpha: 0.2),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Icon(icon, color: AppTheme.neonOrange, size: 22),
        ),
        title: Text(label, style: GoogleFonts.poppins(fontSize: 13, color: Colors.grey.shade400)),
        subtitle: Text(value, style: GoogleFonts.poppins(fontSize: 16, fontWeight: FontWeight.w600, color: AppTheme.onDark)),
        trailing: const Icon(Icons.chevron_right, color: Colors.grey, size: 22),
        onTap: () {
          // Map field -> current value and save function.
          String current;
          Future<void> Function(String) onSave;
          switch (field) {
            case 'name':
              current = _name;
              onSave = ProfileStorageService.saveName;
              break;
            case 'phone':
              current = _phone;
              onSave = ProfileStorageService.savePhone;
              break;
            case 'email':
              current = _email;
              onSave = ProfileStorageService.saveEmail;
              break;
            case 'vehicle':
              current = _vehicle;
              onSave = ProfileStorageService.saveVehicle;
              break;
            case 'license':
              current = _license;
              onSave = ProfileStorageService.saveLicense;
              break;
            case 'city':
              current = _city;
              onSave = ProfileStorageService.saveCity;
              break;
            case 'dni':
              current = _dni;
              onSave = ProfileStorageService.saveDni;
              break;
            default:
              current = value;
              onSave = (v) async {};
          }
          _showEditDialog(field, current, label, onSave);
        },
      ),
    );
  }

  Widget _sectionTitle(String text) {
    return Text(
      text,
      style: GoogleFonts.poppins(fontSize: 14, fontWeight: FontWeight.w600, color: Colors.grey.shade400),
    );
  }
}
