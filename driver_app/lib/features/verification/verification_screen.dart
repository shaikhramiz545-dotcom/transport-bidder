import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:tbidder_driver_app/features/verification/picked_image_io.dart'
    if (dart.library.html) 'package:tbidder_driver_app/features/verification/picked_image_stub.dart' as picked_image;
import 'package:google_fonts/google_fonts.dart';
import 'package:image_picker/image_picker.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:http/http.dart' as http;
import 'package:geolocator/geolocator.dart';
import 'package:tbidder_driver_app/core/app_theme.dart';
import 'package:tbidder_driver_app/core/api_config.dart';
import 'package:tbidder_driver_app/l10n/app_locale.dart';
import 'package:tbidder_driver_app/services/profile_storage_service.dart';
import 'package:tbidder_driver_app/features/wallet/wallet_screen.dart';
import 'package:tbidder_driver_app/features/verification/vehicle_fields_widget.dart';

const String _kDriverIdKey = 'driver_on_duty_id';

/// Peru driver document keys for upload cards.
const List<String> _kPersonalDocKeys = ['brevete_frente', 'brevete_dorso', 'dni', 'selfie'];
const List<String> _kVehicleDocKeys = ['soat', 'tarjeta_propiedad', 'foto_vehiculo'];

/// Driver verification – Peru 3-step wizard (Personal docs → Vehicle docs → Review).
class VerificationScreen extends StatefulWidget {
  const VerificationScreen({super.key});

  @override
  State<VerificationScreen> createState() => _VerificationScreenState();
}

/// Labels for document keys (for reupload requested list).
const Map<String, String> _kDocKeyLabels = {
  'brevete_frente': 'Brevete (frente)',
  'brevete_dorso': 'Brevete (dorso)',
  'dni': 'DNI',
  'selfie': 'Selfie',
  'soat': 'SOAT',
  'tarjeta_propiedad': 'Tarjeta de propiedad',
  'foto_vehiculo': 'Foto del vehículo',
};

class _VerificationScreenState extends State<VerificationScreen> with AutomaticKeepAliveClientMixin {
  @override
  bool get wantKeepAlive => true;
  
  String _status = 'pending';
  String? _blockReason;
  bool _loadingStatus = true;
  bool _welcomeShownThisSession = false; // avoid showing welcome multiple times per session
  bool _hasVerification = false;
  int _documentsCount = 0;
  bool _hasSubmitted = false;
  String _vehicleType = '';
  String _vehicleCategory = '';

  int _currentStep = 0;
  final Map<String, String?> _docPaths = {};
  final Map<String, XFile?> _docFiles = {}; // kept for upload (XFile.readAsBytes)
  bool _submitting = false;
  bool _hasAntecedentesPoliciales = false;
  bool _hasAntecedentesPenales = false;
  
  // New fields to match admin panel
  final TextEditingController _cityController = TextEditingController();
  final TextEditingController _dniController = TextEditingController();
  final TextEditingController _licenseController = TextEditingController();
  final TextEditingController _vehiclePlateController = TextEditingController();
  
  // NEW: Vehicle detail fields (Peru compliance)
  final TextEditingController _vehicleBrandController = TextEditingController();
  final TextEditingController _vehicleModelController = TextEditingController();
  final TextEditingController _customBrandController = TextEditingController();
  final TextEditingController _customColorController = TextEditingController();
  String _vehicleColor = '';
  int? _registrationYear;
  int? _vehicleCapacity;
  bool _showCustomBrand = false;
  bool _showCustomColor = false;
  
  // NEW: License detail fields
  String _licenseClass = '';
  DateTime? _licenseIssueDate;
  DateTime? _licenseExpiryDate;
  
  // NEW: DNI date fields
  DateTime? _dniIssueDate;
  DateTime? _dniExpiryDate;
  
  // NEW: Document dates (per document type)
  final Map<String, DateTime?> _docIssueDates = {};
  final Map<String, DateTime?> _docExpiryDates = {};
  
  // NEW: SOAT-specific fields
  final TextEditingController _soatPolicyNumberController = TextEditingController();
  final TextEditingController _soatInsuranceCompanyController = TextEditingController();
  
  // NEW: Registration deadline tracking
  DateTime? _registrationDeadline;

  /// When admin requested reupload: which doc types + message (from verification-status).
  List<String> _reuploadDocumentTypes = [];
  String? _reuploadMessage;

  bool get _isBlocked =>
      _status == 'rejected' || _status == 'temp_blocked' || _status == 'suspended';

  @override
  void initState() {
    super.initState();
    _ensureDriverIdThenFetch();
    _loadVehicleType();
    _loadStoredFields();
  }

  @override
  void dispose() {
    _cityController.dispose();
    _dniController.dispose();
    _licenseController.dispose();
    _vehiclePlateController.dispose();
    // NEW: Dispose vehicle detail controllers
    _vehicleBrandController.dispose();
    _vehicleModelController.dispose();
    _customBrandController.dispose();
    _customColorController.dispose();
    _soatPolicyNumberController.dispose();
    _soatInsuranceCompanyController.dispose();
    super.dispose();
  }

  Future<void> _loadStoredFields() async {
    final city = await ProfileStorageService.getCity();
    final dni = await ProfileStorageService.getDni();
    final license = await ProfileStorageService.getLicense();
    final vehiclePlate = await ProfileStorageService.getVehicle();
    if (mounted) {
      _cityController.text = city ?? '';
      _dniController.text = dni ?? '';
      _licenseController.text = license ?? '';
      _vehiclePlateController.text = vehiclePlate ?? '';
    }
  }

  /// Single source of truth: driverId is created ONLY when driver goes online from Home (POST /location).
  /// We do NOT call /location here — that caused a new ID and new pending row on every Verification open.
  Future<void> _ensureDriverId() async {
    final prefs = await SharedPreferences.getInstance();
    if ((prefs.getString(_kDriverIdKey) ?? '').isNotEmpty) return;
    // No API call when ID missing — show "Go online first" instead. Prevents duplicate pending rows.
  }

  /// True when prefs has no driverId (user must go online first — single source of truth).
  bool _hasNoDriverId = false;

  Future<void> _ensureDriverIdThenFetch() async {
    await _ensureDriverId();
    final prefs = await SharedPreferences.getInstance();
    final id = prefs.getString(_kDriverIdKey) ?? '';
    if (mounted) setState(() => _hasNoDriverId = id.isEmpty);
    await _fetchVerificationStatus();
    await _loadUploadedDocuments(id);
  }

  Future<void> _loadVehicleType() async {
    final vt = await ProfileStorageService.getVehicleType();
    var val = vt?.trim() ?? '';
    if (val == 'car') val = 'taxi_std';
    if (val == 'car_4') val = 'taxi_std';
    if (val == 'car_6') val = 'taxi_suv';
    if (val == 'van_8') val = 'van_8';
    if (val == 'van_12') val = 'van_12';
    if (val == 'moto') val = 'moto';
    String cat = '';
    if (val.contains('_')) {
      cat = val.split('_').first;
    } else {
      cat = val;
    }
    if (cat == 'car' || cat == 'van') cat = 'taxi';
    if (cat == 'moto') cat = 'bike';
    if (mounted) {
      setState(() {
      _vehicleType = val;
      _vehicleCategory = cat;
    });
    }
  }

  Future<void> _loadUploadedDocuments(String driverId) async {
    if (driverId.isEmpty) return;
    try {
      final token = await ProfileStorageService.getAuthToken();
      final headers = <String, String>{};
      if (token != null && token.trim().isNotEmpty) {
        headers['Authorization'] = 'Bearer ${token.trim()}';
      }
      final uri = Uri.parse('$kApiBaseUrl/api/v1/drivers/documents')
          .replace(queryParameters: {'driverId': driverId});
      final res = await http.get(uri, headers: headers).timeout(const Duration(seconds: 10));
      if (res.statusCode != 200) return;
      final data = json.decode(res.body) as Map<String, dynamic>? ?? {};
      final docs = (data['documents'] as List<dynamic>? ?? []).cast<Map<String, dynamic>>();
      int count = 0;
      final requiredCount = _kPersonalDocKeys.length + _kVehicleDocKeys.length;
      for (final d in docs) {
        final type = (d['documentType'] as String?) ?? '';
        final rawUrl = (d['fileUrl'] as String?) ?? '';
        if (type.isEmpty || rawUrl.isEmpty) continue;
        final url = rawUrl.startsWith('http')
            ? rawUrl
            : rawUrl.startsWith('/')
                ? '$kApiBaseUrl$rawUrl'
                : '$kApiBaseUrl/$rawUrl';
        // Bug fix: after refresh, show already uploaded docs from backend.
        if ((_docPaths[type] ?? '').isEmpty) {
          _docPaths[type] = url;
        }
        count++;
      }
      if (mounted) {
        setState(() {
          _documentsCount = _documentsCount < count ? count : _documentsCount;
          if (_documentsCount >= requiredCount) _hasSubmitted = true;
        });
      }
    } catch (_) {}
  }

  Future<void> _fetchVerificationStatus() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final driverId = prefs.getString(_kDriverIdKey) ?? '';
      final token = await ProfileStorageService.getAuthToken();
      final headers = <String, String>{};
      if (token != null && token.trim().isNotEmpty) {
        headers['Authorization'] = 'Bearer ${token.trim()}';
      }
      final submittedKey = driverId.isNotEmpty ? 'verification_submitted_at_$driverId' : null;
      final submittedAt = submittedKey != null ? prefs.getString(submittedKey) : null;
      // Do not call verification-register here; it can reset approved -> pending.
      final uri = Uri.parse('$kApiBaseUrl/api/v1/drivers/verification-status')
          .replace(queryParameters: driverId.isNotEmpty ? {'driverId': driverId} : {});
      debugPrint('[Verification] Fetching status for driverId=$driverId uri=$uri');
      final res = await http.get(uri, headers: headers).timeout(const Duration(seconds: 10));
      debugPrint('[Verification] Response code=${res.statusCode} body=${res.body}');
      if (res.statusCode == 200) {
        final data = json.decode(res.body) as Map<String, dynamic>?;
        final status = data?['status'] as String?;
        final blockReason = data?['blockReason'] as String?;
        final hasVerification = data?['hasVerification'] == true;
        final documentsCount = (data?['documentsCount'] as num?)?.toInt() ?? 0;
        final hasAntecedentesPoliciales = data?['hasAntecedentesPoliciales'];
        final hasAntecedentesPenales = data?['hasAntecedentesPenales'];
        final reupload = data?['reuploadRequested'] as Map<String, dynamic>?;
        // Fix driverId mismatch: if server resolved a different driverId, update local cache
        final serverDriverId = data?['driverId'] as String?;
        if (serverDriverId != null && serverDriverId.isNotEmpty && serverDriverId != driverId) {
          debugPrint('[Verification] driverId mismatch: local=$driverId server=$serverDriverId — updating local cache');
          await prefs.setString(_kDriverIdKey, serverDriverId);
        }
        List<String> types = [];
        String? msg;
        if (reupload != null) {
          final list = reupload['documentTypes'];
          if (list is List) {
            for (final e in list) {
              if (e is String) types.add(e);
            }
          }
          final m = reupload['message'];
          if (m is String && m.isNotEmpty) msg = m;
        }
        if (mounted) {
          final oldStatus = _status;
          final newStatus = status ?? _status;
          final requiredCount = _kPersonalDocKeys.length + _kVehicleDocKeys.length;
          final submitted = (submittedAt != null && submittedAt.isNotEmpty) ||
              hasVerification ||
              documentsCount >= requiredCount;
          setState(() {
            _status = newStatus;
            _blockReason = blockReason;
            _reuploadDocumentTypes = types;
            _reuploadMessage = msg;
            _hasVerification = hasVerification;
            _documentsCount = documentsCount;
            _hasSubmitted = submitted;
            if (hasAntecedentesPoliciales is bool) {
              _hasAntecedentesPoliciales = hasAntecedentesPoliciales;
            }
            if (hasAntecedentesPenales is bool) {
              _hasAntecedentesPenales = hasAntecedentesPenales;
            }
          });
          // If we just transitioned from non-approved -> approved, maybe show a one-time welcome.
          if (oldStatus != 'approved' && newStatus == 'approved') {
            _maybeShowApprovedWelcome(serverDriverId ?? driverId);
          }
        }
      }
    } catch (_) {}
    if (mounted) setState(() => _loadingStatus = false);
  }

  Future<void> _maybeShowApprovedWelcome(String driverId) async {
    if (!mounted || _welcomeShownThisSession) return;
    try {
      final prefs = await SharedPreferences.getInstance();
      final key = 'verification_welcome_shown_$driverId';
      final alreadyShown = prefs.getBool(key) ?? false;
      if (alreadyShown) return;

      if (!mounted) return;

      _welcomeShownThisSession = true;
      final t = AppLocaleScope.of(context)?.t ?? (String k, [Map<String, dynamic>? p]) => translate(k, defaultLocale, p);
      await showDialog<void>(
        context: context,
        builder: (ctx) => AlertDialog(
          backgroundColor: AppTheme.surfaceDark,
          title: Text(
            t('verification_approved_recharge_title'),
            style: GoogleFonts.poppins(fontWeight: FontWeight.w700, color: AppTheme.onDark),
          ),
          content: Text(
            t('verification_approved_recharge_body'),
            style: GoogleFonts.poppins(fontSize: 14, color: AppTheme.onDark),
          ),
          actions: [
            TextButton(
              onPressed: () {
                Navigator.of(ctx).pop();
                // Bug fix: send driver to recharge after approval.
                if (!mounted) return;
                Navigator.of(context).push(MaterialPageRoute(builder: (_) => const WalletScreen(focusRecharge: true)));
              },
              child: Text(t('verification_approved_recharge_cta'), style: const TextStyle(color: AppTheme.neonOrange)),
            ),
          ],
        ),
      );
      await prefs.setBool(key, true);
    } catch (_) {
      // If anything goes wrong, just skip the welcome – core flow must not break.
    }
  }

  bool get _allPersonalDocsUploaded {
    // In revision mode, only require requested personal docs to be ready
    if (_reuploadDocumentTypes.isNotEmpty) {
      final requested = _reuploadDocumentTypes.where((k) => _kPersonalDocKeys.contains(k)).toList();
      if (requested.isEmpty) return true; // no personal docs requested
      return requested.every((k) => (_docPaths[k] ?? '').isNotEmpty || _docFiles[k] != null);
    }
    return _kPersonalDocKeys.every((k) => (_docPaths[k] ?? '').isNotEmpty);
  }

  bool get _allVehicleDocsUploaded {
    // In revision mode, only require requested vehicle docs to be ready
    if (_reuploadDocumentTypes.isNotEmpty) {
      final requested = _reuploadDocumentTypes.where((k) => _kVehicleDocKeys.contains(k)).toList();
      if (requested.isEmpty) return true; // no vehicle docs requested
      return requested.every((k) => (_docPaths[k] ?? '').isNotEmpty || _docFiles[k] != null);
    }
    return _kVehicleDocKeys.every((k) => (_docPaths[k] ?? '').isNotEmpty);
  }

  bool get _allDocsReady => _allPersonalDocsUploaded && _allVehicleDocsUploaded;

  /// Show a centered floating notification (instead of bottom SnackBar).
  void _showNotif(String message, {Color color = Colors.green, int seconds = 4}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).removeCurrentSnackBar();
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message, style: const TextStyle(fontSize: 13)),
        backgroundColor: color,
        behavior: SnackBarBehavior.floating,
        duration: Duration(seconds: seconds),
        margin: EdgeInsets.only(
          bottom: MediaQuery.of(context).size.height * 0.42,
          left: 20,
          right: 20,
        ),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      ),
    );
  }

  /// Show the already-captured/uploaded photo in a full-screen dialog.
  void _viewDoc(String key) {
    final path = _docPaths[key] ?? '';
    if (path.isEmpty) return;
    final isUrl = path.startsWith('http');
    final label = _kDocKeyLabels[key] ?? key;
    showDialog<void>(
      context: context,
      builder: (ctx) => Dialog(
        backgroundColor: Colors.black,
        insetPadding: const EdgeInsets.all(12),
        child: Stack(
          children: [
            Center(
              child: InteractiveViewer(
                child: isUrl
                    ? Image.network(path, fit: BoxFit.contain, errorBuilder: (_, __, ___) => const Icon(Icons.broken_image, color: Colors.white, size: 64))
                    : Image.file(File(path), fit: BoxFit.contain, errorBuilder: (_, __, ___) => const Icon(Icons.broken_image, color: Colors.white, size: 64)),
              ),
            ),
            Positioned(
              top: 8,
              right: 8,
              child: IconButton(
                icon: const Icon(Icons.close, color: Colors.white, size: 28),
                onPressed: () => Navigator.of(ctx).pop(),
              ),
            ),
            Positioned(
              bottom: 16,
              left: 0,
              right: 0,
              child: Center(
                child: Text(label, style: const TextStyle(color: Colors.white70, fontSize: 13)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _pickDoc(String key) async {
    final t = AppLocaleScope.of(context)?.t ?? (String k, [Map<String, dynamic>? p]) => translate(k, defaultLocale, p);
    
    // Show 15-minute warning dialog
    final proceed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppTheme.surfaceDark,
        title: Text('Security Notice', style: GoogleFonts.poppins(color: AppTheme.neonOrange)),
        content: Text(
          '⚠️ You must complete this photo capture within 1 hour.\n\n'
          '📸 Camera-only capture for security\n'
          '📍 GPS location will be recorded\n'
          '⏰ Timestamp will be validated\n\n'
          'This prevents document fraud and ensures authenticity.',
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
            child: const Text('Take Photo Now', style: TextStyle(color: AppTheme.darkBg)),
          ),
        ],
      ),
    );
    
    if (proceed != true) return;

    // Launch camera immediately (no GPS wait — GPS is fetched after photo is taken)
    final picker = ImagePicker();
    final xFile = await picker.pickImage(
      source: ImageSource.camera,
      preferredCameraDevice: CameraDevice.rear,
      imageQuality: 70,
      maxWidth: 1280,
      maxHeight: 1280,
    );

    if (xFile != null && mounted) {
      final captureTime = DateTime.now();

      // Get GPS in background after photo is already captured (non-blocking, low accuracy = fast)
      Position? position;
      try {
        final permission = await Geolocator.checkPermission();
        if (permission != LocationPermission.denied && permission != LocationPermission.deniedForever) {
          position = await Geolocator.getCurrentPosition(
            desiredAccuracy: LocationAccuracy.low,
            timeLimit: const Duration(seconds: 5),
          );
        }
      } catch (_) {
        position = null;
      }
      
      // Store metadata with the file
      final metadata = {
        'captureTime': captureTime.toUtc().toIso8601String(),
        'latitude': position?.latitude,
        'longitude': position?.longitude,
        'accuracy': position?.accuracy,
      };
      
      // Save metadata to SharedPreferences for activity log
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('doc_metadata_$key', json.encode(metadata));
      
      setState(() {
        _docPaths[key] = xFile.path;
        _docFiles[key] = xFile;
      });
      
      // Log activity
      await _logPhotoActivity(key, metadata);
      
      if (mounted) {
        _showNotif(
          '✅ ${t('verification_upload')} ($key)\n📍 GPS: ${position != null ? 'Recorded' : 'Not available'}',
          color: Colors.green.shade700,
          seconds: 4,
        );
      }
    }
  }
  
  Future<void> _logPhotoActivity(String documentType, Map<String, dynamic> metadata) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final driverId = prefs.getString(_kDriverIdKey) ?? '';
      if (driverId.isEmpty) return;
      
      final token = await ProfileStorageService.getAuthToken();
      final headers = <String, String>{'Content-Type': 'application/json'};
      if (token != null && token.trim().isNotEmpty) {
        headers['Authorization'] = 'Bearer ${token.trim()}';
      }
      
      await http.post(
        Uri.parse('$kApiBaseUrl/api/v1/drivers/activity-log'),
        headers: headers,
        body: json.encode({
          'driverId': driverId,
          'action': 'document_photo_captured',
          'documentType': documentType,
          'timestamp': metadata['captureTime'],
          'latitude': metadata['latitude'],
          'longitude': metadata['longitude'],
          'accuracy': metadata['accuracy'],
        }),
      ).timeout(const Duration(seconds: 5));
    } catch (_) {
      // Activity logging is non-critical, continue silently
    }
  }

  /// Upload one document to backend. Returns true on success.
  Future<bool> _uploadDocument(String driverId, String documentType, XFile xFile) async {
    try {
      final bytes = await xFile.readAsBytes();
      final uri = Uri.parse('$kApiBaseUrl/api/v1/drivers/documents');
      final token = await ProfileStorageService.getAuthToken();
      final request = http.MultipartRequest('POST', uri);
      if (token != null && token.trim().isNotEmpty) {
        request.headers['Authorization'] = 'Bearer ${token.trim()}';
      }
      request.fields['driverId'] = driverId;
      request.fields['documentType'] = documentType;
      
      // Include capture timestamp for 15-minute validation
      final prefs = await SharedPreferences.getInstance();
      final metadataJson = prefs.getString('doc_metadata_$documentType');
      if (metadataJson != null) {
        try {
          final metadata = json.decode(metadataJson) as Map<String, dynamic>;
          final captureTime = metadata['captureTime'] as String?;
          if (captureTime != null) {
            request.fields['captureTimestamp'] = captureTime;
          }
        } catch (_) {}
      }
      
      final ext = xFile.name.contains('.') ? '.${xFile.name.split('.').last}' : '.jpg';
      request.files.add(http.MultipartFile.fromBytes(
        'file',
        bytes,
        filename: '$documentType$ext',
      ));
      final streamed = await request.send().timeout(const Duration(seconds: 60));
      final response = await http.Response.fromStream(streamed);
      final status = response.statusCode;
      if (status >= 200 && status < 300) {
        // Auto-copy selfie to profile photo
        if (documentType == 'selfie') {
          try {
            final base64Image = base64Encode(bytes);
            await ProfileStorageService.savePhotoBase64(base64Image);
          } catch (_) {
            // Non-critical, continue
          }
        }
        return true;
      }
      // Non-2xx: surface server message for diagnosis
      String serverMsg = '';
      try {
        final data = json.decode(response.body) as Map<String, dynamic>?;
        serverMsg = (data?['message'] as String?) ?? response.body;
        if (data?['expired'] == true && mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('⏰ ${data?['message'] ?? 'Photo expired. Please retake.'}'),
              backgroundColor: Colors.red.shade700,
              duration: const Duration(seconds: 5),
            ),
          );
        }
      } catch (_) {
        serverMsg = response.body;
      }
      if (mounted) {
        String friendly = 'Upload failed ($status)';
        if (status == 401) friendly = 'Session expired. Please log in again.';
        if (serverMsg.isNotEmpty) friendly = '$friendly: $serverMsg';
        _showNotif(friendly, color: Colors.red.shade700, seconds: 6);
      }
      return false;
    } catch (e) {
      if (mounted) {
        _showNotif('Upload failed: $e', color: Colors.red.shade700, seconds: 6);
      }
      return false;
    }
  }

  @override
  Widget build(BuildContext context) {
    super.build(context); // Required for AutomaticKeepAliveClientMixin
    final t = AppLocaleScope.of(context)?.t ?? (String k, [Map<String, dynamic>? p]) => translate(k, defaultLocale, p);
    final isApproved = _status == 'approved';
    // UX: if documents are already submitted and under review, keep screen read-only to avoid confusion.
    final underReviewLocked = _status == 'pending' && _hasVerification && _reuploadDocumentTypes.isEmpty;
    return Scaffold(
      backgroundColor: AppTheme.darkBg,
      appBar: AppBar(
        title: Text(
          t('verification_title_conductor'),
          style: GoogleFonts.poppins(fontSize: 18, fontWeight: FontWeight.w600, color: AppTheme.neonOrange),
        ),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: AppTheme.neonOrange),
          onPressed: () => Navigator.of(context).pop(),
        ),
        backgroundColor: AppTheme.darkBg,
        elevation: 0,
      ),
      body: SafeArea(
        child: Column(
          children: [
            if (_loadingStatus)
              const Padding(
                padding: EdgeInsets.all(24),
                child: Center(child: CircularProgressIndicator(color: AppTheme.neonOrange)),
              )
            else if (_hasNoDriverId)
              Padding(
                padding: const EdgeInsets.all(24),
                child: Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.info_outline, size: 56, color: AppTheme.neonOrange),
                      const SizedBox(height: 16),
                      Text(
                        'Please go online first to get your Driver ID',
                        style: GoogleFonts.poppins(fontSize: 16, fontWeight: FontWeight.w600, color: AppTheme.onDark),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Open the menu, go to Home, then tap "Go Online". Your ID will appear in the menu.',
                        style: GoogleFonts.poppins(fontSize: 14, color: Colors.grey.shade400),
                        textAlign: TextAlign.center,
                      ),
                    ],
                  ),
                ),
              )
            else ...[
              _statusCard(t),
              const SizedBox(height: 16),
              if (isApproved) ...[
                // Bug fix: hide upload UI when documents are already approved.
                Expanded(child: _approvedPanel(t)),
                _bottomActions(t),
              ] else if (_isBlocked) ...[
                // Bug fix: block verification UI when account is rejected/blocked.
                Expanded(child: _blockedPanel(t)),
              ] else if (underReviewLocked) ...[
                // UX: show a clean "pending review" screen and hide upload steps.
                Expanded(child: _pendingReviewPanel(t)),
                _bottomActions(t),
              ] else ...[
                _stepIndicator(t),
                const SizedBox(height: 16),
                Expanded(
                  child: ListView(
                    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                    children: [
                      AnimatedSwitcher(
                        duration: const Duration(milliseconds: 220),
                        switchInCurve: Curves.easeOut,
                        switchOutCurve: Curves.easeIn,
                        child: _currentStep == 0
                            ? KeyedSubtree(key: const ValueKey<int>(0), child: _buildStep1(t))
                            : _currentStep == 1
                                ? KeyedSubtree(key: const ValueKey<int>(1), child: _buildStep2(t))
                                : KeyedSubtree(key: const ValueKey<int>(2), child: _buildStep3(t)),
                        transitionBuilder: (Widget child, Animation<double> animation) {
                          return FadeTransition(
                            opacity: animation,
                            child: SlideTransition(
                              position: Tween<Offset>(begin: const Offset(0.03, 0), end: Offset.zero).animate(animation),
                              child: child,
                            ),
                          );
                        },
                      ),
                    ],
                  ),
                ),
                _bottomActions(t),
              ],
            ],
          ],
        ),
      ),
    );
  }

  Widget _statusCard(String Function(String) t) {
    Color statusColor;
    IconData statusIcon;
    String statusLabel;
    final isDraft = _status == 'not_submitted' || (!_hasSubmitted &&
        (!_hasVerification ||
            (_status == 'pending' && _documentsCount == 0 && _reuploadDocumentTypes.isEmpty)));
    final submittedPending = _hasSubmitted && (_status == 'pending' || isDraft);
    if (submittedPending) {
      // Bug fix: show "Submitted" even if backend hasn't updated yet.
      statusColor = Colors.orange;
      statusIcon = Icons.schedule_send;
      statusLabel = t('verification_status_submitted');
    } else if (isDraft) {
      statusColor = Colors.blueGrey;
      statusIcon = Icons.upload_file;
      statusLabel = t('verification_status_draft');
    } else {
      switch (_status) {
        case 'approved':
          statusColor = Colors.green;
          statusIcon = Icons.check_circle;
          statusLabel = t('verification_status_approved');
          break;
        case 'rejected':
          statusColor = Colors.red;
          statusIcon = Icons.cancel;
          statusLabel = t('verification_status_rejected');
          break;
        case 'temp_blocked':
          statusColor = Colors.deepOrange;
          statusIcon = Icons.block;
          statusLabel = t('verification_status_temp_blocked');
          break;
        case 'suspended':
          statusColor = Colors.red.shade900;
          statusIcon = Icons.warning_amber_rounded;
          statusLabel = t('verification_status_suspended');
          break;
        default:
          statusColor = Colors.orange;
          statusIcon = Icons.schedule;
          statusLabel = t('verification_status_pending');
      }
    }
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Card(
        color: AppTheme.surfaceDark,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(statusIcon, color: statusColor, size: 36),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      t('verification_status'),
                      style: GoogleFonts.poppins(fontSize: 12, color: Colors.grey.shade400),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      statusLabel,
                      style: GoogleFonts.poppins(fontSize: 16, fontWeight: FontWeight.w600, color: AppTheme.onDark),
                    ),
                    if (submittedPending)
                      Padding(
                        padding: const EdgeInsets.only(top: 2),
                        child: Text(
                          t('verification_status_submitted_subtitle'),
                          style: GoogleFonts.poppins(fontSize: 12, color: Colors.grey.shade400),
                        ),
                      ),
                    if (isDraft)
                      Padding(
                        padding: const EdgeInsets.only(top: 2),
                        child: Text(
                          t('verification_status_draft_subtitle'),
                          style: GoogleFonts.poppins(fontSize: 12, color: Colors.grey.shade400),
                        ),
                      ),
                    if (!isDraft && !submittedPending && _status == 'pending' && _reuploadDocumentTypes.isEmpty)
                      Padding(
                        padding: const EdgeInsets.only(top: 2),
                        child: Text(
                          t('verification_status_pending_subtitle'),
                          style: GoogleFonts.poppins(fontSize: 12, color: Colors.grey.shade400),
                        ),
                      ),
                    if (!isDraft && _status == 'pending' && _reuploadDocumentTypes.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(top: 2),
                        child: Text(
                          t('verification_status_reupload_subtitle'),
                          style: GoogleFonts.poppins(fontSize: 12, color: Colors.orange.shade300),
                        ),
                      ),
                    if (!isDraft && _status == 'rejected')
                      Padding(
                        padding: const EdgeInsets.only(top: 2),
                        child: Text(
                          t('verification_status_rejected_subtitle'),
                          style: GoogleFonts.poppins(fontSize: 12, color: Colors.red.shade300),
                        ),
                      ),
                    if (!isDraft && (_status == 'temp_blocked' || _status == 'suspended') &&
                        _blockReason != null &&
                        _blockReason!.isNotEmpty) ...[
                      const SizedBox(height: 6),
                      Text(
                        t('verification_block_reason'),
                        style: GoogleFonts.poppins(fontSize: 11, color: Colors.grey.shade400),
                      ),
                      Text(
                        _blockReason!,
                        style: GoogleFonts.poppins(fontSize: 13, color: AppTheme.onDark),
                      ),
                    ],
                    if (!isDraft && _status == 'rejected' && _blockReason != null && _blockReason!.isNotEmpty) ...[
                      const SizedBox(height: 6),
                      Text(
                        _blockReason!,
                        style: GoogleFonts.poppins(fontSize: 13, color: Colors.red.shade300),
                      ),
                    ],
                    if (!isDraft && _reuploadDocumentTypes.isNotEmpty) ...[
                      const SizedBox(height: 10),
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: Colors.orange.withValues(alpha: 0.2),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: Colors.orange.shade400, width: 2),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Icon(Icons.upload_file, size: 18, color: Colors.orange.shade300),
                                const SizedBox(width: 6),
                                Text(
                                  'Reupload required',
                                  style: GoogleFonts.poppins(fontSize: 13, fontWeight: FontWeight.w700, color: Colors.orange.shade200),
                                ),
                              ],
                            ),
                            if (_reuploadMessage != null && _reuploadMessage!.isNotEmpty) ...[
                              const SizedBox(height: 4),
                              Text(
                                _reuploadMessage!,
                                style: GoogleFonts.poppins(fontSize: 12, color: AppTheme.onDark),
                              ),
                            ],
                            const SizedBox(height: 6),
                            Wrap(
                              spacing: 6,
                              runSpacing: 4,
                              children: _reuploadDocumentTypes.map((k) => Chip(
                                label: Text(_kDocKeyLabels[k] ?? k, style: GoogleFonts.poppins(fontSize: 11)),
                                backgroundColor: Colors.orange.shade100,
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                              )).toList(),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _blockedPanel(String Function(String) t) {
    const supportEmail = 'Support@transportbidder.com';
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
      child: Card(
        color: AppTheme.surfaceDark,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.support_agent, size: 42, color: Colors.orange.shade300),
              const SizedBox(height: 12),
              Text(
                t('driver_status_blocked'),
                textAlign: TextAlign.center,
                style: GoogleFonts.poppins(fontSize: 14, color: AppTheme.onDark),
              ),
              const SizedBox(height: 8),
              Text(
                supportEmail,
                style: GoogleFonts.poppins(fontSize: 13, fontWeight: FontWeight.w600, color: AppTheme.neonOrange),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _approvedPanel(String Function(String) t) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
      child: Card(
        color: AppTheme.surfaceDark,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.verified, size: 42, color: Colors.green.shade400),
              const SizedBox(height: 12),
              Text(
                t('verification_approved_recharge_body'),
                textAlign: TextAlign.center,
                style: GoogleFonts.poppins(fontSize: 14, color: AppTheme.onDark),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _pendingReviewPanel(String Function(String) t) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
      child: Card(
        color: AppTheme.surfaceDark,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.hourglass_top, size: 42, color: Colors.orange.shade300),
              const SizedBox(height: 12),
              Text(
                t('verification_pending_panel_title'),
                textAlign: TextAlign.center,
                style: GoogleFonts.poppins(fontSize: 15, fontWeight: FontWeight.w700, color: AppTheme.onDark),
              ),
              const SizedBox(height: 8),
              Text(
                t('verification_pending_panel_body'),
                textAlign: TextAlign.center,
                style: GoogleFonts.poppins(fontSize: 13, color: Colors.grey.shade400),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _stepIndicator(String Function(String) t) {
    final steps = [
      t('verification_step_personal'),
      t('verification_step_vehicle'),
      t('verification_step_review'),
    ];
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Row(
        children: List.generate(3, (i) {
          final active = i == _currentStep;
          final done = i < _currentStep;
          return Expanded(
            child: Row(
              children: [
                if (i > 0) Expanded(child: Container(height: 2, color: done ? AppTheme.neonOrange : Colors.grey.shade700)),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 4),
                  child: Column(
                    children: [
                      Container(
                        width: 28,
                        height: 28,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: active || done ? AppTheme.neonOrange : Colors.transparent,
                          border: Border.all(
                            color: active || done ? AppTheme.neonOrange : Colors.grey.shade600,
                            width: 2,
                          ),
                        ),
                        child: done
                            ? const Icon(Icons.check, size: 16, color: AppTheme.darkBg)
                            : Center(
                                child: Text(
                                  '${i + 1}',
                                  style: GoogleFonts.poppins(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w600,
                                    color: active ? AppTheme.darkBg : Colors.grey.shade400,
                                  ),
                                ),
                              ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        steps[i],
                        style: GoogleFonts.poppins(
                          fontSize: 10,
                          color: active ? AppTheme.neonOrange : Colors.grey.shade500,
                        ),
                        textAlign: TextAlign.center,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
                if (i < 2) Expanded(child: Container(height: 2, color: done ? AppTheme.neonOrange : Colors.grey.shade700)),
              ],
            ),
          );
        }),
      ),
    );
  }

  Widget _buildStep1(String Function(String) t) {
    final cards = [
      (t('verification_brevete_frente'), t('verification_brevete_frente_helper'), Icons.badge_outlined),
      (t('verification_brevete_dorso'), '', Icons.badge_outlined),
      (t('verification_dni'), '', Icons.credit_card_outlined),
      (t('verification_selfie'), t('verification_selfie_helper'), Icons.face_outlined),
    ];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          t('verification_personal_info'),
          style: GoogleFonts.poppins(fontSize: 14, color: Colors.grey.shade400),
        ),
        const SizedBox(height: 16),
        // City input
        _textInputField(
          controller: _cityController,
          label: 'City',
          hint: 'Enter your city',
          icon: Icons.location_city_outlined,
          onChanged: (value) => ProfileStorageService.saveCity(value),
        ),
        const SizedBox(height: 12),
        // DNI number input
        _textInputField(
          controller: _dniController,
          label: 'DNI Number',
          hint: 'Enter your DNI number',
          icon: Icons.badge_outlined,
          keyboardType: TextInputType.number,
          onChanged: (value) => ProfileStorageService.saveDni(value),
        ),
        const SizedBox(height: 16),
        // NEW: DNI Issue Date
        VehicleDatePicker(
          label: 'DNI Issue Date',
          selectedDate: _dniIssueDate,
          onDateSelected: (date) {
            setState(() {
              _dniIssueDate = date;
            });
          },
          lastDate: DateTime.now(),
        ),
        const SizedBox(height: 16),
        // NEW: DNI Expiry Date
        VehicleDatePicker(
          label: 'DNI Expiry Date',
          selectedDate: _dniExpiryDate,
          onDateSelected: (date) {
            setState(() {
              _dniExpiryDate = date;
            });
          },
          firstDate: DateTime.now(),
        ),
        const SizedBox(height: 16),
        // DNI photo upload (after DNI expiry date)
        Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: _uploadCard(t, key: _kPersonalDocKeys[2], title: cards[2].$1, helper: cards[2].$2, icon: cards[2].$3),
        ),
        const SizedBox(height: 12),
        // License number input
        _textInputField(
          controller: _licenseController,
          label: 'License Number',
          hint: 'Enter your license number',
          icon: Icons.credit_card_outlined,
          onChanged: (value) => ProfileStorageService.saveLicense(value),
        ),
        const SizedBox(height: 16),
        // Brevete frente
        Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: _uploadCard(t, key: _kPersonalDocKeys[0], title: cards[0].$1, helper: cards[0].$2, icon: cards[0].$3),
        ),
        // Brevete dorso
        Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: _uploadCard(t, key: _kPersonalDocKeys[1], title: cards[1].$1, helper: cards[1].$2, icon: cards[1].$3),
        ),
        // Antecedentes policiales
        _yesNoButtonGroup(
          t,
          t('verification_antecedentes_policiales'),
          _hasAntecedentesPoliciales,
          (value) => setState(() => _hasAntecedentesPoliciales = value),
        ),
        const SizedBox(height: 12),
        // Antecedentes penales
        _yesNoButtonGroup(
          t,
          t('verification_antecedentes_penales'),
          _hasAntecedentesPenales,
          (value) => setState(() => _hasAntecedentesPenales = value),
        ),
        const SizedBox(height: 12),
        // Selfie
        Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: _uploadCard(t, key: _kPersonalDocKeys[3], title: cards[3].$1, helper: cards[3].$2, icon: cards[3].$3),
        ),
      ],
    );
  }

  Widget _buildStep2(String Function(String) t) {
    final cards = [
      (t('verification_soat'), '', Icons.description_outlined),
      (t('verification_tarjeta_propiedad'), '', Icons.directions_car_outlined),
      (t('verification_foto_vehiculo'), t('verification_foto_vehiculo_helper'), Icons.photo_camera_outlined),
    ];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          t('verification_vehicle_docs_info'),
          style: GoogleFonts.poppins(fontSize: 14, color: Colors.grey.shade400),
        ),
        const SizedBox(height: 12),
        _vehicleTypeSelector(),
        const SizedBox(height: 16),
        // Vehicle plate input
        _textInputField(
          controller: _vehiclePlateController,
          label: 'Vehicle Plate',
          hint: 'Enter vehicle plate number',
          icon: Icons.directions_car_outlined,
          onChanged: (value) => ProfileStorageService.saveVehicle(value),
        ),
        const SizedBox(height: 16),
        // NEW: Vehicle Brand
        VehicleDropdown(
          label: 'Vehicle Brand *',
          value: _vehicleBrandController.text.isEmpty ? null : _vehicleBrandController.text,
          items: kPeruVehicleBrands,
          onChanged: (value) {
            setState(() {
              _vehicleBrandController.text = value ?? '';
              _showCustomBrand = value == 'Otro';
              if (!_showCustomBrand) _customBrandController.clear();
            });
          },
          hint: 'Select brand (Toyota, Nissan, etc.)',
        ),
        if (_showCustomBrand) ...[
          const SizedBox(height: 12),
          VehicleTextField(
            label: 'Custom Brand Name *',
            controller: _customBrandController,
            hint: 'Enter custom brand name',
            required: true,
          ),
        ],
        const SizedBox(height: 16),
        // NEW: Vehicle Model
        VehicleTextField(
          label: 'Vehicle Model *',
          controller: _vehicleModelController,
          hint: 'e.g., Corolla, Sentra, Accent',
          required: true,
        ),
        const SizedBox(height: 16),
        // NEW: Vehicle Color
        VehicleDropdown(
          label: 'Vehicle Color *',
          value: _vehicleColor.isEmpty ? null : _vehicleColor,
          items: kPeruVehicleColors,
          onChanged: (value) {
            setState(() {
              _vehicleColor = value ?? '';
              _showCustomColor = value == 'Otro';
              if (!_showCustomColor) _customColorController.clear();
            });
          },
          hint: 'Select color',
        ),
        if (_showCustomColor) ...[
          const SizedBox(height: 12),
          VehicleTextField(
            label: 'Custom Color Name *',
            controller: _customColorController,
            hint: 'Enter custom color name',
            required: true,
          ),
        ],
        const SizedBox(height: 16),
        // NEW: Registration Year
        VehicleDropdown(
          label: 'Registration Year *',
          value: _registrationYear?.toString(),
          items: kRegistrationYears,
          onChanged: (value) {
            setState(() {
              _registrationYear = value != null ? int.tryParse(value) : null;
            });
          },
          hint: 'Select year (2010-2050)',
        ),
        const SizedBox(height: 16),
        // NEW: Vehicle Capacity
        VehicleDropdown(
          label: 'Passenger Capacity *',
          value: _vehicleCapacity?.toString(),
          items: kVehicleCapacities.map((c) => c.toString()).toList(),
          onChanged: (value) {
            setState(() {
              _vehicleCapacity = value != null ? int.tryParse(value) : null;
            });
          },
          hint: 'Select capacity',
        ),
        const SizedBox(height: 16),
        // NEW: License Class
        VehicleDropdown(
          label: 'License Class *',
          value: _licenseClass.isEmpty ? null : _licenseClass,
          items: kPeruLicenseClasses,
          onChanged: (value) {
            setState(() {
              _licenseClass = value ?? '';
            });
          },
          hint: 'Select license class',
        ),
        const SizedBox(height: 16),
        // NEW: License Issue Date
        VehicleDatePicker(
          label: 'License Issue Date *',
          selectedDate: _licenseIssueDate,
          onDateSelected: (date) {
            setState(() {
              _licenseIssueDate = date;
            });
          },
          required: true,
          lastDate: DateTime.now(),
        ),
        const SizedBox(height: 16),
        // NEW: License Expiry Date
        VehicleDatePicker(
          label: 'License Expiry Date *',
          selectedDate: _licenseExpiryDate,
          onDateSelected: (date) {
            setState(() {
              _licenseExpiryDate = date;
            });
          },
          required: true,
          firstDate: DateTime.now(),
        ),
        const SizedBox(height: 16),
        ...List.generate(3, (i) {
          final key = _kVehicleDocKeys[i];
          final (title, helper, icon) = cards[i];
          return Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: _uploadCard(t, key: key, title: title, helper: helper, icon: icon),
          );
        }),
      ],
    );
  }

  Widget _vehicleTypeSelector() {
    final categories = [
      ['Taxi', 'taxi'],
      ['Truck', 'truck'],
      ['Bike', 'bike'],
      ['Delivery', 'delivery'],
      ['Ambulance', 'ambulance'],
    ];
    final Map<String, List<List<String>>> subTypes = {
      'taxi': [
        ['Taxi Std (4)', 'taxi_std'],
        ['Taxi SUV (6)', 'taxi_suv'],
        ['Taxi XL (8)', 'taxi_xl'],
        ['Taxi XXL (12)', 'van_12'],
        ['Van (8)', 'van_8'],
      ],
      'truck': [
        ['Truck S (1T)', 'truck_s'],
        ['Truck M (3T)', 'truck_m'],
        ['Truck L (10T)', 'truck_l'],
      ],
      'bike': [
        ['Bike', 'moto'],
      ],
      'delivery': [
        ['Delivery', 'delivery'],
      ],
      'ambulance': [
        ['Basic', 'ambulance_basic'],
        ['ICU', 'ambulance_icu'],
      ],
    };
    final catValues = categories.map((c) => c[1]).toSet();
    String currentCat = (_vehicleCategory.isNotEmpty && catValues.contains(_vehicleCategory)) ? _vehicleCategory : (categories.first[1]);
    List<List<String>> sub = subTypes[currentCat] ?? subTypes['taxi']!;
    final subValues = sub.map((c) => c[1]).toSet();
    String currentType = (_vehicleType.isNotEmpty && subValues.contains(_vehicleType)) ? _vehicleType : sub.first[1];
    return Card(
      color: AppTheme.surfaceDark,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Service', style: GoogleFonts.poppins(fontSize: 13, color: Colors.grey.shade400)),
            const SizedBox(height: 6),
            DropdownButtonFormField<String>(
              initialValue: currentCat,
              items: categories
                  .map((c) => DropdownMenuItem<String>(
                        value: c[1],
                        child: Text(c[0], style: GoogleFonts.poppins(fontSize: 14, color: AppTheme.onDark)),
                      ))
                  .toList(),
              onChanged: (v) async {
                if (v == null) return;
                final list = subTypes[v] ?? [];
                final first = list.isNotEmpty ? list.first[1] : '';
                setState(() {
                  _vehicleCategory = v;
                  _vehicleType = first;
                });
                if (first.isNotEmpty) await ProfileStorageService.saveVehicleType(first);
              },
              dropdownColor: AppTheme.surfaceDark,
              decoration: InputDecoration(
                filled: true,
                fillColor: AppTheme.surfaceDark,
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: Colors.grey.shade700)),
                enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: Colors.grey.shade700)),
                contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              ),
            ),
            const SizedBox(height: 12),
            Text('Sub type', style: GoogleFonts.poppins(fontSize: 13, color: Colors.grey.shade400)),
            const SizedBox(height: 6),
            DropdownButtonFormField<String>(
              initialValue: currentType,
              items: sub
                  .map((c) => DropdownMenuItem<String>(
                        value: c[1],
                        child: Text(c[0], style: GoogleFonts.poppins(fontSize: 14, color: AppTheme.onDark)),
                      ))
                  .toList(),
              onChanged: (v) async {
                if (v == null) return;
                setState(() => _vehicleType = v);
                await ProfileStorageService.saveVehicleType(v);
              },
              dropdownColor: AppTheme.surfaceDark,
              decoration: InputDecoration(
                filled: true,
                fillColor: AppTheme.surfaceDark,
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: Colors.grey.shade700)),
                enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: Colors.grey.shade700)),
                contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _uploadCard(
    String Function(String) t, {
    required String key,
    required String title,
    required String helper,
    required IconData icon,
  }) {
    final path = _docPaths[key];
    final hasFile = (path ?? '').isNotEmpty;
    final needsReupload = _reuploadDocumentTypes.contains(key);
    // Guard: disable upload when status is pending and no reupload is requested for this doc.
    bool canUpload = true;
    if (_status == 'pending') {
      // Bug fix: when verification is pending and no reupload is requested, lock uploads.
      final underReview = _hasVerification && _reuploadDocumentTypes.isEmpty;
      if (underReview) {
        canUpload = false;
      } else if (_reuploadDocumentTypes.isNotEmpty && !_reuploadDocumentTypes.contains(key)) {
        canUpload = false;
      }
    }
    return Card(
      color: AppTheme.surfaceDark,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      elevation: needsReupload ? 2 : 0,
      margin: EdgeInsets.zero,
      child: Container(
        decoration: needsReupload
            ? BoxDecoration(
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: Colors.orange.shade500, width: 2),
              )
            : null,
        child: InkWell(
          onTap: canUpload ? () => _pickDoc(key) : null,
          borderRadius: BorderRadius.circular(10),
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Row(
              children: [
                Icon(icon, color: AppTheme.neonOrange, size: 28),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: GoogleFonts.poppins(fontSize: 15, fontWeight: FontWeight.w500, color: AppTheme.onDark),
                      ),
                      if (helper.isNotEmpty)
                        Text(
                          helper,
                          style: GoogleFonts.poppins(fontSize: 12, color: Colors.grey.shade500),
                        ),
                    ],
                  ),
                ),
                if (hasFile) ...[
                  Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      color: Colors.grey.shade800,
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(6),
                      child: picked_image.buildPickedImageThumbnail(path!),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      if (_reuploadDocumentTypes.contains(key))
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: Colors.orange.shade700.withValues(alpha: 0.4),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text(
                            'Reupload requested',
                            style: GoogleFonts.poppins(fontSize: 10, color: Colors.orange.shade200),
                          ),
                        )
                      else
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(
                            color: Colors.orange.withValues(alpha: 0.3),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Text(
                            t('verification_status_pending'),
                            style: GoogleFonts.poppins(fontSize: 11, color: Colors.orange.shade200),
                          ),
                        ),
                    ],
                  ),
                ] else
                  canUpload
                      ? Container(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                          decoration: BoxDecoration(
                            color: AppTheme.neonOrange.withValues(alpha: 0.2),
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: Text(
                            t('verification_upload_btn'),
                            style: GoogleFonts.poppins(fontSize: 13, fontWeight: FontWeight.w600, color: AppTheme.neonOrange),
                          ),
                        )
                      : Text(
                          t('verification_under_review_locked'),
                          style: GoogleFonts.poppins(fontSize: 12, color: Colors.grey.shade500),
                        ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildStep3(String Function(String) t) {
    final hasMissing = !_allDocsReady;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          t('verification_docs_personal_summary'),
          style: GoogleFonts.poppins(fontSize: 14, fontWeight: FontWeight.w600, color: AppTheme.neonOrange),
        ),
        const SizedBox(height: 8),
        ..._kPersonalDocKeys.map((k) => _summaryRow(t, k)),
        const SizedBox(height: 20),
        Text(
          t('verification_docs_vehicle_summary'),
          style: GoogleFonts.poppins(fontSize: 14, fontWeight: FontWeight.w600, color: AppTheme.neonOrange),
        ),
        const SizedBox(height: 8),
        ..._kVehicleDocKeys.map((k) => _summaryRow(t, k)),
        if (hasMissing) ...[
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.red.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: Colors.red.shade400, width: 1),
            ),
            child: Row(
              children: [
                Icon(Icons.warning_amber_rounded, color: Colors.red.shade400, size: 24),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    t('verification_incomplete_banner'),
                    style: GoogleFonts.poppins(fontSize: 14, color: Colors.red.shade200),
                  ),
                ),
              ],
            ),
          ),
        ],
        const SizedBox(height: 24),
        Text(
          t('verification_submit_note'),
          style: GoogleFonts.poppins(fontSize: 12, color: Colors.grey.shade500),
        ),
        if (_status == 'rejected' && _blockReason != null && _blockReason!.isNotEmpty) ...[
          const SizedBox(height: 12),
          OutlinedButton.icon(
            onPressed: () => setState(() => _currentStep = 0),
            icon: const Icon(Icons.refresh, size: 18),
            label: Text(t('verification_reupload')),
          ),
        ],
      ],
    );
  }

  Widget _summaryRow(String Function(String) t, String key) {
    final labels = {
      'brevete_frente': t('verification_brevete_frente'),
      'brevete_dorso': t('verification_brevete_dorso'),
      'dni': t('verification_dni'),
      'selfie': t('verification_selfie'),
      'soat': t('verification_soat'),
      'tarjeta_propiedad': t('verification_tarjeta_propiedad'),
      'foto_vehiculo': t('verification_foto_vehiculo'),
    };
    final hasFile = (_docPaths[key] ?? '').isNotEmpty;
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        children: [
          Icon(
            hasFile ? Icons.check_circle_outline : Icons.radio_button_unchecked,
            size: 18,
            color: hasFile ? Colors.green : Colors.grey.shade500,
          ),
          const SizedBox(width: 8),
          Text(labels[key] ?? key, style: GoogleFonts.poppins(fontSize: 14, color: AppTheme.onDark)),
          const Spacer(),
          if (hasFile)
            TextButton(
              onPressed: () => _viewDoc(key),
              child: Text(t('verification_view'), style: const TextStyle(fontSize: 12)),
            ),
        ],
      ),
    );
  }

  Widget _textInputField({
    required TextEditingController controller,
    required String label,
    required String hint,
    required IconData icon,
    TextInputType keyboardType = TextInputType.text,
    required Function(String) onChanged,
  }) {
    return Card(
      color: AppTheme.surfaceDark,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        child: TextFormField(
          controller: controller,
          keyboardType: keyboardType,
          style: GoogleFonts.poppins(fontSize: 14, color: AppTheme.onDark),
          decoration: InputDecoration(
            labelText: label,
            hintText: hint,
            prefixIcon: Icon(icon, color: AppTheme.neonOrange, size: 22),
            labelStyle: GoogleFonts.poppins(color: AppTheme.neonOrange),
            hintStyle: GoogleFonts.poppins(color: Colors.grey.shade600),
            border: InputBorder.none,
            enabledBorder: InputBorder.none,
            focusedBorder: InputBorder.none,
          ),
          onChanged: onChanged,
        ),
      ),
    );
  }

  Widget _yesNoButtonGroup(String Function(String) t, String question, bool value, Function(bool) onChanged) {
    return Card(
      color: AppTheme.surfaceDark,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              question,
              style: GoogleFonts.poppins(fontSize: 14, fontWeight: FontWeight.w500, color: AppTheme.onDark),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: GestureDetector(
                    onTap: () => onChanged(true),
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 10),
                      decoration: BoxDecoration(
                        color: value ? AppTheme.neonOrange : Colors.transparent,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: AppTheme.neonOrange, width: 1),
                      ),
                      child: Text(
                        t('verification_yes'),
                        textAlign: TextAlign.center,
                        style: GoogleFonts.poppins(
                          fontSize: 14,
                          fontWeight: FontWeight.w500,
                          color: value ? AppTheme.darkBg : AppTheme.neonOrange,
                        ),
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: GestureDetector(
                    onTap: () => onChanged(false),
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 10),
                      decoration: BoxDecoration(
                        color: !value ? AppTheme.neonOrange : Colors.transparent,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: AppTheme.neonOrange, width: 1),
                      ),
                      child: Text(
                        t('verification_no'),
                        textAlign: TextAlign.center,
                        style: GoogleFonts.poppins(
                          fontSize: 14,
                          fontWeight: FontWeight.w500,
                          color: !value ? AppTheme.darkBg : AppTheme.neonOrange,
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _bottomActions(String Function(String) t) {
    if (_status == 'approved') {
      return Padding(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 20),
        child: SizedBox(
          width: double.infinity,
          child: OutlinedButton(
            onPressed: () => Navigator.of(context).pop(),
            child: Text(t('verification_view_docs')),
          ),
        ),
      );
    }
    if (_status == 'rejected' || _status == 'temp_blocked' || _status == 'suspended') {
      return Padding(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              t('verification_blocked_banner'),
              style: GoogleFonts.poppins(fontSize: 12, color: Colors.red.shade300),
              textAlign: TextAlign.center,
            ),
            if (_status == 'rejected' || _reuploadDocumentTypes.isNotEmpty) ...[
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: () => setState(() {
                    _currentStep = 0;
                    if (_reuploadDocumentTypes.isNotEmpty && _reuploadDocumentTypes.length <= 4) {
                      _currentStep = 0;
                    } else if (_reuploadDocumentTypes.isNotEmpty) {
                      _currentStep = _reuploadDocumentTypes.any((k) => _kVehicleDocKeys.contains(k)) ? 1 : 0;
                    }
                  }),
                  icon: const Icon(Icons.upload_file, size: 18),
                  label: Text(t('verification_fix_documents')),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppTheme.neonOrange,
                    foregroundColor: AppTheme.darkBg,
                    padding: const EdgeInsets.symmetric(vertical: 12),
                  ),
                ),
              ),
            ],
          ],
        ),
      );
    }

    // Pending + admin requested reupload: show "Fix documents" button
    if (_status == 'pending' && _reuploadDocumentTypes.isNotEmpty) {
      return Padding(
        padding: EdgeInsets.fromLTRB(20, 12, 20, 20 + MediaQuery.of(context).padding.bottom),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              t('verification_status_reupload_subtitle'),
              style: GoogleFonts.poppins(fontSize: 12, color: Colors.orange.shade300),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: () => setState(() {
                  _currentStep = _reuploadDocumentTypes.any((k) => _kVehicleDocKeys.contains(k)) ? 1 : 0;
                }),
                icon: const Icon(Icons.upload_file, size: 18),
                label: Text(t('verification_fix_documents')),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppTheme.neonOrange,
                  foregroundColor: AppTheme.darkBg,
                  padding: const EdgeInsets.symmetric(vertical: 12),
                ),
              ),
            ),
          ],
        ),
      );
    }

    final underReviewLocked = _status == 'pending' && _hasVerification && _reuploadDocumentTypes.isEmpty;
    if (underReviewLocked) {
      return Padding(
        padding: EdgeInsets.fromLTRB(20, 12, 20, 20 + MediaQuery.of(context).padding.bottom),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            ElevatedButton.icon(
              onPressed: () async {
                // UX: allow driver to manually refresh status while under review.
                if (mounted) setState(() => _loadingStatus = true);
                await _fetchVerificationStatus();
              },
              icon: const Icon(Icons.refresh, size: 18),
              label: Text(t('refresh_status')),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppTheme.neonOrange,
                foregroundColor: AppTheme.darkBg,
                padding: const EdgeInsets.symmetric(vertical: 12),
              ),
            ),
            const SizedBox(height: 8),
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: Text(t('close')),
            ),
          ],
        ),
      );
    }

    return Container(
      padding: EdgeInsets.fromLTRB(20, 12, 20, 20 + MediaQuery.of(context).padding.bottom),
      decoration: const BoxDecoration(color: AppTheme.darkBg),
      child: Row(
        children: [
          TextButton(
            onPressed: () {
              if (_currentStep == 0) {
                Navigator.of(context).pop();
              } else {
                setState(() => _currentStep--);
              }
            },
            child: Text(_currentStep == 0 ? t('verification_save_exit') : t('verification_back')),
          ),
          const Spacer(),
          if (_currentStep == 0)
            ElevatedButton(
              onPressed: _allPersonalDocsUploaded
                  ? () => setState(() => _currentStep = 1)
                  : null,
              child: Text(t('verification_next_vehicle')),
            )
          else if (_currentStep == 1)
            ElevatedButton(
              onPressed: _allVehicleDocsUploaded
                  ? () => setState(() => _currentStep = 2)
                  : null,
              child: Text(t('verification_next_review')),
            )
          else
            ElevatedButton(
              onPressed: _allDocsReady && !_submitting ? _submitForReview : null,
              child: _submitting
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2, color: AppTheme.darkBg),
                    )
                  : Text(t('verification_submit_review')),
            ),
        ],
      ),
    );
  }

  Future<void> _submitForReview() async {
    setState(() => _submitting = true);
    try {
      final prefs = await SharedPreferences.getInstance();
      final driverId = prefs.getString(_kDriverIdKey) ?? '';
      if (driverId.isEmpty) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(translate('verification_need_online', defaultLocale)),
              backgroundColor: Colors.orange.shade700,
            ),
          );
        }
        if (mounted) setState(() => _submitting = false);
        return;
      }

      // Revision mode: admin requested specific docs — only validate + upload those docs
      final isRevisionMode = _reuploadDocumentTypes.isNotEmpty;

      if (!isRevisionMode) {
        // Full submission: validate all mandatory fields
        final missingFields = <String>[];
        if (_vehicleBrandController.text.isEmpty) missingFields.add('Vehicle Brand');
        if (_showCustomBrand && _customBrandController.text.trim().isEmpty) missingFields.add('Custom Brand Name');
        if (_vehicleModelController.text.trim().isEmpty) missingFields.add('Vehicle Model');
        if (_vehicleColor.isEmpty) missingFields.add('Vehicle Color');
        if (_showCustomColor && _customColorController.text.trim().isEmpty) missingFields.add('Custom Color Name');
        if (_registrationYear == null) missingFields.add('Registration Year');
        if (_vehicleCapacity == null) missingFields.add('Passenger Capacity');
        if (_licenseClass.isEmpty) missingFields.add('License Class');
        if (_licenseIssueDate == null) missingFields.add('License Issue Date');
        if (_licenseExpiryDate == null) missingFields.add('License Expiry Date');

        // Check all required documents are uploaded (consider cached backend URLs too)
        for (final key in [..._kPersonalDocKeys, ..._kVehicleDocKeys]) {
          final hasNewFile = _docFiles[key] != null;
          final hasCachedPath = (_docPaths[key] ?? '').isNotEmpty;
          if (!hasNewFile && !hasCachedPath) {
            missingFields.add(key.replaceAll('_', ' ').toUpperCase());
          }
        }

        if (missingFields.isNotEmpty) {
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text('Please fill all mandatory fields: ${missingFields.join(', ')}'),
                backgroundColor: Colors.red.shade700,
                duration: const Duration(seconds: 5),
              ),
            );
          }
          if (mounted) setState(() => _submitting = false);
          return;
        }
      } else {
        // Revision mode: only check that requested doc types have been selected
        final missing = <String>[];
        for (final key in _reuploadDocumentTypes) {
          final hasNewFile = _docFiles[key] != null;
          if (!hasNewFile) {
            missing.add(_kDocKeyLabels[key] ?? key);
          }
        }
        if (missing.isNotEmpty) {
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text('Please select new photos for: ${missing.join(', ')}'),
                backgroundColor: Colors.orange.shade700,
                duration: const Duration(seconds: 5),
              ),
            );
          }
          if (mounted) setState(() => _submitting = false);
          return;
        }
      }

      // Upload documents: in revision mode only upload the requested types; in full mode upload all new files
      final docsToUpload = isRevisionMode ? _reuploadDocumentTypes : [..._kPersonalDocKeys, ..._kVehicleDocKeys];
      for (final key in docsToUpload) {
        final xFile = _docFiles[key];
        if (xFile != null) {
          final ok = await _uploadDocument(driverId, key, xFile);
          if (!ok && mounted) {
            setState(() => _submitting = false);
            return;
          }
        }
      }
      final driverName = await ProfileStorageService.getName();
      final driverEmail = await ProfileStorageService.getEmail();
      final driverPhone = await ProfileStorageService.getPhone();
      final vehiclePlate = _vehiclePlateController.text.trim();
      final city = _cityController.text.trim();
      final dni = _dniController.text.trim();
      final license = _licenseController.text.trim();
      final token = await ProfileStorageService.getAuthToken();
      final headers = <String, String>{'Content-Type': 'application/json'};
      if (token != null && token.trim().isNotEmpty) {
        headers['Authorization'] = 'Bearer ${token.trim()}';
      }
      final res = await http.post(
        Uri.parse('$kApiBaseUrl/api/v1/drivers/verification-register'),
        headers: headers,
        body: json.encode({
          'driverId': driverId,
          if ((driverName ?? '').trim().isNotEmpty) 'driverName': driverName!.trim(),
          if ((driverEmail ?? '').trim().isNotEmpty) 'email': driverEmail!.trim(),
          if ((driverPhone ?? '').trim().isNotEmpty) 'phone': driverPhone!.trim(),
          if (vehiclePlate.isNotEmpty) 'vehiclePlate': vehiclePlate,
          if (city.isNotEmpty) 'city': city,
          if (dni.isNotEmpty) 'dni': dni,
          if (license.isNotEmpty) 'license': license,
          if (_vehicleCategory.isNotEmpty) 'vehicleType': _vehicleCategory,
          'hasAntecedentesPoliciales': _hasAntecedentesPoliciales,
          'hasAntecedentesPenales': _hasAntecedentesPenales,
          // NEW: Vehicle detail fields (use custom if "Otro" selected)
          if (_vehicleBrandController.text.isNotEmpty) 'vehicleBrand': _showCustomBrand ? _customBrandController.text.trim() : _vehicleBrandController.text,
          if (_vehicleModelController.text.isNotEmpty) 'vehicleModel': _vehicleModelController.text,
          if (_vehicleColor.isNotEmpty) 'vehicleColor': _showCustomColor ? _customColorController.text.trim() : _vehicleColor,
          if (_registrationYear != null) 'registrationYear': _registrationYear,
          if (_vehicleCapacity != null) 'vehicleCapacity': _vehicleCapacity,
          // NEW: License detail fields
          if (_licenseClass.isNotEmpty) 'licenseClass': _licenseClass,
          if (_licenseIssueDate != null) 'licenseIssueDate': _licenseIssueDate!.toIso8601String().split('T')[0],
          if (_licenseExpiryDate != null) 'licenseExpiryDate': _licenseExpiryDate!.toIso8601String().split('T')[0],
          // NEW: DNI date fields
          if (_dniIssueDate != null) 'dniIssueDate': _dniIssueDate!.toIso8601String().split('T')[0],
          if (_dniExpiryDate != null) 'dniExpiryDate': _dniExpiryDate!.toIso8601String().split('T')[0],
        }),
      ).timeout(const Duration(seconds: 10));
      if (res.statusCode >= 200 && res.statusCode < 300) {
        final submittedKey = 'verification_submitted_at_$driverId';
        final now = DateTime.now().toIso8601String();
        await prefs.setString(submittedKey, now);
        if (mounted) {
          setState(() {
            _hasSubmitted = true;
          });
        }
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(translate('verification_submitted', defaultLocale)), backgroundColor: Colors.green.shade700),
          );
        }
      } else {
        final data = json.decode(res.body) as Map<String, dynamic>?;
        final msg = data?['message'] as String? ?? 'Submit failed (${res.statusCode})';
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(msg), backgroundColor: Colors.red.shade700),
          );
        }
      }
      await _fetchVerificationStatus();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Cannot reach server. Is backend running? (${e.toString().split('\n').first})'),
            backgroundColor: Colors.red.shade700,
          ),
        );
      }
    }
    if (mounted) {
      setState(() {
        _submitting = false;
      });
    }
  }
}
