import 'dart:async';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:tbidder_driver_app/core/app_theme.dart';
import 'package:tbidder_driver_app/core/firm_config.dart';
import 'package:tbidder_driver_app/features/auth/login_screen.dart';
import 'package:tbidder_driver_app/features/verification/verification_screen.dart';
import 'package:tbidder_driver_app/features/profile/profile_screen.dart';
import 'package:tbidder_driver_app/features/settings/settings_screen.dart';
import 'package:tbidder_driver_app/features/wallet/wallet_screen.dart';
import 'package:tbidder_driver_app/features/wallet/scratch_card_screen.dart';
import 'package:tbidder_driver_app/features/earnings/earnings_screen.dart';
import 'package:tbidder_driver_app/models/incoming_request.dart';
import 'package:tbidder_driver_app/services/driver_notification_service.dart';
import 'package:tbidder_driver_app/services/location_service.dart';
import 'package:tbidder_driver_app/services/ride_bid_service.dart' show RideBidService, DriverBlockedException;
import 'package:tbidder_driver_app/services/earnings_service.dart';
import 'package:tbidder_driver_app/services/profile_storage_service.dart';
import 'package:tbidder_driver_app/services/wallet_api.dart';
import 'package:tbidder_driver_app/l10n/app_locale.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';

const String _kLocationAlwaysPopupShown = 'driver_location_always_popup_shown';
const String _kDriverIdKey = 'driver_on_duty_id';
const String _kDriverLastLat = 'driver_last_lat';
const String _kDriverLastLng = 'driver_last_lng';
const String _kDriverStatusNoticePrefix = 'driver_status_notice_';
const String _kScratchPopupShownPrefix = 'scratch_popup_shown_';

const LatLng _defaultCenter = LatLng(-12.046374, -77.042793);

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> with WidgetsBindingObserver {
  final Completer<GoogleMapController> _mapCompleter = Completer<GoogleMapController>();
  final DriverNotificationService _notificationService = DriverNotificationService();
  final RideBidService _rideBidService = RideBidService();
  final LocationService _locationService = LocationService();
  final EarningsService _earningsService = EarningsService();
  final WalletApi _walletApi = WalletApi();
  Position? _userPosition;
  bool _locationDenied = false;
  bool _isOnline = false;
  IncomingRequest? _incomingRequest;
  CameraPosition _initialCamera = const CameraPosition(target: _defaultCenter, zoom: 14);
  Timer? _requestPollTimer;
  final Set<String> _declinedRideIds = {};
  String? _acceptedRideId;
  IncomingRequest? _acceptedRide;
  String? _acceptedRideStatus; // 'to_pickup' | 'arrived' | 'to_drop'
  Timer? _driverLocationTimer;
  StreamSubscription<LatLng>? _locationStreamSubscription;
  LatLng? _driverMarkerPosition;
  BitmapDescriptor? _driverCarIcon;
  String? _driverId;
  String? _driverPhone;
  String _driverVehicleType = 'car'; // loaded from profile/server
  Timer? _driverLocationPingTimer;
  bool _showLocationOffDialog = false;
  bool _isEndDrawerOpen = false; // used to disable map gestures when drawer open
  String? _driverVerificationStatus; // cached verification status for gating wallet shortcuts
  String? _driverBlockReason;
  bool _showBlockedOverlay = false;
  int? _walletSummaryBalance;
  String? _walletSummaryExpiry;
  bool _scratchCanScratch = false;
  bool _scratchPopupShownThisSession = false;
  
  // Bidding state
  final Set<String> _myBidRideIds = {};
  Timer? _myBidsTimer;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _initLocation();
    _loadDriverCarIcon();
    _loadDriverId();
  }

  Future<void> _loadDriverId() async {
    final prefs = await SharedPreferences.getInstance();
    final id = prefs.getString(_kDriverIdKey);
    var phone = await ProfileStorageService.getPhone();

    // Check driver verification status from backend (non-blocking for new drivers).
    if (phone != null && phone.isNotEmpty) {
      try {
        final verificationStatus = await _rideBidService.getVerificationStatusByPhone(phone);
        if (verificationStatus['success'] == true) {
          debugPrint('Driver verification status: ${verificationStatus['status']}');
        }
        // Allow driver through regardless — new drivers need to reach verification screen.
        // Only log if the check itself failed (network error, no auth token, etc.).
      } catch (e) {
        debugPrint('Driver verification check failed: $e');
      }
    }
    // Load cached vehicle type from profile storage
    final cachedVt = await ProfileStorageService.getVehicleType();
    setState(() {
      _driverId = id;
      _driverPhone = phone;
      if (cachedVt != null && cachedVt.isNotEmpty) {
        _driverVehicleType = cachedVt;
      }
    });
    if (id != null && id.isNotEmpty) {
      _loadWalletSummary(id);
      await _refreshVerificationStatus(id, showNotice: true);
      // Fetch vehicle type from server profile (source of truth)
      await _loadVehicleTypeFromServer(id);
    }
    await _resolveDriverIdFromServer();
    // Daily scratch card: load status after we have the final (resolved) driverId.
    final effectiveId = _driverId;
    if (effectiveId != null && effectiveId.isNotEmpty) {
      await _refreshVerificationStatus(effectiveId);
      await _loadScratchStatus(effectiveId, maybeShowPopup: true);
      // Also try loading vehicle type if not loaded yet
      if (_driverVehicleType == 'car' && cachedVt == null) {
        await _loadVehicleTypeFromServer(effectiveId);
      }
    }
  }

  /// Fetch vehicleType from backend driver profile and cache it locally.
  Future<void> _loadVehicleTypeFromServer(String driverId) async {
    try {
      final statusData = await _rideBidService.getVerificationStatus(driverId);
      if (!mounted || statusData == null) return;
      final vt = (statusData['vehicleType'] as String?)?.trim().toLowerCase();
      if (vt != null && vt.isNotEmpty) {
        setState(() => _driverVehicleType = vt);
        await ProfileStorageService.saveVehicleType(vt);
      }
    } catch (_) {}
  }

  /// Resolve driverId using phone mapping (server source of truth).
  Future<void> _resolveDriverIdFromServer() async {
    var phone = _driverPhone ?? await ProfileStorageService.getPhone();
    if (phone == null || phone.trim().isEmpty) return;
    final resolved = await _rideBidService.resolveDriverIdByPhone(phone);
    if (!mounted) return;
    if (resolved != null && resolved.isNotEmpty && resolved != _driverId) {
      setState(() {
        _driverId = resolved;
        _driverPhone = phone;
      });
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_kDriverIdKey, resolved);
      return;
    }
    if (_driverPhone == null || _driverPhone!.isEmpty) {
      setState(() => _driverPhone = phone);
    }
  }

  /// Ensure driverId (and phone) is loaded before Go Online to avoid accidental new IDs.
  Future<void> _ensureDriverIdLoaded() async {
    if ((_driverId != null && _driverId!.isNotEmpty) && (_driverPhone != null && _driverPhone!.isNotEmpty)) {
      return;
    }
    final prefs = await SharedPreferences.getInstance();
    final id = prefs.getString(_kDriverIdKey);
    var phone = await ProfileStorageService.getPhone();
    if (!mounted) return;
    setState(() {
      if (id != null && id.isNotEmpty) {
        _driverId = id;
      }
      if (phone != null && phone.isNotEmpty) {
        _driverPhone = phone;
      }
    });
  }

  bool _isBlockedStatus(String? status) {
    return status == 'rejected' || status == 'suspended' || status == 'temp_blocked';
  }

  Future<void> _refreshVerificationStatus(String? driverId, {bool showNotice = false}) async {
    if (driverId == null || driverId.isEmpty) return;
    try {
      final statusData = await _rideBidService.getVerificationStatus(driverId);
      if (!mounted || statusData == null) return;
      final status = (statusData['status'] as String?) ?? 'pending';
      final blockReason = statusData['blockReason'] as String?;
      setState(() {
        _driverVerificationStatus = status;
        _driverBlockReason = blockReason;
        _showBlockedOverlay = _isBlockedStatus(status);
      });
      if (showNotice) {
        await _maybeShowStatusNotice(driverId, status, blockReason);
      }
    } catch (_) {}
  }

  Future<void> _maybeShowStatusNotice(String driverId, String status, String? blockReason) async {
    if (!mounted) return;
    if (status != 'approved' && !_isBlockedStatus(status)) return;
    final prefs = await SharedPreferences.getInstance();
    final key = '$_kDriverStatusNoticePrefix${driverId}_$status';
    if (prefs.getBool(key) == true) return;
    if (!mounted) return;
    final titleKey = status == 'approved'
        ? 'verification_status_approved'
        : status == 'suspended'
            ? 'verification_status_suspended'
            : status == 'rejected'
                ? 'verification_status_rejected'
                : 'verification_status_temp_blocked';
    final title = _t(titleKey);
    final body = status == 'approved'
        ? _t('driver_status_approved_notice')
        : (blockReason?.isNotEmpty == true
            ? _t('driver_status_blocked_reason', {'reason': blockReason!})
            : _t('driver_status_blocked'));
    await showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(title, style: GoogleFonts.poppins()),
        content: Text(body, style: GoogleFonts.poppins()),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text(_t('ok'), style: GoogleFonts.poppins()),
          ),
        ],
      ),
    );
    await prefs.setBool(key, true);
  }

  Future<void> _loadWalletSummary(String driverId) async {
    try {
      final (balance, validUntil) = await _walletApi.getBalanceWithValidity(driverId);
      if (!mounted) return;
      setState(() {
        _walletSummaryBalance = balance;
        _walletSummaryExpiry = validUntil;
      });
    } catch (_) {
      // ignore wallet summary errors on home
    }
  }

  String _todayKey() {
    final now = DateTime.now();
    final y = now.year.toString().padLeft(4, '0');
    final m = now.month.toString().padLeft(2, '0');
    final d = now.day.toString().padLeft(2, '0');
    return '$y-$m-$d';
  }

  Future<void> _loadScratchStatus(String driverId, {bool maybeShowPopup = false}) async {
    try {
      final status = await _walletApi.getScratchStatus(driverId);
      if (!mounted) return;
      setState(() {
        _scratchCanScratch = status.canScratch;
      });
      if (maybeShowPopup) {
        await _maybeShowScratchPopupIfNeeded(driverId);
      }
    } catch (_) {
      // ignore scratch status errors on home
    }
  }

  Future<void> _maybeShowScratchPopupIfNeeded(String driverId) async {
    if (!mounted) return;
    if (_scratchPopupShownThisSession) return;
    if (_isOnline) return;
    if (!_scratchCanScratch) return;
    final prefs = await SharedPreferences.getInstance();
    final key = '$_kScratchPopupShownPrefix${driverId}_${_todayKey()}';
    if (prefs.getBool(key) == true) return;
    if (!mounted) return;

    final open = await showDialog<bool>(
          context: context,
          builder: (ctx) => AlertDialog(
            title: Text(_t('scratch_card_title'), style: GoogleFonts.poppins(fontWeight: FontWeight.w700)),
            content: Text(_t('scratch_popup_body'), style: GoogleFonts.poppins()),
            actions: [
              TextButton(
                onPressed: () => Navigator.of(ctx).pop(false),
                child: Text(_t('not_now'), style: GoogleFonts.poppins()),
              ),
              FilledButton(
                onPressed: () => Navigator.of(ctx).pop(true),
                style: FilledButton.styleFrom(backgroundColor: AppTheme.neonOrange),
                child: Text(_t('open'), style: GoogleFonts.poppins(fontWeight: FontWeight.w600)),
              ),
            ],
          ),
        ) ??
        false;

    _scratchPopupShownThisSession = true;
    await prefs.setBool(key, true);

    if (open && mounted) {
      await _openScratchCard();
    }
  }

  Future<void> _openScratchCard() async {
    await Navigator.of(context).push(MaterialPageRoute(builder: (_) => const ScratchCardScreen()));
    final id = _driverId;
    if (id != null && id.isNotEmpty) {
      _loadWalletSummary(id);
      _loadScratchStatus(id);
    }
  }

  Widget _buildBlockedOverlay() {
    const supportEmail = 'Support@transportbidder.com';
    final reason = _driverBlockReason;
    return Container(
      color: Colors.black.withValues(alpha: 0.72),
      child: SafeArea(
        child: Center(
          child: Container(
            margin: const EdgeInsets.all(24),
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: AppTheme.surfaceDark,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: Colors.orange.withValues(alpha: 0.4)),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.block, size: 42, color: Colors.redAccent),
                const SizedBox(height: 12),
                Text(_t('driver_status_blocked'), style: GoogleFonts.poppins(color: Colors.white, fontSize: 16), textAlign: TextAlign.center),
                if (reason != null && reason.trim().isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Text(_t('driver_status_blocked_reason', {'reason': reason}), style: GoogleFonts.poppins(color: Colors.white70, fontSize: 13), textAlign: TextAlign.center),
                ],
                const SizedBox(height: 12),
                Text(supportEmail, style: GoogleFonts.poppins(color: AppTheme.neonOrange, fontSize: 13)),
              ],
            ),
          ),
        ),
      ),
    );
  }

  /// Driver marker: vehicle icon (car emoji 🚗) for live location. Async load before setting marker.
  Future<void> _loadDriverCarIcon() async {
    try {
      final car = await _bitmapDescriptorFromEmoji('🚗', 64);
      if (mounted) setState(() => _driverCarIcon = car);
    } catch (_) {
      try {
        final circle = await _bitmapDescriptorFromColoredCircle(AppTheme.neonOrange, size: 64);
        if (mounted) setState(() => _driverCarIcon = circle);
      } catch (_) {
        if (mounted) setState(() => _driverCarIcon = BitmapDescriptor.defaultMarker);
      }
    }
  }

  static Future<BitmapDescriptor> _bitmapDescriptorFromEmoji(String emoji, double size) async {
    try {
      final pictureRecorder = ui.PictureRecorder();
      final canvas = Canvas(pictureRecorder);
      final fontSize = size * 0.55;
      final textPainter = TextPainter(
        text: TextSpan(
          text: emoji.isNotEmpty ? emoji : '🚗',
          style: TextStyle(fontSize: fontSize, color: Colors.black87),
        ),
        textDirection: TextDirection.ltr,
      );
      textPainter.layout();
      textPainter.paint(
        canvas,
        Offset(
          (size - textPainter.width) / 2,
          (size - textPainter.height) / 2,
        ),
      );
      final picture = pictureRecorder.endRecording();
      final image = await picture.toImage(size.toInt(), size.toInt());
      final byteData = await image.toByteData(format: ui.ImageByteFormat.png);
      final bytes = byteData?.buffer.asUint8List();
      if (bytes != null && bytes.isNotEmpty) {
        return BitmapDescriptor.bytes(bytes);
      }
    } catch (_) {}
    return BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueOrange);
  }

  static Future<BitmapDescriptor> _bitmapDescriptorFromColoredCircle(Color fillColor, {double size = 64}) async {
    try {
      final pictureRecorder = ui.PictureRecorder();
      final canvas = Canvas(pictureRecorder);
      final center = Offset(size / 2, size / 2);
      final radius = size / 2 - 4;
      canvas.drawCircle(center, radius + 2, Paint()..color = Colors.white..style = PaintingStyle.stroke..strokeWidth = 3);
      canvas.drawCircle(center, radius, Paint()..color = fillColor);
      final picture = pictureRecorder.endRecording();
      final image = await picture.toImage(size.toInt(), size.toInt());
      final byteData = await image.toByteData(format: ui.ImageByteFormat.png);
      final bytes = byteData?.buffer.asUint8List();
      if (bytes != null && bytes.isNotEmpty) {
        return BitmapDescriptor.bytes(bytes);
      }
    } catch (_) {}
    return BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueOrange);
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _recheckLocation();
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _requestPollTimer?.cancel();
    _requestPollTimer = null;
    _driverLocationTimer?.cancel();
    _driverLocationTimer = null;
    _locationStreamSubscription?.cancel();
    _locationStreamSubscription = null;
    _driverLocationPingTimer?.cancel();
    _driverLocationPingTimer = null;
    _notificationService.dispose();
    _locationService.dispose();
    super.dispose();
  }

  Future<void> _recheckLocation() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final hadPreviousLocation = prefs.getDouble(_kDriverLastLat) != null && prefs.getDouble(_kDriverLastLng) != null;

      final p = await Geolocator.checkPermission();
      if (p == LocationPermission.deniedForever || p == LocationPermission.denied) {
        if (mounted) setState(() { _locationDenied = true; _showLocationOffDialog = hadPreviousLocation; });
        return;
      }
      final pos = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
      );
      if (!mounted) return;
      await prefs.setDouble(_kDriverLastLat, pos.latitude);
      await prefs.setDouble(_kDriverLastLng, pos.longitude);
      setState(() {
        _userPosition = pos;
        _driverMarkerPosition = LatLng(pos.latitude, pos.longitude);
        _locationDenied = false;
        _showLocationOffDialog = false;
        _initialCamera = CameraPosition(
          target: LatLng(pos.latitude, pos.longitude),
          zoom: 15,
        );
      });
      _centerOnUser();
    } catch (_) {
      if (mounted) {
        final prefs = await SharedPreferences.getInstance();
        final hadPreviousLocation = prefs.getDouble(_kDriverLastLat) != null && prefs.getDouble(_kDriverLastLng) != null;
        setState(() { _locationDenied = true; _showLocationOffDialog = hadPreviousLocation; });
      }
    }
  }

  String _t(String key, [Map<String, dynamic>? params]) {
    final scope = AppLocaleScope.of(context);
    return scope?.t(key, params) ?? translate(key, defaultLocale, params);
  }

  Future<void> _showLocationAlwaysOnPopupIfNeeded() async {
    if (_locationDenied) return;
    final prefs = await SharedPreferences.getInstance();
    if (prefs.getBool(_kLocationAlwaysPopupShown) == true) return;
    if (!mounted) return;
    final shouldRequest = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        title: Text(_t('location_always_title'), style: GoogleFonts.poppins(fontWeight: FontWeight.w700)),
        content: Text(
          _t('location_always_body'),
          style: GoogleFonts.poppins(fontSize: 16),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: Text(_t('not_now'), style: GoogleFonts.poppins()),
          ),
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            style: FilledButton.styleFrom(backgroundColor: AppTheme.neonOrange),
            child: Text(_t('allow_always'), style: GoogleFonts.poppins(fontWeight: FontWeight.w600)),
          ),
        ],
      ),
    ) ?? false;
    await prefs.setBool(_kLocationAlwaysPopupShown, true);
    if (!mounted || !shouldRequest) return;
    await _locationService.requestAlwaysLocationPermission(context);
  }

  void _openLocationSettings() {
    openAppSettings();
    setState(() => _showLocationOffDialog = false);
  }

  void _showVerificationBlockDialog(String status, String? blockReason) {
    final t = AppLocaleScope.of(context)?.t ?? (String k, [Map<String, dynamic>? p]) => translate(k, defaultLocale, p);
    String body;
    if (status == 'pending') {
      body = t('driver_status_pending');
    } else {
      body = (blockReason != null && blockReason.isNotEmpty)
          ? t('driver_status_blocked_reason', {'reason': blockReason})
          : t('driver_status_blocked');
    }
    showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(t('driver_cannot_go_online'), style: GoogleFonts.poppins(fontWeight: FontWeight.w600)),
        content: Text(body, style: GoogleFonts.poppins()),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: Text(t('ok'), style: const TextStyle(color: AppTheme.neonOrange)),
          ),
          TextButton(
            onPressed: () {
              Navigator.of(ctx).pop();
              Navigator.of(context).push(MaterialPageRoute(builder: (_) => const VerificationScreen()));
            },
            child: Text(t('verification_open_docs'), style: const TextStyle(color: AppTheme.neonOrange, fontWeight: FontWeight.w600)),
          ),
        ],
      ),
    );
  }

  Future<void> _showServerUnavailableDialog() async {
    if (!mounted) return;
    await showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(_t('server_unavailable_title'), style: GoogleFonts.poppins(fontWeight: FontWeight.w700)),
        content: Text(_t('server_unavailable_body'), style: GoogleFonts.poppins()),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: Text(_t('close'), style: GoogleFonts.poppins()),
          ),
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(),
            style: FilledButton.styleFrom(backgroundColor: AppTheme.neonOrange),
            child: Text(_t('retry'), style: GoogleFonts.poppins(fontWeight: FontWeight.w600)),
          ),
        ],
      ),
    );
  }

  void _startDriverLocationUpdates(String rideId) {
    _driverLocationTimer?.cancel();
    Future<void> sendLocation() async {
      try {
        final pos = await Geolocator.getCurrentPosition(
          desiredAccuracy: LocationAccuracy.medium,
        );
        if (!mounted || _acceptedRideId != rideId) return;
        await _rideBidService.updateDriverLocation(rideId, pos.latitude, pos.longitude);
      } catch (_) {}
    }
    sendLocation();
    _driverLocationTimer = Timer.periodic(const Duration(seconds: 5), (_) => sendLocation());
  }

  void _stopDriverLocationUpdates() {
    _driverLocationTimer?.cancel();
    _driverLocationTimer = null;
    if (mounted) setState(() => _acceptedRideId = null);
  }

  Future<void> _pollRequests() async {
    final list = await _rideBidService.getRequests();
    if (!mounted || !_isOnline) return;
    // Filter out declined rides AND rides we have already bid on (active bids)
    final available = list.where((r) => 
      r.requestId != null && 
      !_declinedRideIds.contains(r.requestId) &&
      !_myBidRideIds.contains(r.requestId)
    ).toList();
    
    if (available.isEmpty) {
      if (_incomingRequest != null) {
        setState(() => _incomingRequest = null);
      }
      return;
    }
    
    final first = available.first;
    final currentId = _incomingRequest?.requestId;
    if (currentId == first.requestId) return;
    
    _notificationService.startSiren();
    setState(() => _incomingRequest = first);
  }

  void _startRequestPolling() {
    _requestPollTimer?.cancel();
    _pollRequests();
    _requestPollTimer = Timer.periodic(const Duration(seconds: 3), (_) => _pollRequests());
  }

  void _stopRequestPolling() {
    _requestPollTimer?.cancel();
    _requestPollTimer = null;
  }

  // --- Bidding Polling (My Bids) ---

  void _startMyBidsPolling() {
    _myBidsTimer?.cancel();
    _pollMyBids();
    _myBidsTimer = Timer.periodic(const Duration(seconds: 4), (_) => _pollMyBids());
  }

  void _stopMyBidsPolling() {
    _myBidsTimer?.cancel();
    _myBidsTimer = null;
  }

  Future<void> _pollMyBids() async {
    if (!mounted || !_isOnline) return;
    final bids = await _rideBidService.getMyBids();
    if (!mounted) return;

    final currentBidIds = <String>{};
    for (final bid in bids) {
      final rideId = bid['rideId'] as String?;
      final isWon = bid['isWon'] == true;
      final isLost = bid['isLost'] == true;
      
      if (rideId != null) {
        if (isWon) {
          // WE WON! Transition to active ride.
          await _handleWonBid(rideId, bid);
          return; // Stop processing other bids, we have a ride.
        }
        if (!isLost) {
          currentBidIds.add(rideId);
        } else if (_myBidRideIds.contains(rideId)) {
          // Notify user if a tracked bid was lost
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(_t('bid_lost_msg', {'price': bid['price']}), style: GoogleFonts.poppins()), 
              backgroundColor: Colors.orange,
              duration: const Duration(seconds: 3),
            ),
          );
        }
      }
    }
    
    setState(() {
      _myBidRideIds.clear();
      _myBidRideIds.addAll(currentBidIds);
    });
  }

  Future<void> _handleWonBid(String rideId, Map<String, dynamic> bidData) async {
    _stopMyBidsPolling();
    _stopRequestPolling();
    _notificationService.stopSiren(); // Just in case
    
    // Construct IncomingRequest from bid data or fetch ride details
    final ride = await _rideBidService.getRide(rideId);
    if (!mounted) return;
    
    if (ride != null) {
      final pickup = ride['pickup'] as Map<String, dynamic>? ?? {};
      final drop = ride['drop'] as Map<String, dynamic>? ?? {};
      final req = IncomingRequest(
        requestId: rideId,
        pickupAddress: (ride['pickupAddress'] as String?) ?? 'Pickup',
        dropAddress: (ride['dropAddress'] as String?) ?? 'Drop',
        distanceKm: (ride['distanceKm'] as num?)?.toDouble() ?? 0.0,
        trafficDelayMins: (ride['trafficDelayMins'] as num?)?.toInt() ?? 0,
        userBidPrice: (bidData['price'] as num?)?.toDouble() ?? 0.0, // Our winning price
        vehicleLabel: (ride['vehicleType'] as String?) ?? 'Auto',
        pickup: LatLng((pickup['lat'] as num?)?.toDouble() ?? 0, (pickup['lng'] as num?)?.toDouble() ?? 0),
        drop: LatLng((drop['lat'] as num?)?.toDouble() ?? 0, (drop['lng'] as num?)?.toDouble() ?? 0),
        userRating: (ride['userRating'] as num?)?.toDouble(),
        userPhotoUrl: ride['userPhotoUrl'] as String?,
        userPhone: ride['userPhone'] as String?,
      );

      setState(() {
        _isOnline = true; // Ensure online
        _incomingRequest = null;
        _acceptedRideId = rideId;
        _acceptedRide = req;
        _acceptedRideStatus = 'to_pickup';
        _myBidRideIds.remove(rideId); // No longer a pending bid
      });
      
      _startDriverLocationUpdates(rideId);
      
      showDialog(
        context: context,
        builder: (ctx) => AlertDialog(
          title: Text(_t('bid_accepted_title'), style: GoogleFonts.poppins(fontWeight: FontWeight.w700)),
          content: Text(_t('bid_accepted_body'), style: GoogleFonts.poppins()),
          actions: [
            FilledButton(
              onPressed: () => Navigator.pop(ctx),
              style: FilledButton.styleFrom(backgroundColor: Colors.green),
              child: Text(_t('lets_go'), style: GoogleFonts.poppins(fontWeight: FontWeight.w600)),
            ),
          ],
        ),
      );
    }
  }

  void _startDriverLocationPing() {
    _driverLocationPingTimer?.cancel();
    void ping() async {
      if (_userPosition == null && _driverMarkerPosition == null) return;
      final lat = _driverMarkerPosition?.latitude ?? _userPosition!.latitude;
      final lng = _driverMarkerPosition?.longitude ?? _userPosition!.longitude;
      try {
        final id = await _rideBidService.reportDriverLocation(
          _driverId,
          lat,
          lng,
          vehicleType: _driverVehicleType,
          phone: _driverPhone,
        );
        if (!mounted) return;
        // Only adopt server-provided ID when none is stored locally.
        if (id != null && id.isNotEmpty && (_driverId == null || _driverId!.isEmpty)) {
          setState(() => _driverId = id);
          final prefs = await SharedPreferences.getInstance();
          await prefs.setString(_kDriverIdKey, id);
        }
      } on DriverBlockedException catch (e) {
        if (!mounted) return;
        _stopDriverLocationPing();
        _requestPollTimer?.cancel();
        _requestPollTimer = null;
        _locationStreamSubscription?.cancel();
        _locationStreamSubscription = null;
        _locationService.stopLocationStream();
        _stopRequestPolling();
        setState(() {
          _isOnline = false;
          _incomingRequest = null;
        });
        _rideBidService.reportDriverOffline(_driverId);
        _showVerificationBlockDialog('blocked', e.message);
      }
    }
    ping();
    _driverLocationPingTimer = Timer.periodic(const Duration(seconds: 10), (_) => ping());
  }

  void _stopDriverLocationPing() {
    _driverLocationPingTimer?.cancel();
    _driverLocationPingTimer = null;
    _rideBidService.reportDriverOffline(_driverId);
  }

  /// App start par: previous vs current location test. Agar location change hai (pehle tha ab nahi mila) to hi "Turn on location" button/dialog dikhao.
  Future<void> _initLocation() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final hadPreviousLocation = prefs.getDouble(_kDriverLastLat) != null && prefs.getDouble(_kDriverLastLng) != null;

      LocationPermission p = await Geolocator.checkPermission();
      if (p == LocationPermission.denied) {
        p = await Geolocator.requestPermission();
      }
      if (p == LocationPermission.deniedForever || p == LocationPermission.denied) {
        if (mounted) {
          setState(() {
            _locationDenied = true;
            _showLocationOffDialog = hadPreviousLocation;
          });
        }
        return;
      }
      final pos = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
      );
      if (!mounted) return;
      await prefs.setDouble(_kDriverLastLat, pos.latitude);
      await prefs.setDouble(_kDriverLastLng, pos.longitude);
      setState(() {
        _userPosition = pos;
        _driverMarkerPosition = LatLng(pos.latitude, pos.longitude);
        _locationDenied = false;
        _showLocationOffDialog = false;
        _initialCamera = CameraPosition(
          target: LatLng(pos.latitude, pos.longitude),
          zoom: 15,
        );
      });
      _centerOnUser();
      _showLocationAlwaysOnPopupIfNeeded();
    } catch (_) {
      if (mounted) {
        final prefs = await SharedPreferences.getInstance();
        final hadPreviousLocation = prefs.getDouble(_kDriverLastLat) != null && prefs.getDouble(_kDriverLastLng) != null;
        setState(() {
          _locationDenied = true;
          _showLocationOffDialog = hadPreviousLocation;
        });
      }
    }
  }

  Future<void> _centerOnUser() async {
    if (_userPosition == null && _driverMarkerPosition == null) return;
    final lat = _driverMarkerPosition?.latitude ?? _userPosition!.latitude;
    final lng = _driverMarkerPosition?.longitude ?? _userPosition!.longitude;
    final c = await _mapCompleter.future;
    await c.animateCamera(CameraUpdate.newLatLng(LatLng(lat, lng)));
  }

  /// Current location button – get position and center map (same as user app).
  // Removed unused _goToMyLocation (handled by _centerOnUser and location updates)

  Future<void> _acceptRequest() async {
    final request = _incomingRequest;
    final requestId = request?.requestId;
    _notificationService.stopSiren();
    if (requestId == null || request == null) {
      setState(() => _incomingRequest = null);
      return;
    }
    final driverId = _driverId;
    // Check local wallet balance before bidding
    if (driverId != null && driverId.isNotEmpty) {
      try {
        final balance = await _walletApi.getBalance(driverId);
        if (!mounted) return;
        final rideCredits = request.userBidPrice.ceil();
        if (balance <= 0) {
          _showCreditWarningDialog(message: _t('wallet_out_of_credit'), code: 'NO_CREDIT');
          return;
        }
        if (balance < rideCredits) {
          _showCreditWarningDialog(message: _t('wallet_low_credit_accept'), code: 'LOW_CREDIT');
          return;
        }
      } catch (_) {
        // If wallet check fails, let the backend handle it
      }
    }

    // Place a bid at the user's price (bidding flow — user will see it and can accept)
    final driverName = await ProfileStorageService.getName() ?? 'Driver';
    final carModel = await ProfileStorageService.getVehicle() ?? _driverVehicleType;
    final (bool ok, _) = await _rideBidService.placeBid(
      requestId,
      price: request.userBidPrice,
      driverId: driverId,
      driverName: driverName,
      driverPhone: _driverPhone,
      carModel: carModel,
    );
    if (!mounted) return;
    
    if (ok) {
      setState(() {
        _incomingRequest = null;
        _myBidRideIds.add(requestId); // Mark as "bid placed"
      });
      
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(_t('bid_sent_waiting'), style: GoogleFonts.poppins()), 
          backgroundColor: Colors.blueAccent
        ),
      );
      
      // Start polling my bids to check if user accepts
      _startMyBidsPolling();
      
    } else {
      setState(() => _incomingRequest = null);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(_t('could_not_send'), style: GoogleFonts.poppins()), backgroundColor: Colors.orange),
      );
    }
  }

  void _showCreditWarningDialog({ required String message, String? code }) {
    String title;
    switch (code) {
      case 'NO_CREDIT':
        title = _t('ride_error_no_credit_title');
        break;
      case 'EXPIRED':
        title = _t('ride_error_expired_title');
        break;
      case 'LOW_CREDIT':
        title = _t('ride_error_low_credit_title');
        break;
      default:
        title = _t('ride_error_low_credit_title');
    }
    showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(title, style: GoogleFonts.poppins(fontWeight: FontWeight.w700)),
        content: Text(message, style: GoogleFonts.poppins(fontSize: 15)),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: Text(_t('ok'), style: const TextStyle(color: AppTheme.neonOrange)),
          ),
          FilledButton(
            onPressed: () {
              Navigator.of(ctx).pop();
              Navigator.of(context).push(MaterialPageRoute(builder: (_) => const WalletScreen()));
            },
            style: FilledButton.styleFrom(backgroundColor: AppTheme.neonOrange),
            child: Text(_t('ride_error_recharge_cta'), style: GoogleFonts.poppins(fontWeight: FontWeight.w600)),
          ),
        ],
      ),
    );
  }

  Future<void> _onDriverArrived() async {
    if (_acceptedRideId == null) return;
    final ok = await _rideBidService.driverArrived(_acceptedRideId!);
    if (!mounted) return;
    if (ok) {
      setState(() => _acceptedRideStatus = 'arrived');
      _showOtpDialog();
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(_t('could_not_send'), style: GoogleFonts.poppins()), backgroundColor: Colors.orange),
      );
    }
  }

  Future<void> _showOtpDialog() async {
    final controller = TextEditingController();
    final rideId = _acceptedRideId;
    if (rideId == null) return;
    final submitted = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        title: Text(_t('user_otp'), style: GoogleFonts.poppins(fontWeight: FontWeight.w700)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(_t('ask_user_otp'), style: GoogleFonts.poppins(fontSize: 14)),
            const SizedBox(height: 16),
            TextField(
              controller: controller,
              keyboardType: TextInputType.number,
              maxLength: 4,
              decoration: InputDecoration(
                labelText: _t('otp_4_digits'),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.of(ctx).pop(false), child: Text(_t('cancel'), style: GoogleFonts.poppins())),
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            style: FilledButton.styleFrom(backgroundColor: AppTheme.neonOrange),
            child: Text(_t('start_ride'), style: GoogleFonts.poppins(fontWeight: FontWeight.w600)),
          ),
        ],
      ),
    );
    if (!mounted || submitted != true) return;
    final otp = controller.text.trim();
    final ok = await _rideBidService.startRide(rideId, otp);
    if (!mounted) return;
    if (ok) {
      setState(() => _acceptedRideStatus = 'to_drop');
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(_t('ride_started_go_dest'), style: GoogleFonts.poppins()), backgroundColor: Colors.green),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(_t('wrong_otp'), style: GoogleFonts.poppins()), backgroundColor: Colors.orange),
      );
      _showOtpDialog();
    }
  }

  Future<void> _onCompleteRide() async {
    if (_acceptedRideId == null) return;
    final rideId = _acceptedRideId!;
    final ok = await _rideBidService.completeRide(rideId);
    if (!mounted) return;
    if (ok) {
      double amount = _acceptedRide?.userBidPrice ?? 0.0;
      final ride = await _rideBidService.getRide(rideId);
      if (ride != null) {
        final bidId = ride['acceptedBidId'] as String?;
        final bids = ride['bids'] as List<dynamic>? ?? [];
        for (final b in bids) {
          final bid = b as Map<String, dynamic>? ?? {};
          if (bid['id'] == bidId) {
            amount = (bid['price'] as num?)?.toDouble() ?? amount;
            break;
          }
        }
      }
      await _earningsService.add(EarningsRecord(rideId: rideId, amount: amount, completedAt: DateTime.now()));
      _stopDriverLocationUpdates();
      setState(() {
        _acceptedRideId = null;
        _acceptedRide = null;
        _acceptedRideStatus = null;
      });
      // Restart request polling so driver receives new rides while still online
      if (_isOnline) {
        _startRequestPolling();
      }
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(_t('ride_completed_thanks'), style: GoogleFonts.poppins()), backgroundColor: Colors.green),
        );
      }
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(_t('could_not_complete'), style: GoogleFonts.poppins()), backgroundColor: Colors.orange),
      );
    }
  }

  Future<void> _declineRequest() async {
    final requestId = _incomingRequest?.requestId;
    _notificationService.stopSiren();
    if (requestId != null) {
      _declinedRideIds.add(requestId);
    }
    setState(() => _incomingRequest = null);
    if (requestId != null) {
      await _rideBidService.declineBid(requestId);
    }
  }

  void _showCounterBidSheet() {
    final request = _incomingRequest!;
    final requestId = request.requestId;
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: AppTheme.surfaceDark,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => _CounterBidSheet(
        userBidPrice: request.userBidPrice,
        onSend: (counterPrice) async {
          Navigator.pop(ctx);
          _notificationService.stopSiren();
          setState(() => _incomingRequest = null);
          if (requestId != null) {
            // Bug fix: pass driverPhone so backend bid entry has driver contact info.
            final ok = await _rideBidService.counterBid(requestId, counterPrice, driverPhone: _driverPhone);
            if (!mounted) return;
            if (ok) {
              _myBidRideIds.add(requestId);
              _startMyBidsPolling();
            }
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text(ok ? _t('counter_offer_sent', {'price': counterPrice.toStringAsFixed(2)}) : _t('could_not_send'), style: GoogleFonts.poppins()),
                backgroundColor: ok ? AppTheme.neonOrange : Colors.orange,
              ),
            );
          } else {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text(_t('counter_offer_sent', {'price': counterPrice.toStringAsFixed(2)}), style: GoogleFonts.poppins()), backgroundColor: AppTheme.neonOrange),
            );
          }
        },
      ),
    );
  }

  static final GlobalKey<ScaffoldState> _scaffoldKey = GlobalKey<ScaffoldState>();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      key: _scaffoldKey,
      backgroundColor: AppTheme.darkBg,
      endDrawer: _DriverMenuDrawer(
        driverId: _driverId,
        earningsService: _earningsService,
      ),
      // Track drawer state to control map gestures (fix map zoom while drawer scrolls).
      onEndDrawerChanged: (isOpen) {
        setState(() => _isEndDrawerOpen = isOpen);
        // Reload driverId from prefs when drawer opens so ID shows without restart (e.g. after going online).
        if (isOpen) {
          _loadDriverId();
        }
      },
      body: Stack(
        fit: StackFit.expand,
        children: [
          GoogleMap(
            initialCameraPosition: _initialCamera,
            onMapCreated: (c) {
              if (!_mapCompleter.isCompleted) {
                _mapCompleter.complete(c);
              }
              if (_userPosition != null) {
                _centerOnUser();
              }
            },
            myLocationEnabled: false,
            myLocationButtonEnabled: false,
            zoomControlsEnabled: false,
            compassEnabled: false,
            mapToolbarEnabled: false,
            // Disable map gestures when end drawer is open to avoid accidental zoom/pan.
            zoomGesturesEnabled: !_isEndDrawerOpen,
            scrollGesturesEnabled: !_isEndDrawerOpen,
            rotateGesturesEnabled: !_isEndDrawerOpen,
            tiltGesturesEnabled: !_isEndDrawerOpen,
            mapType: MapType.normal,
            markers: (_driverMarkerPosition != null || _userPosition != null)
                ? {
                    Marker(
                      markerId: const MarkerId('driver_vehicle'),
                      position: _driverMarkerPosition ?? LatLng(_userPosition!.latitude, _userPosition!.longitude),
                      icon: _driverCarIcon ?? BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueOrange),
                      infoWindow: InfoWindow(title: _t('driver_on_duty')),
                    ),
                  }
                : {},
          ),
          Positioned(
            top: MediaQuery.of(context).padding.top + 8,
            right: 12,
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                IconButton(
                  icon: const Icon(Icons.menu, size: 28, color: AppTheme.onDark),
                  onPressed: () => _scaffoldKey.currentState?.openEndDrawer(),
                  tooltip: 'Menu',
                ),
              ],
            ),
          ),
          Positioned(
            top: MediaQuery.of(context).padding.top + 52,
            left: 24,
            right: 24,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                _GoOnlinePanel(
                  isOnline: _isOnline,
                  onToggle: () async {
                if (_locationDenied) return;
                if (!_isOnline) {
                  // Ensure stored driverId is loaded before starting /location ping.
                  await _ensureDriverIdLoaded();
                  await _resolveDriverIdFromServer();
                  // Only check verification if driver already has an ID
                  if (_driverId != null && _driverId!.isNotEmpty) {
                    Map<String, dynamic>? statusData;
                    try {
                      statusData = await _rideBidService.getVerificationStatus(_driverId);
                    } catch (_) {
                      statusData = null;
                    }
                    if (!mounted) return;
                    // Bug fix: if backend is down/restarting, do NOT treat it as "pending" verification.
                    if (statusData == null) {
                      await _showServerUnavailableDialog();
                      return;
                    }
                    final status = (statusData['status'] as String?) ?? 'pending';
                    final blockReason = statusData['blockReason'] as String?;
                    setState(() {
                      _driverVerificationStatus = status;
                      _driverBlockReason = blockReason;
                      _showBlockedOverlay = _isBlockedStatus(status);
                    });
                    await _maybeShowStatusNotice(_driverId!, status, blockReason);
                    if (status != 'approved') {
                      _showVerificationBlockDialog(status, blockReason);
                      return;
                    }
                  }
                  final granted = await _locationService.requestAlwaysLocationPermission(context);
                  if (!mounted) return;
                  if (!granted) {
                    return;
                  }
                  setState(() => _isOnline = true);
                  _locationService.startLocationStream();
                  _locationStreamSubscription?.cancel();
                  _locationStreamSubscription = _locationService.locationStream.listen((p) {
                    if (mounted) setState(() => _driverMarkerPosition = p);
                  });
                  _startDriverLocationPing();
                  _startRequestPolling();
                } else {
                  setState(() => _isOnline = false);
                  _stopDriverLocationPing();
                  _locationStreamSubscription?.cancel();
                  _locationStreamSubscription = null;
                  _locationService.stopLocationStream();
                  _stopRequestPolling();
                  _stopDriverLocationUpdates();
                  setState(() => _incomingRequest = null);
                }
              },
                  locationDenied: _locationDenied,
                ),
                if (_walletSummaryBalance != null && _walletSummaryExpiry != null) ...[
                  const SizedBox(height: 10),
                  Align(
                    alignment: Alignment.centerLeft,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                      decoration: BoxDecoration(
                        color: AppTheme.surfaceDark.withValues(alpha: 0.95),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: AppTheme.neonOrange.withValues(alpha: 0.7)),
                      ),
                      child: Text(
                        'Credits: $_walletSummaryBalance | Exp: $_walletSummaryExpiry',
                        style: GoogleFonts.poppins(fontSize: 12, fontWeight: FontWeight.w600, color: AppTheme.onDark),
                      ),
                    ),
                  ),
                ],
                if (!_isOnline) ...[
                  const SizedBox(height: 12),
                  if (_scratchCanScratch) ...[
                    Material(
                      color: Colors.transparent,
                      child: InkWell(
                        onTap: _openScratchCard,
                        borderRadius: BorderRadius.circular(14),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                          decoration: BoxDecoration(
                            color: AppTheme.surfaceDark.withValues(alpha: 0.95),
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(color: AppTheme.neonOrange.withValues(alpha: 0.7)),
                          ),
                          child: Row(
                            children: [
                              Container(
                                width: 36,
                                height: 36,
                                decoration: BoxDecoration(
                                  shape: BoxShape.circle,
                                  color: AppTheme.neonOrange.withValues(alpha: 0.18),
                                ),
                                child: const Icon(Icons.card_giftcard, color: AppTheme.neonOrange, size: 18),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      _t('scratch_card_title'),
                                      style: GoogleFonts.poppins(fontSize: 13, fontWeight: FontWeight.w700, color: AppTheme.onDark),
                                    ),
                                    const SizedBox(height: 2),
                                    Text(
                                      _t('scratch_banner_subtitle'),
                                      style: GoogleFonts.poppins(fontSize: 11, color: Colors.grey.shade400),
                                    ),
                                  ],
                                ),
                              ),
                              const Icon(Icons.chevron_right, color: Colors.white54),
                            ],
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 10),
                  ],
                  if (_driverVerificationStatus != null && _driverVerificationStatus != 'approved')
                    _OfflineShortcuts(
                      onOpenVerification: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const VerificationScreen())),
                      onOpenWallet: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const WalletScreen())),
                      canRecharge: false,
                      showDocuments: true,
                    ),
                ],
              ],
            ),
          ),
          if (!_isOnline)
            IgnorePointer(
              child: Container(
                color: Colors.black38,
              ),
            ),
          if (_locationDenied)
            Positioned(
              top: MediaQuery.of(context).padding.top + 24,
              left: 16,
              right: 16,
              child: Material(
                elevation: 4,
                borderRadius: BorderRadius.circular(8),
                color: AppTheme.surfaceDark,
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  child: Row(
                    children: [
                      Icon(Icons.location_off, color: Colors.orange.shade300, size: 20),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          _t('location_denied_bar'),
                          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                color: AppTheme.onDark,
                              ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          if (_locationDenied && _showLocationOffDialog)
            Positioned.fill(
              child: Material(
                color: Colors.black54,
                child: SafeArea(
                  child: Center(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 24),
                      child: Material(
                        borderRadius: BorderRadius.circular(16),
                        color: AppTheme.surfaceDark,
                        child: Padding(
                          padding: const EdgeInsets.all(24),
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(Icons.location_off, size: 56, color: Colors.orange.shade300),
                              const SizedBox(height: 16),
                              Text(
                                _t('activate_location'),
                                style: GoogleFonts.poppins(fontSize: 20, fontWeight: FontWeight.w700, color: AppTheme.onDark),
                              ),
                              const SizedBox(height: 8),
                              Text(
                                _t('activate_location_body'),
                                textAlign: TextAlign.center,
                                style: GoogleFonts.poppins(fontSize: 15, color: AppTheme.onDark),
                              ),
                              const SizedBox(height: 24),
                              SizedBox(
                                width: double.infinity,
                                child: FilledButton(
                                  onPressed: _openLocationSettings,
                                  style: FilledButton.styleFrom(
                                    backgroundColor: AppTheme.neonOrange,
                                    padding: const EdgeInsets.symmetric(vertical: 14),
                                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                                  ),
                                  child: Text(_t('open_settings'), style: GoogleFonts.poppins(fontWeight: FontWeight.w600)),
                                ),
                              ),
                              const SizedBox(height: 8),
                              TextButton(
                                onPressed: () => setState(() => _showLocationOffDialog = false),
                                child: Text(_t('close'), style: GoogleFonts.poppins(color: Colors.grey.shade400)),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          if (_incomingRequest != null) _IncomingRequestOverlay(
            request: _incomingRequest!,
            onAccept: _acceptRequest,
            onCounterBid: _showCounterBidSheet,
            onDecline: _declineRequest,
          ),
          if (_acceptedRide != null && _acceptedRideId != null)
            _AcceptedRideOverlay(
              request: _acceptedRide!,
              status: _acceptedRideStatus ?? 'to_pickup',
              driverPosition: _userPosition != null ? LatLng(_userPosition!.latitude, _userPosition!.longitude) : null,
              rideBidService: _rideBidService,
              onArrived: _onDriverArrived,
              onComplete: _onCompleteRide,
            ),
          if (_showBlockedOverlay)
            Positioned.fill(
              child: _buildBlockedOverlay(),
            ),
        ],
      ),
    );
  }
}

class _AcceptedRideOverlay extends StatefulWidget {
  const _AcceptedRideOverlay({
    required this.request,
    required this.status,
    this.driverPosition,
    required this.rideBidService,
    required this.onArrived,
    required this.onComplete,
  });

  final IncomingRequest request;
  final String status;
  final LatLng? driverPosition;
  final RideBidService rideBidService;
  final VoidCallback onArrived;
  final VoidCallback onComplete;

  @override
  State<_AcceptedRideOverlay> createState() => _AcceptedRideOverlayState();
}

class _AcceptedRideOverlayState extends State<_AcceptedRideOverlay> {
  List<LatLng>? _routePoints;

  String _t(String key, [Map<String, dynamic>? params]) =>
      AppLocaleScope.of(context)?.t(key, params) ?? translate(key, defaultLocale, params);

  @override
  void initState() {
    super.initState();
    _fetchRoute();
  }

  @override
  void didUpdateWidget(covariant _AcceptedRideOverlay oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.status != widget.status || oldWidget.driverPosition != widget.driverPosition) {
      _routePoints = null;
      _fetchRoute();
    }
  }

  Future<void> _fetchRoute() async {
    final status = widget.status;
    final driverPos = widget.driverPosition;
    final dest = status == 'to_drop' ? widget.request.drop : widget.request.pickup;
    final origin = driverPos ?? dest;
    if (origin.latitude == dest.latitude && origin.longitude == dest.longitude) return;
    final points = await widget.rideBidService.getDirections(origin, dest);
    if (!mounted) return;
    setState(() {
      _routePoints = points;
    });
  }

  void _openChatSheet(BuildContext context) {
    final rideId = widget.request.requestId;
    if (rideId == null) return;
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppTheme.surfaceDark,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => _DriverChatSheet(
        rideId: rideId,
        rideBidService: widget.rideBidService,
      ),
    );
  }

  Future<void> _onCallUser(BuildContext context) async {
    final rideId = widget.request.requestId;
    if (rideId == null) return;
    final ride = await widget.rideBidService.getRide(rideId);
    final userPhone = ride?['userPhone'] as String?;
    final t = AppLocaleScope.of(context)?.t ?? (String k, [Map<String, dynamic>? p]) => translate(k, defaultLocale, p);
    if (userPhone == null || userPhone.trim().isEmpty) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(t('phone_not_available')), backgroundColor: Colors.orange),
        );
      }
      return;
    }
    final phone = userPhone.trim();
    await Clipboard.setData(ClipboardData(text: phone));
    final uri = Uri.parse('tel:$phone');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
    } else if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(t('phone_not_available')), backgroundColor: Colors.orange),
      );
    }
  }

  void _fitBounds(GoogleMapController c) {
    final driver = widget.driverPosition;
    final pickup = widget.request.pickup;
    final drop = widget.request.drop;
    final points = <LatLng>[pickup, drop];
    if (driver != null) points.add(driver);
    if (points.length < 2) return;
    double minLat = points.first.latitude, maxLat = points.first.latitude;
    double minLng = points.first.longitude, maxLng = points.first.longitude;
    for (final p in points) {
      if (p.latitude < minLat) minLat = p.latitude;
      if (p.latitude > maxLat) maxLat = p.latitude;
      if (p.longitude < minLng) minLng = p.longitude;
      if (p.longitude > maxLng) maxLng = p.longitude;
    }
    c.animateCamera(CameraUpdate.newLatLngBounds(
      LatLngBounds(southwest: LatLng(minLat, minLng), northeast: LatLng(maxLat, maxLng)),
      60,
    ));
  }

  @override
  Widget build(BuildContext context) {
    final request = widget.request;
    final status = widget.status;
    final target = status == 'to_drop' ? request.drop : request.pickup;
    // Dono markers: pickup aur drop — driver ko pata rahe kahan uthana hai, kahan chhodna hai
    final markers = <Marker>{
      Marker(
        markerId: const MarkerId('pickup'),
        position: request.pickup,
        icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueGreen),
        infoWindow: InfoWindow(title: _t('pickup'), snippet: request.pickupAddress),
      ),
      Marker(
        markerId: const MarkerId('drop'),
        position: request.drop,
        icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueRed),
        infoWindow: InfoWindow(title: _t('destino'), snippet: request.dropAddress),
      ),
    };
    final polylines = <Polyline>{};
    if (_routePoints != null && _routePoints!.length > 1) {
      polylines.add(Polyline(
        polylineId: const PolylineId('route'),
        points: _routePoints!,
        color: AppTheme.neonOrange,
        width: 5,
        geodesic: true,
      ));
    }
    return Material(
      color: Colors.black87,
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
          child: Column(
            children: [
              Text(
                status == 'to_pickup' ? _t('go_to_pickup') : (status == 'to_drop' ? _t('go_to_drop') : _t('ask_otp')),
                style: GoogleFonts.poppins(fontSize: 18, fontWeight: FontWeight.w700, color: AppTheme.neonOrange),
              ),
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Icon(Icons.trip_origin, size: 16, color: Colors.green.shade300),
                        const SizedBox(width: 6),
                        Expanded(
                          child: Text('${_t('pickup')}: ${request.pickupAddress}', style: GoogleFonts.poppins(fontSize: 12, color: AppTheme.onDark), maxLines: 2, overflow: TextOverflow.ellipsis),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Icon(Icons.flag, size: 16, color: Colors.red.shade300),
                        const SizedBox(width: 6),
                        Expanded(
                          child: Text('${_t('destino')}: ${request.dropAddress}', style: GoogleFonts.poppins(fontSize: 12, color: AppTheme.onDark), maxLines: 2, overflow: TextOverflow.ellipsis),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
              Expanded(
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(12),
                  child: GoogleMap(
                    initialCameraPosition: CameraPosition(target: target, zoom: 14),
                    onMapCreated: _fitBounds,
                    markers: markers,
                    polylines: polylines,
                    myLocationEnabled: false,
                    myLocationButtonEnabled: false,
                    zoomControlsEnabled: false,
                    compassEnabled: false,
                    mapToolbarEnabled: false,
                  ),
                ),
              ),
              const SizedBox(height: 12),
              Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  TextButton.icon(
                    onPressed: () => _openChatSheet(context),
                    icon: const Icon(Icons.chat_bubble_outline, size: 22, color: AppTheme.onDark),
                    label: Text(_t('chat'), style: GoogleFonts.poppins(fontWeight: FontWeight.w600, color: AppTheme.onDark)),
                  ),
                  const SizedBox(width: 8),
                  FilledButton.icon(
                    onPressed: () => _onCallUser(context),
                    style: FilledButton.styleFrom(backgroundColor: Colors.green),
                    icon: const Icon(Icons.phone, size: 22),
                    label: Text(_t('call'), style: GoogleFonts.poppins(fontWeight: FontWeight.w600)),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              if (status == 'to_pickup')
                SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    onPressed: widget.onArrived,
                    style: FilledButton.styleFrom(
                      backgroundColor: AppTheme.neonOrange,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    child: Text(_t('arrived'), style: GoogleFonts.poppins(fontSize: 16, fontWeight: FontWeight.w600)),
                  ),
                ),
              if (status == 'to_drop')
                _SlideToCompleteButton(onComplete: widget.onComplete),
            ],
          ),
        ),
      ),
    );
  }
}

/// Chat sheet for driver: messages list + send (from: driver).
class _DriverChatSheet extends StatefulWidget {
  const _DriverChatSheet({
    required this.rideId,
    required this.rideBidService,
  });

  final String rideId;
  final RideBidService rideBidService;

  @override
  State<_DriverChatSheet> createState() {
    return _DriverChatSheetState();
  }
}

class _DriverChatSheetState extends State<_DriverChatSheet> {
  List<Map<String, dynamic>> _messages = [];
  final TextEditingController _textController = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadMessages();
  }

  @override
  void dispose() {
    _textController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _loadMessages() async {
    final ride = await widget.rideBidService.getRide(widget.rideId);
    if (!mounted) return;
    final msgs = ride?['messages'] as List<dynamic>?;
    setState(() {
      _messages = msgs != null ? msgs.map((e) => Map<String, dynamic>.from(e as Map)).toList() : [];
      _loading = false;
    });
    _scrollToBottom();
  }

  Future<void> _send() async {
    final text = _textController.text.trim();
    if (text.isEmpty) return;
    _textController.clear();
    final ok = await widget.rideBidService.sendChatMessage(widget.rideId, text);
    if (!mounted) return;
    if (ok) {
      await _loadMessages();
    } else {
      final t = AppLocaleScope.of(context)?.t ?? (String k, [Map<String, dynamic>? p]) => translate(k, defaultLocale, p);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(t('could_not_send')), backgroundColor: Colors.orange),
      );
    }
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(_scrollController.position.maxScrollExtent, duration: const Duration(milliseconds: 200), curve: Curves.easeOut);
      }
    });
  }

  static String _formatAt(String? at) {
    if (at == null || at.isEmpty) return '';
    try {
      final d = DateTime.parse(at);
      return '${d.day}/${d.month} ${d.hour.toString().padLeft(2, '0')}:${d.minute.toString().padLeft(2, '0')}';
    } catch (_) {
      return at;
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = AppLocaleScope.of(context)?.t ?? (String k, [Map<String, dynamic>? p]) => translate(k, defaultLocale, p);
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            child: Row(
              children: [
                Text(t('chat'), style: GoogleFonts.poppins(fontSize: 18, fontWeight: FontWeight.w700, color: AppTheme.onDark)),
                const Spacer(),
                IconButton(onPressed: () => Navigator.pop(context), icon: const Icon(Icons.close, color: AppTheme.onDark)),
              ],
            ),
          ),
          ConstrainedBox(
            constraints: BoxConstraints(maxHeight: MediaQuery.of(context).size.height * 0.45),
            child: _loading
                ? const Center(child: CircularProgressIndicator(color: AppTheme.neonOrange))
                : ListView.builder(
                    controller: _scrollController,
                    shrinkWrap: true,
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    itemCount: _messages.length,
                    itemBuilder: (context, i) {
                      final m = _messages[i];
                      final from = m['from'] as String? ?? '';
                      final text = m['text'] as String? ?? '';
                      final at = m['at'] as String?;
                      final isDriver = from == 'driver';
                      return Align(
                        alignment: isDriver ? Alignment.centerRight : Alignment.centerLeft,
                        child: Container(
                          margin: const EdgeInsets.only(bottom: 8),
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                          decoration: BoxDecoration(
                            color: isDriver ? AppTheme.neonOrange.withValues(alpha: 0.3) : Colors.grey.shade700,
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(text, style: GoogleFonts.poppins(fontSize: 14, color: AppTheme.onDark)),
                              Text(_formatAt(at), style: GoogleFonts.poppins(fontSize: 10, color: Colors.grey.shade400)),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
          ),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _textController,
                    style: GoogleFonts.poppins(color: AppTheme.onDark),
                    decoration: InputDecoration(
                      hintText: 'Message',
                      hintStyle: GoogleFonts.poppins(color: Colors.grey.shade500),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(24)),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                    ),
                    onSubmitted: (_) => _send(),
                  ),
                ),
                const SizedBox(width: 8),
                IconButton.filled(
                  onPressed: _send,
                  icon: const Icon(Icons.send),
                  style: IconButton.styleFrom(backgroundColor: AppTheme.neonOrange),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _SlideToCompleteButton extends StatefulWidget {
  const _SlideToCompleteButton({required this.onComplete});

  final VoidCallback onComplete;

  @override
  State<_SlideToCompleteButton> createState() => _SlideToCompleteButtonState();
}

class _SlideToCompleteButtonState extends State<_SlideToCompleteButton> {
  bool _completed = false;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onHorizontalDragEnd: (d) {
        if (d.primaryVelocity != null && d.primaryVelocity! > 100 && !_completed) {
          setState(() => _completed = true);
          widget.onComplete();
        }
      },
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 14),
        decoration: BoxDecoration(
          color: AppTheme.surfaceDark,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppTheme.neonOrange),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.swipe, color: AppTheme.neonOrange, size: 24),
            const SizedBox(width: 8),
            Text(
              _completed ? (AppLocaleScope.of(context)?.t('ride_completed') ?? 'Viaje completado') : (AppLocaleScope.of(context)?.t('slide_to_complete') ?? 'Desliza para completar viaje →'),
              style: GoogleFonts.poppins(fontSize: 16, fontWeight: FontWeight.w600, color: AppTheme.neonOrange),
            ),
          ],
        ),
      ),
    );
  }
}

class _IncomingRequestOverlay extends StatelessWidget {
  const _IncomingRequestOverlay({
    required this.request,
    required this.onAccept,
    required this.onCounterBid,
    required this.onDecline,
  });

  final IncomingRequest request;
  final VoidCallback onAccept;
  final VoidCallback onCounterBid;
  final VoidCallback onDecline;

  @override
  Widget build(BuildContext context) {
    final scope = AppLocaleScope.of(context);
    final t = scope?.t ?? (String k, [Map<String, dynamic>? p]) => translate(k, defaultLocale, p);
    return Material(
      color: Colors.black87,
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
            child: Column(
            children: [
              Text(t('new_request'), style: GoogleFonts.poppins(fontSize: 18, fontWeight: FontWeight.w700, color: AppTheme.neonOrange)),
              const SizedBox(height: 16),
              Expanded(
                child: SingleChildScrollView(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      _row(Icons.location_on, t('origin'), request.pickupAddress),
                      const SizedBox(height: 8),
                      _row(Icons.flag, t('destination'), request.dropAddress),
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          Icon(Icons.traffic, size: 18, color: Colors.orange.shade300),
                          const SizedBox(width: 8),
                          Text(t('traffic_delay', {'mins': request.trafficDelayMins}), style: GoogleFonts.poppins(color: AppTheme.onDark, fontWeight: FontWeight.w500)),
                          const SizedBox(width: 16),
                          const Icon(Icons.straighten, size: 18, color: AppTheme.onDark),
                          const SizedBox(width: 8),
                          Text(t('km', {'km': request.distanceKm.toStringAsFixed(1)}), style: GoogleFonts.poppins(color: AppTheme.onDark, fontWeight: FontWeight.w500)),
                        ],
                      ),
                      // Outstation details
                      if (request.outstationPassengers != null) ...[
                        const SizedBox(height: 10),
                        Container(
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(color: AppTheme.surfaceDark, borderRadius: BorderRadius.circular(10)),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text('🛣️ Outstation Ride', style: GoogleFonts.poppins(fontSize: 13, fontWeight: FontWeight.w700, color: AppTheme.neonOrange)),
                              const SizedBox(height: 4),
                              Text('Passengers: ${request.outstationPassengers}', style: GoogleFonts.poppins(fontSize: 12, color: AppTheme.onDark)),
                              if (request.outstationIsParcel == true)
                                Text('📦 Parcel booking', style: GoogleFonts.poppins(fontSize: 12, color: Colors.amber)),
                              if (request.outstationComments != null && request.outstationComments!.isNotEmpty)
                                Text('Note: ${request.outstationComments}', style: GoogleFonts.poppins(fontSize: 12, color: Colors.grey.shade400)),
                            ],
                          ),
                        ),
                      ],
                      // Delivery details
                      if (request.deliveryComments != null || request.deliveryWeight != null || request.deliveryPhotoUrl != null) ...[
                        const SizedBox(height: 10),
                        Container(
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(color: AppTheme.surfaceDark, borderRadius: BorderRadius.circular(10)),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text('📦 Delivery Details', style: GoogleFonts.poppins(fontSize: 13, fontWeight: FontWeight.w700, color: AppTheme.neonOrange)),
                              if (request.deliveryWeight != null && request.deliveryWeight!.isNotEmpty)
                                Text('Weight: ${request.deliveryWeight} kg', style: GoogleFonts.poppins(fontSize: 12, color: AppTheme.onDark)),
                              if (request.deliveryComments != null && request.deliveryComments!.isNotEmpty)
                                Text('Note: ${request.deliveryComments}', style: GoogleFonts.poppins(fontSize: 12, color: Colors.grey.shade400)),
                              if (request.deliveryPhotoUrl != null && request.deliveryPhotoUrl!.isNotEmpty)
                                Padding(
                                  padding: const EdgeInsets.only(top: 4),
                                  child: Row(children: [
                                    const Icon(Icons.photo, size: 16, color: Colors.green),
                                    const SizedBox(width: 4),
                                    Text('Photo attached', style: GoogleFonts.poppins(fontSize: 12, color: Colors.green)),
                                  ]),
                                ),
                            ],
                          ),
                        ),
                      ],
                      const SizedBox(height: 16),
                      Container(
                        height: 80,
                        decoration: BoxDecoration(
                          color: AppTheme.surfaceDark,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Center(
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(Icons.photo_camera, color: Colors.grey.shade500, size: 28),
                              const SizedBox(width: 8),
                              Text('Evidencia del usuario (imagen/video)', style: GoogleFonts.poppins(color: Colors.grey.shade500, fontSize: 13)),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          SizedBox(
                            width: 40,
                            height: 40,
                            child: CircleAvatar(
                              radius: 20,
                              backgroundColor: AppTheme.surfaceDark,
                              backgroundImage: request.userPhotoUrl != null && request.userPhotoUrl!.isNotEmpty
                                  ? NetworkImage(request.userPhotoUrl!)
                                  : null,
                              child: request.userPhotoUrl == null || request.userPhotoUrl!.isEmpty
                                  ? Text('U', style: GoogleFonts.poppins(fontWeight: FontWeight.w600, color: AppTheme.onDark))
                                  : null,
                            ),
                          ),
                          const SizedBox(width: 10),
                          Text('⭐ ${(request.userRating ?? 4.5).toStringAsFixed(1)}', style: GoogleFonts.poppins(fontSize: 16, fontWeight: FontWeight.w600, color: AppTheme.onDark)),
                        ],
                      ),
                      const SizedBox(height: 16),
                      Text(t('user_offer', {'price': request.userBidPrice.toStringAsFixed(2)}), style: GoogleFonts.poppins(fontSize: 22, fontWeight: FontWeight.w700, color: AppTheme.neonOrange)),
                      const SizedBox(height: 20),
                      SizedBox(
                        height: 120,
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(12),
                          child: GoogleMap(
                            initialCameraPosition: CameraPosition(
                              target: LatLng(
                                (request.pickup.latitude + request.drop.latitude) / 2,
                                (request.pickup.longitude + request.drop.longitude) / 2,
                              ),
                              zoom: 12,
                            ),
                            onMapCreated: (c) {
                              c.animateCamera(CameraUpdate.newLatLngBounds(
                                LatLngBounds(
                                  southwest: LatLng(
                                    request.pickup.latitude < request.drop.latitude ? request.pickup.latitude : request.drop.latitude,
                                    request.pickup.longitude < request.drop.longitude ? request.pickup.longitude : request.drop.longitude,
                                  ),
                                  northeast: LatLng(
                                    request.pickup.latitude > request.drop.latitude ? request.pickup.latitude : request.drop.latitude,
                                    request.pickup.longitude > request.drop.longitude ? request.pickup.longitude : request.drop.longitude,
                                  ),
                                ),
                                40,
                              ));
                            },
                            markers: {
                              Marker(markerId: const MarkerId('p'), position: request.pickup, icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueGreen)),
                              Marker(markerId: const MarkerId('d'), position: request.drop, icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueRed)),
                            },
                            polylines: {
                              Polyline(
                                polylineId: const PolylineId('route'),
                                points: [request.pickup, request.drop],
                                color: AppTheme.neonOrange,
                                width: 4,
                              ),
                            },
                            myLocationEnabled: false,
                            myLocationButtonEnabled: false,
                            zoomControlsEnabled: false,
                            compassEnabled: false,
                            mapToolbarEnabled: false,
                          ),
                        ),
                      ),
                      const SizedBox(height: 24),
                      Row(
                        children: [
                          Expanded(
                            child: ElevatedButton(
                              onPressed: onAccept,
                              style: ElevatedButton.styleFrom(backgroundColor: Colors.green, foregroundColor: Colors.white),
                              child: Text(t('accept'), style: GoogleFonts.poppins(fontWeight: FontWeight.w600)),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: ElevatedButton(
                              onPressed: onCounterBid,
                              style: ElevatedButton.styleFrom(backgroundColor: AppTheme.neonOrange, foregroundColor: Colors.black87),
                              child: Text(t('counter_offer'), style: GoogleFonts.poppins(fontWeight: FontWeight.w600)),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: OutlinedButton(
                              onPressed: onDecline,
                              style: OutlinedButton.styleFrom(foregroundColor: Colors.red, side: const BorderSide(color: Colors.red)),
                              child: Text(t('decline'), style: GoogleFonts.poppins(fontWeight: FontWeight.w600)),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _row(IconData icon, String label, String text) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 20, color: AppTheme.neonOrange),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(label, style: GoogleFonts.poppins(fontSize: 11, color: Colors.grey.shade500, fontWeight: FontWeight.w600)),
              const SizedBox(height: 2),
              Text(text, style: GoogleFonts.poppins(color: AppTheme.onDark, fontSize: 14)),
            ],
          ),
        ),
      ],
    );
  }
}

class _CounterBidSheet extends StatefulWidget {
  const _CounterBidSheet({required this.userBidPrice, required this.onSend});

  final double userBidPrice;
  final Future<void> Function(double counterPrice) onSend;

  @override
  State<_CounterBidSheet> createState() => _CounterBidSheetState();
}

class _CounterBidSheetState extends State<_CounterBidSheet> {
  late double _counterPrice;

  @override
  void initState() {
    super.initState();
    _counterPrice = widget.userBidPrice;
  }

  @override
  Widget build(BuildContext context) {
    final scope = AppLocaleScope.of(context);
    final t = scope?.t ?? (String k, [Map<String, dynamic>? p]) => translate(k, defaultLocale, p);
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(t('counter_offer_sheet_title'), style: GoogleFonts.poppins(fontSize: 18, fontWeight: FontWeight.w600, color: AppTheme.onDark)),
          const SizedBox(height: 16),
          Text('S/ ${_counterPrice.toStringAsFixed(2)}', style: GoogleFonts.poppins(fontSize: 28, fontWeight: FontWeight.w600, color: AppTheme.neonOrange)),
          const SizedBox(height: 20),
                Wrap(
                  spacing: 10,
                  runSpacing: 10,
                  children: [1.0, 2.0, 5.0, 10.0].map((add) {
                    return ActionChip(
                      label: Text('+S/ ${add.toStringAsFixed(1)}', style: GoogleFonts.poppins(fontWeight: FontWeight.w600)),
                      backgroundColor: AppTheme.neonOrange.withValues(alpha: 0.2),
                      onPressed: () => setState(() => _counterPrice = widget.userBidPrice + add),
                    );
                  }).toList(),
                ),
          const SizedBox(height: 24),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: () async => await widget.onSend(_counterPrice),
              child: Text(t('send_counter'), style: GoogleFonts.poppins(fontWeight: FontWeight.w600)),
            ),
          ),
        ],
      ),
    );
  }
}

/// Right-side 3-line menu drawer: Total/Today/Credit + PDF/Excel download.
/// [driverId] is shown at top so driver can match with Admin Panel.
class _DriverMenuDrawer extends StatelessWidget {
  const _DriverMenuDrawer({this.driverId, required this.earningsService});

  final String? driverId;
  final EarningsService earningsService;

  @override
  Widget build(BuildContext context) {
    return Drawer(
      backgroundColor: AppTheme.surfaceDark,
      child: SafeArea(
        child: _DriverMenuDrawerContent(
          driverId: driverId,
          earningsService: earningsService,
        ),
      ),
    );
  }
}

class _DriverMenuDrawerContent extends StatefulWidget {
  const _DriverMenuDrawerContent({this.driverId, required this.earningsService});

  final String? driverId;
  final EarningsService earningsService;

  @override
  State<_DriverMenuDrawerContent> createState() => _DriverMenuDrawerContentState();
}

class _DriverMenuDrawerContentState extends State<_DriverMenuDrawerContent> {
  double _totalEarning = 0.0;
  double _todayEarning = 0.0;
  int _credits = 0;
  bool _loading = true;
  final WalletApi _walletApi = WalletApi();

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final total = await widget.earningsService.totalEarning();
    final today = await widget.earningsService.todayEarning();
    int credits = 0;
    final id = widget.driverId;
    if (id != null && id.isNotEmpty) {
      try {
        credits = await _walletApi.getBalance(id);
      } catch (_) {}
    }
    if (mounted) setState(() { _totalEarning = total; _todayEarning = today; _credits = credits; _loading = false; });
  }

  Future<void> _openFromDrawer(Widget screen) async {
    await Navigator.of(context, rootNavigator: true).push(MaterialPageRoute(builder: (_) => screen));
  }

  @override
  Widget build(BuildContext context) {
    final t = AppLocaleScope.of(context)?.t ?? (String k, [Map<String, dynamic>? p]) => translate(k, defaultLocale, p);
    return ListView(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Expanded(
              child: Image.asset(
                'assets/Both App logo.png',
                height: 36,
                fit: BoxFit.contain,
                errorBuilder: (_, __, ___) => Text(
                  kDriverAppTitle,
                  style: GoogleFonts.poppins(fontSize: 18, fontWeight: FontWeight.w700, color: AppTheme.onDark),
                ),
              ),
            ),
            IconButton(onPressed: () => Navigator.pop(context), icon: const Icon(Icons.close, color: AppTheme.onDark)),
          ],
        ),
        // Show Driver ID so driver can match with Admin Panel when approving.
        const SizedBox(height: 8),
        Container(
          padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 12),
          decoration: BoxDecoration(
            color: AppTheme.neonOrange.withValues(alpha: 0.15),
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: AppTheme.neonOrange.withValues(alpha: 0.5)),
          ),
          child: Row(
            children: [
              const Icon(Icons.badge_outlined, size: 18, color: AppTheme.neonOrange),
              const SizedBox(width: 8),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text('Driver ID', style: GoogleFonts.poppins(fontSize: 11, color: Colors.grey.shade400)),
                    Text(
                      widget.driverId != null && widget.driverId!.isNotEmpty
                          ? widget.driverId!
                          : 'Go online to get ID',
                      style: GoogleFonts.poppins(fontSize: 14, fontWeight: FontWeight.w600, color: AppTheme.onDark),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        if (_loading)
          const Center(child: Padding(padding: EdgeInsets.all(24), child: CircularProgressIndicator(color: AppTheme.neonOrange)))
        else ...[
          _bigStat(t('total_earning'), _totalEarning),
          const SizedBox(height: 16),
          _bigStat(t('today_earning'), _todayEarning),
          const SizedBox(height: 16),
          _bigStatCredits(t('credit'), _credits),
        ],
        const SizedBox(height: 12),
        ListTile(
          leading: const Icon(Icons.person_outline, color: AppTheme.neonOrange),
          title: Text(t('drawer_profile'), style: GoogleFonts.poppins(fontSize: 15, color: AppTheme.onDark)),
          onTap: () => _openFromDrawer(const ProfileScreen()),
        ),
        ListTile(
          leading: const Icon(Icons.attach_money, color: AppTheme.neonOrange),
          title: Text(t('drawer_earnings'), style: GoogleFonts.poppins(fontSize: 15, color: AppTheme.onDark)),
          onTap: () => _openFromDrawer(const EarningsScreen()),
        ),
        ListTile(
          leading: const Icon(Icons.account_balance_wallet_outlined, color: AppTheme.neonOrange),
          title: Text(t('drawer_wallet'), style: GoogleFonts.poppins(fontSize: 15, color: AppTheme.onDark)),
          onTap: () => _openFromDrawer(const WalletScreen()),
        ),
        // Bug fix: expose scratch card entry so daily reward is visible.
        ListTile(
          leading: const Icon(Icons.card_giftcard_outlined, color: AppTheme.neonOrange),
          title: Text(t('quick_scratch'), style: GoogleFonts.poppins(fontSize: 15, color: AppTheme.onDark)),
          onTap: () => _openFromDrawer(const ScratchCardScreen()),
        ),
        ListTile(
          leading: const Icon(Icons.verified_user_outlined, color: AppTheme.neonOrange),
          title: Text(t('drawer_verification'), style: GoogleFonts.poppins(fontSize: 15, color: AppTheme.onDark)),
          onTap: () => _openFromDrawer(const VerificationScreen()),
        ),
        ListTile(
          leading: const Icon(Icons.home_outlined, color: AppTheme.onDark),
          title: Text(t('drawer_go_home'), style: GoogleFonts.poppins(fontSize: 15, color: AppTheme.onDark)),
          onTap: () => Navigator.pop(context), // Close drawer
        ),
        ListTile(
          leading: const Icon(Icons.settings_outlined, color: AppTheme.onDark),
          title: Text(t('drawer_settings'), style: GoogleFonts.poppins(fontSize: 15, color: AppTheme.onDark)),
          onTap: () => _openFromDrawer(const SettingsScreen()),
        ),
        ListTile(
          leading: const Icon(Icons.logout, color: Colors.red),
          title: Text(t('drawer_logout'), style: GoogleFonts.poppins(fontSize: 15, color: Colors.red)),
          onTap: () async {
            // Bug fix: sign out + clear cached profile to avoid auto-login on refresh.
            final nav = Navigator.of(context);
            nav.pop();
            await ProfileStorageService.clear();
            nav.pushAndRemoveUntil(
              MaterialPageRoute(builder: (_) => const LoginScreen()),
              (r) => false,
            );
          },
        ),
        const Divider(height: 24),
      ],
    );
  }

  Widget _bigStat(String label, double value) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 20),
      decoration: BoxDecoration(
        color: AppTheme.darkBg,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppTheme.neonOrange.withValues(alpha: 0.5)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: GoogleFonts.poppins(fontSize: 14, color: Colors.grey.shade400)),
          const SizedBox(height: 4),
          Text('S/ ${value.toStringAsFixed(2)}', style: GoogleFonts.poppins(fontSize: 22, fontWeight: FontWeight.w700, color: AppTheme.neonOrange)),
        ],
      ),
    );
  }

  Widget _bigStatCredits(String label, int value) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 20),
      decoration: BoxDecoration(
        color: AppTheme.darkBg,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppTheme.neonOrange.withValues(alpha: 0.5)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: GoogleFonts.poppins(fontSize: 14, color: Colors.grey.shade400)),
          const SizedBox(height: 4),
          Text(value.toString(), style: GoogleFonts.poppins(fontSize: 22, fontWeight: FontWeight.w700, color: AppTheme.neonOrange)),
        ],
      ),
    );
  }
}

class _OfflineShortcuts extends StatelessWidget {
  const _OfflineShortcuts({
    required this.onOpenVerification,
    required this.onOpenWallet,
    required this.canRecharge,
    required this.showDocuments,
  });

  final VoidCallback onOpenVerification;
  final VoidCallback onOpenWallet;
  final bool canRecharge;
  final bool showDocuments;

  @override
  Widget build(BuildContext context) {
    final t = AppLocaleScope.of(context)?.t ?? (String k, [Map<String, dynamic>? p]) => translate(k, defaultLocale, p);
    return Material(
      elevation: 4,
      borderRadius: BorderRadius.circular(16),
      color: AppTheme.surfaceDark,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              canRecharge ? t('home_offline_hint') : 'Complete verification first',
              style: GoogleFonts.poppins(fontSize: 12, color: Colors.grey.shade400),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                if (showDocuments)
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: onOpenVerification,
                      icon: const Icon(Icons.folder_open, size: 18),
                      label: Text(t('home_fix_verification'), style: GoogleFonts.poppins(fontSize: 13, fontWeight: FontWeight.w600)),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: AppTheme.neonOrange,
                        side: const BorderSide(color: AppTheme.neonOrange),
                        padding: const EdgeInsets.symmetric(vertical: 10),
                      ),
                    ),
                  ),
                if (canRecharge && showDocuments) const SizedBox(width: 10),
                if (canRecharge)
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: onOpenWallet,
                      icon: const Icon(Icons.account_balance_wallet_outlined, size: 18),
                      label: Text(t('home_fix_wallet'), style: GoogleFonts.poppins(fontSize: 13, fontWeight: FontWeight.w600)),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: AppTheme.neonOrange,
                        side: const BorderSide(color: AppTheme.neonOrange),
                        padding: const EdgeInsets.symmetric(vertical: 10),
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
}

class _GoOnlinePanel extends StatelessWidget {
  const _GoOnlinePanel({
    required this.isOnline,
    required this.onToggle,
    required this.locationDenied,
  });

  final bool isOnline;
  final VoidCallback onToggle;
  final bool locationDenied;

  @override
  Widget build(BuildContext context) {
    final t = AppLocaleScope.of(context)?.t ?? (String k, [Map<String, dynamic>? p]) => translate(k, defaultLocale, p);
    return Material(
      elevation: 8,
      borderRadius: BorderRadius.circular(24),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: BoxDecoration(
          color: AppTheme.surfaceDark,
          borderRadius: BorderRadius.circular(24),
          border: Border.all(color: Colors.grey.shade600),
        ),
        child: Row(
          children: [
            Expanded(
              child: Text(
                t('you_are_offline'),
                textAlign: TextAlign.center,
                style: GoogleFonts.poppins(
                  fontSize: 14,
                  fontWeight: FontWeight.w500,
                  color: isOnline ? Colors.grey.shade500 : AppTheme.onDark,
                ),
              ),
            ),
            Switch(
              value: isOnline,
              onChanged: locationDenied ? null : (_) => onToggle(),
              activeThumbColor: AppTheme.neonOrange,
              activeTrackColor: AppTheme.neonOrange.withValues(alpha: 0.5),
            ),
            Expanded(
              child: Text(
                t('driver_on_duty'),
                textAlign: TextAlign.center,
                style: GoogleFonts.poppins(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: isOnline ? AppTheme.neonOrange : Colors.grey.shade500,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
