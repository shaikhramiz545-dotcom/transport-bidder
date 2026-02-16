import 'dart:async';
import 'dart:math' as math;
import 'dart:ui' as ui;
import 'dart:ui' show ImageFilter;

import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:geolocator/geolocator.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:geocoding/geocoding.dart' as geocoding;
import 'package:tbidder_user_app/services/places_service.dart';
import 'package:tbidder_user_app/services/directions_service.dart';
import 'package:tbidder_user_app/services/bidding_service.dart';
import 'package:tbidder_user_app/services/fare_service.dart';
import 'package:tbidder_user_app/utils/lat_lng_interpolation.dart';
import 'package:tbidder_user_app/l10n/app_locale.dart';
import 'package:tbidder_user_app/features/auth/login_screen.dart';
import 'package:tbidder_user_app/features/profile/profile_screen.dart';
import 'package:tbidder_user_app/features/history/history_screen.dart';
import 'package:tbidder_user_app/features/support/support_screen.dart';
import 'package:tbidder_user_app/features/tours/tours_list_screen.dart';
import 'package:tbidder_user_app/services/profile_storage_service.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher/url_launcher.dart';

/// Bright Neon Orange for primary actions (Buscar Vehículo, selected items).
const Color _kNeonOrange = Color(0xFFFF6700);
/// Cream background for bidding sheet.
const Color _kCream = Color(0xFFF5F5DC);

/// A driver's bid in the live bidding list. [price] and [status] are mutable for counter-offer flow.
class DriverBid {
  DriverBid({
    required this.id,
    required this.driverId,
    required this.driverName,
    required this.carModel,
    this.photoUrl,
    required this.rating,
    required this.price,
    this.status,
    required this.createdAt,
  });
  final String id;
  final String driverId;
  final String driverName;
  final String carModel;
  final String? photoUrl;
  final double rating;
  double price;
  String? status; // null, "Esperando respuesta...", etc.
  final DateTime createdAt;
}

/// Parent category for two-tier vehicle selector. children is never null (use [] for leaf).
class _VehicleCategory {
  const _VehicleCategory({
    required this.id,
    required this.label,
    required this.emoji,
    required this.children,
    this.singleVehicle,
  });
  final String id;
  final String label;
  final String emoji;
  final List<VehicleType> children;
  final VehicleType? singleVehicle;
}

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final GlobalKey<ScaffoldState> _scaffoldKey = GlobalKey<ScaffoldState>();
  final Completer<GoogleMapController> _mapCompleter = Completer<GoogleMapController>();
  GoogleMapController? _mapController;
  final TextEditingController _pickupController = TextEditingController();
  final TextEditingController _dropController = TextEditingController();
  final TextEditingController _messageController = TextEditingController();
  final TextEditingController _bidPriceController = TextEditingController();
  final PlacesService _placesService = PlacesService();
  final DirectionsService _directionsService = DirectionsService();
  final BiddingService _biddingService = BiddingService();

  List<Map<String, dynamic>> _pickupPredictions = [];
  List<Map<String, dynamic>> _dropPredictions = [];
  bool _pickupFieldActive = true;

  LatLng? _pickup;
  LatLng? _drop;
  LatLng? _driverPosition;
  LatLng? _userLocation;
  StreamSubscription<LatLng>? _driverLocationSubscription;
  String _pickupDescription = '';
  String _dropDescription = '';

  Set<Marker> _markers = {};
  Set<Polyline> _polylines = {};
  final Map<VehicleType?, BitmapDescriptor> _pickupIconCache = {};
  BitmapDescriptor? _dropIconCache;
  BitmapDescriptor? _userPersonIconCache;
  BitmapDescriptor? _driverFallbackIconCache;
  final String _userGenderEmoji = '👨'; // 👨 male, 👩 female – profile se aayega later
  String _distanceText = '';
  String _durationText = '';
  double _distanceKm = 0.0;
  int _trafficDelayMins = 0;
  VehicleType? _selectedVehicle;
  String? _selectedCategory; // Parent category id for two-tier UI
  double _estimatedPrice = 0.0;
  double? _userBidPrice;
  bool _needHelper = false; // Freight: helper for loading/unloading (+ extra fee)
  bool _isSearching = false;
  String? _searchingVehicleLabel;
  bool _isLoadingRoute = false;
  double? _driverCounterPrice;
  bool _isMapCreated = false;
  Timer? _driverLocationPollTimer;
  String? _currentRideId;
  String? _currentRideOtp;
  String? _currentRideStatus;
  bool _driverArrivedNotified = false;
  List<Map<String, dynamic>> _rideMessages = [];
  String? _driverPhone;
  int? _nearbyDriversCount;
  /// Shown when auto location request didn't prompt (e.g. web needs user gesture). User taps [Allow] to request.
  bool _showLocationPrompt = false;
  bool _locationRequestInProgress = false;
  bool _pickupCurrentLocationLoading = false;
  /// When true, next tap on map sets destination (B).
  bool _waitingForMapTapDestination = false;
  /// Outstation fields
  int _outstationPassengers = 1;
  String _outstationComments = '';
  bool _outstationIsParcel = false;
  /// Delivery fields
  String _deliveryComments = '';
  String _deliveryWeight = '';
  String? _deliveryPhotoPath;

  static const List<_VehicleCategory> _vehicleCategories = [
    _VehicleCategory(id: 'taxi', label: 'Taxi', emoji: '🚖', children: [VehicleType.taxi_std, VehicleType.taxi_suv, VehicleType.taxi_xl, VehicleType.taxi_outstation]),
    _VehicleCategory(id: 'truck', label: 'Truck', emoji: '🚚', children: [VehicleType.truck_s, VehicleType.truck_m, VehicleType.truck_l, VehicleType.truck_hauler]),
    _VehicleCategory(id: 'moto', label: 'Bike', emoji: '🏍️', children: [], singleVehicle: VehicleType.moto),
    _VehicleCategory(id: 'delivery', label: 'Delivery', emoji: '📦', children: [], singleVehicle: VehicleType.delivery),
    _VehicleCategory(id: 'ambulance', label: 'Ambulance', emoji: '🚑', children: [VehicleType.amb_basic, VehicleType.amb_icu]),
  ];

  static const MarkerId _pickupMarkerId = MarkerId('pickup');
  static const MarkerId _dropMarkerId = MarkerId('drop');
  static const MarkerId _driverMarkerId = MarkerId('driverMarker');
  static const MarkerId _userMarkerId = MarkerId('user_me');
  static const PolylineId _routePolylineId = PolylineId('route');

  static const String _kLastLat = 'user_last_lat';
  static const String _kLastLng = 'user_last_lng';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _checkLocationOnStart());
  }

  /// App start par: previous vs current location test. Agar location change hai (pehle tha ab nahi mila) to hi "Turn on location" button dikhao.
  Future<void> _checkLocationOnStart() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final hadPreviousLocation = prefs.getDouble(_kLastLat) != null && prefs.getDouble(_kLastLng) != null;

      final serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        if (mounted) await _showGpsDisabledDialog();
        if (mounted && hadPreviousLocation) setState(() => _showLocationPrompt = true);
        return;
      }
      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.deniedForever || permission == LocationPermission.denied) {
        if (permission == LocationPermission.deniedForever && mounted) await _showDeniedForeverDialog();
        if (mounted && hadPreviousLocation) setState(() => _showLocationPrompt = true);
        return;
      }
      final pos = await Geolocator.getCurrentPosition(desiredAccuracy: LocationAccuracy.medium);
      if (!mounted) return;
      final latLng = LatLng(pos.latitude, pos.longitude);
      await prefs.setDouble(_kLastLat, pos.latitude);
      await prefs.setDouble(_kLastLng, pos.longitude);
      setState(() {
        _userLocation = latLng;
        _showLocationPrompt = false;
        if (_pickup == null) {
          _pickup = latLng;
          _pickupDescription = _t('current_location');
          _pickupController.text = _t('current_location');
          _pickupPredictions = [];
        }
      });
      _updateMarkers();
      await _moveCamera(pos.latitude, pos.longitude, 15.0);
      final count = await _biddingService.getNearbyDriversCount(pos.latitude, pos.longitude, radiusKm: 5);
      if (mounted) setState(() => _nearbyDriversCount = count);
    } catch (_) {
      final prefs = await SharedPreferences.getInstance();
      final hadPreviousLocation = prefs.getDouble(_kLastLat) != null && prefs.getDouble(_kLastLng) != null;
      if (mounted && hadPreviousLocation) setState(() => _showLocationPrompt = true);
    }
    if (mounted && _userLocation == null) _fetchUserLocation();
  }

  /// Peru (Lima) – default map center for user app.
  static const CameraPosition _initialCamera = CameraPosition(
    target: LatLng(-12.0464, -77.0428),
    zoom: 14.0,
  );

  /// Taxi / Bike taxi (Moto) = first message; Truck / Ambulance / Delivery = second message with ETA.
  static bool _isTaxiOrMoto(VehicleType? v) {
    if (v == null) return true;
    return v == VehicleType.moto ||
        v == VehicleType.taxi_std ||
        v == VehicleType.taxi_suv ||
        v == VehicleType.taxi_xl ||
        v == VehicleType.taxi_outstation;
  }

  String _t(String key, [Map<String, dynamic>? params]) {
    final scope = AppLocaleScope.of(context);
    return scope?.t(key, params) ?? translate(key, defaultLocale, params);
  }

  Future<void> _showDriverThankYouDialog(String driverName) async {
    final v = _selectedVehicle;
    final isTaxiOrMoto = _isTaxiOrMoto(v);
    final etaMins = (_distanceKm * 2).round() + _trafficDelayMins;
    final params = {'driverName': driverName, 'etaMins': etaMins};
    final String title = isTaxiOrMoto ? _t('thank_you_title_taxi') : _t('driver_on_the_way_title');
    final String body = isTaxiOrMoto ? _t('thank_you_body_taxi', params) : _t('thank_you_body_other', params);
    if (!mounted) return;
    await showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text(title, style: GoogleFonts.poppins(fontWeight: FontWeight.w700)),
        content: Text(body, style: GoogleFonts.poppins(fontSize: 15)),
      ),
    );
  }

  void _showLanguageSelector() {
    final scope = AppLocaleScope.of(context);
    if (scope == null) return;
    showModalBottomSheet<void>(
      context: context,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(16))),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 24, horizontal: 20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(scope.t('select_language'), style: GoogleFonts.poppins(fontSize: 18, fontWeight: FontWeight.w700)),
              const SizedBox(height: 16),
              ...supportedLocales.map((loc) => ListTile(
                leading: Text(scope.locale.languageCode == loc.languageCode ? '✓' : '', style: GoogleFonts.poppins(fontSize: 18)),
                title: Text(languageName(loc), style: GoogleFonts.poppins(fontSize: 16)),
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

  Future<void> _moveCamera(double lat, double lng, [double zoom = 16.0]) async {
    try {
      if (!mounted) return;
      final controller = await _mapCompleter.future;
      if (!mounted || _mapController == null) return;
      controller.animateCamera(CameraUpdate.newCameraPosition(
        CameraPosition(target: LatLng(lat, lng), zoom: zoom),
      ));
    } catch (_) {}
  }

  /// Fits the map camera so the full route (all points) is visible. Uses padding 50.
  Future<void> _fitBoundsToRoute(List<LatLng> points) async {
    if (points.isEmpty) return;
    try {
      if (!mounted || _mapController == null) return;

      double minLat = points.first.latitude;
      double maxLat = points.first.latitude;
      double minLng = points.first.longitude;
      double maxLng = points.first.longitude;
      for (final p in points) {
        if (p.latitude < minLat) minLat = p.latitude;
        if (p.latitude > maxLat) maxLat = p.latitude;
        if (p.longitude < minLng) minLng = p.longitude;
        if (p.longitude > maxLng) maxLng = p.longitude;
      }

      // Ensure non-zero span so newLatLngBounds is valid (e.g. single point or short segment).
      const minSpan = 0.002;
      if (maxLat - minLat < minSpan) {
        final c = (minLat + maxLat) / 2;
        minLat = c - minSpan / 2;
        maxLat = c + minSpan / 2;
      }
      if (maxLng - minLng < minSpan) {
        final c = (minLng + maxLng) / 2;
        minLng = c - minSpan / 2;
        maxLng = c + minSpan / 2;
      }

      final bounds = LatLngBounds(
        southwest: LatLng(minLat, minLng),
        northeast: LatLng(maxLat, maxLng),
      );
      _mapController?.animateCamera(CameraUpdate.newLatLngBounds(bounds, 50));
    } catch (_) {}
  }

  /// Converts Flutter IconData to BitmapDescriptor (e.g. destination pin). Transparent background, icon only.
  /// On failure returns default red marker.
  Future<BitmapDescriptor> _bitmapDescriptorFromIcon(IconData icon, Color color, {double size = 100}) async {
    try {
      final pictureRecorder = ui.PictureRecorder();
      final canvas = Canvas(pictureRecorder);
      final fontSize = size * 0.6;
      final textPainter = TextPainter(
        text: TextSpan(
          text: String.fromCharCode(icon.codePoint),
          style: TextStyle(
            color: color,
            fontSize: fontSize,
            fontFamily: icon.fontFamily,
            package: icon.fontPackage,
          ),
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
    return BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueRed);
  }

  /// Colored circle as PNG – web par bhi kaam karta hai (defaultMarkerWithHue web par support nahi).
  Future<BitmapDescriptor> _bitmapDescriptorFromColoredCircle(Color fillColor, {double size = 64}) async {
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
    return BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueRed);
  }

  /// Converts emoji text to BitmapDescriptor for map markers. Transparent background, emoji only.
  /// On failure returns default green marker.
  Future<BitmapDescriptor> _bitmapDescriptorFromEmoji(String emoji, double size) async {
    try {
      final pictureRecorder = ui.PictureRecorder();
      final canvas = Canvas(pictureRecorder);
      final fontSize = size * 0.55;
      final textPainter = TextPainter(
        text: TextSpan(
          text: emoji.isNotEmpty ? emoji : '📍',
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
    return BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueGreen);
  }

  double _fareForVehicle(VehicleType v) => calculateFare(
    distanceKm: _distanceKm,
    trafficDelayMins: _trafficDelayMins,
    vehicle: v,
  );

  Future<void> _searchLocation(String query, bool isPickup) async {
    if (query.trim().isEmpty) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) {
          setState(() {
            if (isPickup) {
              _pickupPredictions = [];
            } else {
              _dropPredictions = [];
            }
          });
        }
      });
      return;
    }
    try {
      final list = await _placesService.getPlacePredictions(query);
      if (!mounted) return;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) {
          setState(() {
            if (isPickup) {
              _pickupPredictions = list;
            } else {
              _dropPredictions = list;
            }
          });
        }
      });
    } catch (_) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) {
          setState(() {
            if (isPickup) {
              _pickupPredictions = [];
            } else {
              _dropPredictions = [];
            }
          });
        }
      });
    }
  }

  Future<void> _onPlaceSelected(Map<String, dynamic> prediction, bool isPickup) async {
    final placeId = prediction['place_id'] as String?;
    final description = prediction['description'] as String? ?? '';
    if (placeId == null) return;

    FocusScope.of(context).unfocus();
    if (!mounted) return;
    setState(() {
      if (isPickup) {
        _pickupPredictions = [];
      } else {
        _dropPredictions = [];
      }
    });

    try {
      final details = await _placesService.getPlaceDetails(placeId);
      if (!mounted || details == null) return;

      final lat = details.lat;
      final lng = details.lng;
      final position = LatLng(lat, lng);

      if (!mounted) return;
      setState(() {
        if (isPickup) {
          _pickup = position;
          _pickupDescription = description;
          _pickupController.text = description;
        } else {
          _drop = position;
          _dropDescription = description;
          _dropController.text = description;
        }
        _updateMarkers();
        _polylines = {};
        _distanceText = '';
        _durationText = '';
        _distanceKm = 0.0;
        _trafficDelayMins = 0;
        _estimatedPrice = _selectedVehicle != null ? _fareForVehicle(_selectedVehicle!) : 0.0;
      });

      if (_pickup != null && _drop != null) {
        await _fitBoundsToRoute([_pickup!, _drop!]);
      } else {
        await _moveCamera(lat, lng);
      }
    } catch (_) {}
  }

  /// Fetch user's current location. Flow: check permission → request if denied → denied forever → show dialog → else get location → animate camera → set pickup if not set.
  /// On web, requestPermission() only shows when called from a user gesture (e.g. Allow button tap).
  /// Location prompt button sirf tab dikhao jab pehle location tha ab nahi mila (location change).
  Future<void> _fetchUserLocation() async {
    try {
      final serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled && mounted) {
        await _showGpsDisabledDialog();
        setState(() => _locationRequestInProgress = false);
        return;
      }
      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
        if (permission == LocationPermission.denied ||
            permission == LocationPermission.deniedForever) {
          if (permission == LocationPermission.deniedForever && mounted) {
            await _showDeniedForeverDialog();
          }
          if (mounted) {
            final prefs = await SharedPreferences.getInstance();
            final had = prefs.getDouble(_kLastLat) != null && prefs.getDouble(_kLastLng) != null;
            if (had) setState(() => _showLocationPrompt = true);
          }
          return;
        }
      }
      if (permission == LocationPermission.deniedForever) {
        if (mounted) await _showDeniedForeverDialog();
        if (mounted) {
          final prefs = await SharedPreferences.getInstance();
          final had = prefs.getDouble(_kLastLat) != null && prefs.getDouble(_kLastLng) != null;
          if (had) setState(() => _showLocationPrompt = true);
        }
        return;
      }
      final pos = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.medium,
      );
      if (!mounted) return;
      final latLng = LatLng(pos.latitude, pos.longitude);
      final prefs = await SharedPreferences.getInstance();
      await prefs.setDouble(_kLastLat, pos.latitude);
      await prefs.setDouble(_kLastLng, pos.longitude);
      setState(() {
        _userLocation = latLng;
        _showLocationPrompt = false;
        _locationRequestInProgress = false;
        if (_pickup == null) {
          _pickup = latLng;
          _pickupDescription = _t('current_location');
          // _pickupController.text = _t('current_location');
          _pickupPredictions = [];
        }
      });
      _updateMarkers();
      await _moveCamera(pos.latitude, pos.longitude, 15.0);
      final count = await _biddingService.getNearbyDriversCount(pos.latitude, pos.longitude, radiusKm: 5);
      if (mounted) setState(() => _nearbyDriversCount = count);
    } catch (_) {
      if (mounted) {
        final prefs = await SharedPreferences.getInstance();
        final had = prefs.getDouble(_kLastLat) != null && prefs.getDouble(_kLastLng) != null;
        if (had) setState(() => _showLocationPrompt = true);
      }
    } finally {
      if (mounted) setState(() => _locationRequestInProgress = false);
    }
  }

  Future<void> _showGpsDisabledDialog() async {
    await showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(_t('gps_disabled_title')),
        content: Text(_t('gps_disabled_message')),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: Text(_t('cancel'))),
          FilledButton(
            onPressed: () {
              Navigator.pop(ctx);
              Geolocator.openLocationSettings();
            },
            child: Text(_t('open_settings')),
          ),
        ],
      ),
    );
  }

  Future<void> _showDeniedForeverDialog() async {
    final open = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(_t('location_denied_forever_title')),
        content: Text(_t('location_denied_forever_message')),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: Text(_t('cancel'))),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: FilledButton.styleFrom(backgroundColor: _kNeonOrange),
            child: Text(_t('open_settings')),
          ),
        ],
      ),
    );
    if (open == true) await openAppSettings();
  }

  /// Call from a user gesture (e.g. Allow button tap) so browser shows location permission dialog on web.
  void _onAllowLocationTap() {
    setState(() => _locationRequestInProgress = true);
    _fetchUserLocation();
  }

  /// Shows a centered toast (no bottom bar, no background) for location feedback.
  void _showCenterToast(String message) {
    if (!mounted) return;
    final overlay = Overlay.of(context);
    late OverlayEntry entry;
    entry = OverlayEntry(
      builder: (ctx) => IgnorePointer(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24),
            child: Text(
              message,
              style: GoogleFonts.poppins(
                fontSize: 15,
                fontWeight: FontWeight.w600,
                color: Colors.black87,
                shadows: [
                  Shadow(color: Colors.white.withOpacity(0.9), blurRadius: 4, offset: const Offset(0, 1)),
                  Shadow(color: Colors.white.withOpacity(0.9), blurRadius: 8, offset: const Offset(0, 2)),
                ],
              ),
            ),
          ),
        ),
      ),
    );
    overlay.insert(entry);
    Future.delayed(const Duration(seconds: 2), () {
      try { entry.remove(); } catch (_) {}
    });
  }

  /// Called when user taps map while _waitingForMapTapDestination is true. Sets destination (B) to tapped point.
  void _onMapTappedForDestination(LatLng position) {
    if (!_waitingForMapTapDestination) return;
    setState(() {
      _waitingForMapTapDestination = false;
      _drop = position;
      _dropDescription = _t('selected_on_map');
      _dropController.text = _t('selected_on_map');
      _dropPredictions = [];
    });
    _updateMarkers();
    if (_pickup != null) {
      _fetchAndDrawRoute().then((_) {
        if (mounted) setState(() { _selectedVehicle = null; _selectedCategory = null; });
      });
    }
    if (mounted) _showCenterToast(_t('destination_set_on_map'));
  }

  /// Enters "tap on map" mode: next map tap will set destination (B). Show SnackBar with Cancel.
  void _startMapTapForDestination() {
    setState(() => _waitingForMapTapDestination = true);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(_t('tap_on_map_to_set_destination')),
        duration: const Duration(seconds: 4),
        action: SnackBarAction(
          label: _t('cancel'),
          textColor: Colors.white,
          onPressed: () {
            setState(() => _waitingForMapTapDestination = false);
          },
        ),
      ),
    );
  }

  /// Sets pickup (A / origin) to user's current location. Use from button tap (user gesture) for web permission.
  Future<void> _setPickupToCurrentLocation() async {
    // Validation: Run from user tap so browser permission dialog can show (web requires gesture).
    setState(() => _pickupCurrentLocationLoading = true);
    try {
      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
        if (permission == LocationPermission.denied ||
            permission == LocationPermission.deniedForever) {
          // Validation: Permission is required to fetch GPS; block flow until user allows.
          if (mounted) {
            setState(() {
              _showLocationPrompt = true;
              _pickupCurrentLocationLoading = false;
            });
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text(_t('location_denied_pickup'))),
            );
          }
          return;
        }
      }
      final pos = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.medium,
      );
      if (!mounted) return;
      final latLng = LatLng(pos.latitude, pos.longitude);
      setState(() {
        _pickup = latLng;
        _pickupDescription = _t('current_location');
        _pickupController.text = _t('current_location');
        _pickupPredictions = [];
        _userLocation ??= latLng;
        _showLocationPrompt = false;
      });
      _updateMarkers();
      // Geolocation handling: center map so user sees the pickup point update immediately.
      await _moveCamera(pos.latitude, pos.longitude, 16.0);
      if (_drop != null) {
        await _fetchAndDrawRoute();
        if (mounted) setState(() { _selectedVehicle = null; _selectedCategory = null; });
      }
      // Geolocation handling: reverse geocode to a readable address (mobile only to avoid web CORS).
      _reverseGeocodePickup(latLng);
      if (mounted) {
        setState(() => _pickupCurrentLocationLoading = false);
        _showCenterToast(_t('pickup_set_current'));
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _pickupCurrentLocationLoading = false;
          _showLocationPrompt = true;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(_t('location_fetch_failed'))),
        );
      }
    }
  }

  /// Reverse geocode pickup to address. Mobile only; web stays with "Current location".
  void _reverseGeocodePickup(LatLng p) async {
    if (kIsWeb) return;
    try {
      final list = await geocoding.placemarkFromCoordinates(p.latitude, p.longitude);
      if (list.isNotEmpty) {
        final pm = list.first;
        final addressParts = <String?>[
          pm.street,
          pm.subLocality,
          pm.locality,
          pm.subAdministrativeArea,
          pm.administrativeArea,
        ].whereType<String>().map((s) => s.trim()).where((s) => s.isNotEmpty).toList();
        final address = addressParts.join(', ');
        if (address.isNotEmpty && mounted) {
          setState(() {
            _pickupDescription = address;
            _pickupController.text = address;
          });
        }
      }
    } catch (_) {}
  }

  /// Builds markers: pickup = selected vehicle emoji (or green pin), drop = small red location pin.
  /// Pickup and destination use zIndex so they appear on top of the route polyline.
  Future<void> _updateMarkers() async {
    final BitmapDescriptor pickupIcon;
    if (_selectedVehicle != null) {
      pickupIcon = _pickupIconCache[_selectedVehicle] ??= await _bitmapDescriptorFromEmoji(
        _selectedVehicle!.emoji,
        80,
      );
    } else {
      pickupIcon = _pickupIconCache[null] ??= BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueGreen);
    }
    final dropIcon = _dropIconCache ??= await _bitmapDescriptorFromIcon(Icons.location_on, Colors.red, size: 55);

    final m = <Marker>{};
    if (_pickup != null) {
      m.add(Marker(
        markerId: _pickupMarkerId,
        position: _pickup!,
        icon: pickupIcon,
        zIndex: 2,
        infoWindow: InfoWindow(title: _pickupDescription.isNotEmpty ? _pickupDescription : 'Origen'),
      ));
    }
    if (_drop != null) {
      m.add(Marker(
        markerId: _dropMarkerId,
        position: _drop!,
        icon: dropIcon,
        zIndex: 2,
        infoWindow: InfoWindow(title: _dropDescription.isNotEmpty ? _dropDescription : 'Destino'),
      ));
    }
    // Driver = user ke select kiye vehicle ka icon (🚗/🏍️) taaki user ko pata chale "mera cab aa raha hai / chal raha hai"
    if (_driverPosition != null) {
      final BitmapDescriptor driverIcon;
      if (_selectedVehicle != null) {
        driverIcon = _pickupIconCache[_selectedVehicle] ??= await _bitmapDescriptorFromEmoji(
          _selectedVehicle!.emoji,
          72,
        );
      } else {
        driverIcon = _driverFallbackIconCache ??= await _bitmapDescriptorFromColoredCircle(_kNeonOrange);
      }
      final driverLabel = _selectedVehicle != null ? _selectedVehicle!.label : 'Conductor';
      m.add(Marker(
        markerId: _driverMarkerId,
        position: _driverPosition!,
        icon: driverIcon,
        zIndex: 3,
        infoWindow: InfoWindow(title: 'Tu vehículo', snippet: driverLabel),
      ));
    }
    // User (passenger) = male/female emoji marker (👨/👩). Async load and cache by _userGenderEmoji.
    if (_userLocation != null) {
      final personIcon = _userPersonIconCache ??= await _bitmapDescriptorFromEmoji(_userGenderEmoji, 56);
      m.add(Marker(
        markerId: _userMarkerId,
        position: _userLocation!,
        icon: personIcon,
        zIndex: 1,
        infoWindow: const InfoWindow(title: 'Tú'),
      ));
    }
    if (mounted) setState(() => _markers = m);
  }

  /// Animate driver marker from current to [target] over 1 second for smooth movement.
  Future<void> _animateDriverTo(LatLng target) async {
    final from = _driverPosition ?? target;
    await interpolateLatLng(
      from: from,
      to: target,
      duration: const Duration(milliseconds: 1000),
      onUpdate: (p) {
        if (!mounted) return;
        setState(() {
          _driverPosition = p;
          _updateMarkers();
        });
      },
    );
  }


  void _stopListeningToDriver() {
    _driverLocationSubscription?.cancel();
    _driverLocationSubscription = null;
    setState(() {
      _driverPosition = null;
      _updateMarkers();
    });
  }


  /// Poll driver location and ride status (OTP, driver_arrived, completed).
  void _startDriverLocationPolling(String rideId) {
    _driverLocationPollTimer?.cancel();
    _currentRideId = rideId;
    _driverArrivedNotified = false;
    Future<void> poll() async {
      final loc = await _biddingService.getDriverLocation(rideId);
      final ride = await _biddingService.getRide(rideId);
      if (!mounted || _currentRideId != rideId) return;
      if (loc != null) {
        final lat = loc.lat;
        final lng = loc.lng;
        if (lat != null && lng != null) _animateDriverTo(LatLng(lat, lng));
      }
      if (ride != null) {
        final status = ride['status'] as String?;
        final otpRaw = ride['otp'];
        final otp = otpRaw?.toString().trim();
        if (status != null && status != _currentRideStatus) {
          setState(() => _currentRideStatus = status);
          if (status == 'driver_arrived' && !_driverArrivedNotified) {
            _driverArrivedNotified = true;
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text(_t('driver_arrived'), style: GoogleFonts.poppins(fontWeight: FontWeight.w600)),
                backgroundColor: Colors.green,
                duration: const Duration(seconds: 4),
              ),
            );
          }
          if (status == 'ride_started') {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text(_t('ride_started_enjoy'), style: GoogleFonts.poppins(fontWeight: FontWeight.w600)),
                backgroundColor: Colors.green,
                duration: const Duration(seconds: 3),
              ),
            );
          }
          if (status == 'completed') {
            _stopDriverLocationPolling();
            _showRideCompleteAndRating();
          }
        }
        if (otp != null && otp.isNotEmpty && otp != _currentRideOtp) setState(() => _currentRideOtp = otp);
        final msgs = ride['messages'] as List<dynamic>?;
        final list = msgs != null ? msgs.map((e) => Map<String, dynamic>.from(e as Map)).toList() : <Map<String, dynamic>>[];
        final phone = ride['driverPhone'] as String?;
        if (mounted) setState(() { _rideMessages = list; _driverPhone = phone != null && phone.isNotEmpty ? phone : null; });
      }
    }
    poll();
    _driverLocationPollTimer = Timer.periodic(const Duration(seconds: 3), (_) => poll());
  }

  void _stopDriverLocationPolling() {
    _driverLocationPollTimer?.cancel();
    _driverLocationPollTimer = null;
    _currentRideId = null;
    _currentRideOtp = null;
    _currentRideStatus = null;
    _rideMessages = [];
    _driverPhone = null;
    _stopListeningToDriver();
  }

  void _openChatSheet() {
    if (_currentRideId == null) return;
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => _ChatSheet(
        rideId: _currentRideId!,
        initialMessages: List.from(_rideMessages),
        biddingService: _biddingService,
        onMessagesUpdated: () async {
          final ride = await _biddingService.getRide(_currentRideId!);
          if (!mounted || ride == null) return;
          final msgs = ride['messages'] as List<dynamic>?;
          if (msgs != null) setState(() => _rideMessages = msgs.map((e) => Map<String, dynamic>.from(e as Map)).toList());
        },
      ),
    );
  }

  Future<void> _onCallDriver() async {
    final phone = _driverPhone?.trim();
    if (phone == null || phone.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(_t('phone_not_available')), backgroundColor: Colors.orange),
      );
      return;
    }
    await Clipboard.setData(ClipboardData(text: phone));
    final uri = Uri.parse('tel:$phone');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(_t('phone_not_available')), backgroundColor: Colors.orange),
      );
    }
  }

  Future<void> _showRideCompleteAndRating() async {
    if (!mounted) return;
    await showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        title: Text(_t('thanks_ride_complete_title'), style: GoogleFonts.poppins(fontWeight: FontWeight.w700)),
        content: Text(
          _t('thanks_ride_complete_body'),
          style: GoogleFonts.poppins(fontSize: 16),
        ),
        actions: [
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(),
            style: FilledButton.styleFrom(backgroundColor: _kNeonOrange),
            child: Text(_t('ok'), style: GoogleFonts.poppins(fontWeight: FontWeight.w600)),
          ),
        ],
      ),
    );
    if (!mounted) return;
    await _showRatingSheet();
  }

  Future<void> _showRatingSheet() async {
    if (!mounted) return;
    await showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(_t('how_was_trip'), style: GoogleFonts.poppins(fontSize: 18, fontWeight: FontWeight.w700)),
            const SizedBox(height: 16),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: List.generate(5, (i) => IconButton(
                icon: Icon(Icons.star, color: Colors.amber.shade700, size: 40),
                onPressed: () {},
              )),
            ),
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: () => Navigator.of(ctx).pop(),
                style: FilledButton.styleFrom(
                  backgroundColor: _kNeonOrange,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                child: Text(_t('send'), style: GoogleFonts.poppins(fontWeight: FontWeight.w600)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  double _haversineKm(LatLng a, LatLng b) {
    const R = 6371.0; // Earth radius km
    final dLat = (b.latitude - a.latitude) * math.pi / 180;
    final dLon = (b.longitude - a.longitude) * math.pi / 180;
    final x = math.sin(dLat / 2) * math.sin(dLat / 2) +
        math.cos(a.latitude * math.pi / 180) *
            math.cos(b.latitude * math.pi / 180) *
            math.sin(dLon / 2) *
            math.sin(dLon / 2);
    return 2 * R * math.asin(math.sqrt(x));
  }

  Future<void> _fetchAndDrawRoute() async {
    if (_pickup == null || _drop == null) return;
    final start = _pickup!;
    final end = _drop!;
    if (!mounted) return;
    setState(() => _isLoadingRoute = true);
    try {
      final result = await _directionsService.getDirections(
        origin: start,
        destination: end,
      );
      if (!mounted) return;
      if (result == null) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              _t('route_calc_failed'),
              style: GoogleFonts.poppins(fontSize: 14),
            ),
            backgroundColor: Colors.orange,
            duration: const Duration(seconds: 3),
          ),
        );
      }
      final points = (result != null && result.polylinePoints.isNotEmpty)
          ? result.polylinePoints
          : [_pickup!, _drop!];
      // Use result polyline or fallback to direct line
      final delay = result?.trafficDelayMins ?? 0;
      if (!mounted) return;
      setState(() {
        _polylines = {
          Polyline(
            polylineId: _routePolylineId,
            points: points,
            color: Colors.blue,
            width: 5,
            geodesic: true,
            zIndex: 1,
          ),
        };
        _distanceText = result?.distanceText ?? 'Ruta aproximada';
        _durationText = result?.durationText ?? '';
        _distanceKm = result?.distanceKm ?? _haversineKm(_pickup!, _drop!);
        _trafficDelayMins = delay;
        _estimatedPrice = _selectedVehicle != null ? _fareForVehicle(_selectedVehicle!) : 0.0;
      });
      await Future.delayed(const Duration(milliseconds: 100));
      if (!mounted) return;
      try {
        await _fitBoundsToRoute(points);
      } catch (_) {}
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            _t('route_calc_failed'),
            style: GoogleFonts.poppins(fontSize: 14),
          ),
          backgroundColor: Colors.orange,
          duration: const Duration(seconds: 3),
        ),
      );
      final fallbackPoints = [_pickup!, _drop!];
      setState(() {
        _polylines = {
          Polyline(
            polylineId: _routePolylineId,
            points: fallbackPoints,
            color: Colors.blue,
            width: 5,
            geodesic: true,
            zIndex: 1,
          ),
        };
        _distanceKm = _haversineKm(_pickup!, _drop!);
        _distanceText = '${_distanceKm.toStringAsFixed(1)} km (aproximado)';
        _durationText = '';
        _trafficDelayMins = 0;
        _estimatedPrice = _selectedVehicle != null ? _fareForVehicle(_selectedVehicle!) : 0.0;
      });
      await Future.delayed(const Duration(milliseconds: 100));
      if (!mounted) return;
      try {
        await _fitBoundsToRoute(fallbackPoints);
      } catch (_) {}
    } finally {
      if (mounted) setState(() => _isLoadingRoute = false);
    }
  }

  List<Map<String, dynamic>> get _activePredictions =>
      _pickupFieldActive ? _pickupPredictions : _dropPredictions;

  /// Safe vehicle selector: null checks, no fare in build loop, try-catch fallback.
  Widget _buildVehicleSelector() {
    if (_vehicleCategories.isEmpty) return const SizedBox.shrink();
    try {
      const categories = _vehicleCategories;
      if (categories.isEmpty) return const SizedBox.shrink();
      final selectedCat = _selectedCategoryData;
      final hasSubVehicles = selectedCat != null && selectedCat.children.isNotEmpty;

      return Positioned(
        left: 0,
        right: 0,
        bottom: 0,
        child: ConstrainedBox(
          constraints: BoxConstraints(maxHeight: MediaQuery.of(context).size.height * 0.7),
          child: _glassSurface(
          borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
          padding: EdgeInsets.only(
            left: 16,
            right: 16,
            top: 12,
            bottom: MediaQuery.of(context).padding.bottom + 16,
          ),
          child: SingleChildScrollView(
            child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Padding(
                padding: const EdgeInsets.only(bottom: 4),
                child: Text(
                  'S/ ${baseRatePerKm.toStringAsFixed(1)} per km',
                  style: GoogleFonts.poppins(fontSize: 12, fontWeight: FontWeight.w600, color: _kNeonOrange),
                  textAlign: TextAlign.center,
                ),
              ),
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      _t('select_vehicle'),
                      style: GoogleFonts.poppins(
                        fontSize: 18,
                        fontWeight: FontWeight.w700,
                        color: Colors.white,
                      ),
                    ),
                    Material(
                      color: Colors.transparent,
                      child: InkWell(
                        onTap: _clearRoute,
                        borderRadius: BorderRadius.circular(20),
                        child: Container(
                          width: 40,
                          height: 40,
                          decoration: BoxDecoration(
                            color: Colors.white.withOpacity(0.08),
                            shape: BoxShape.circle,
                            border: Border.all(color: Colors.white.withOpacity(0.10), width: 1),
                          ),
                          child: const Icon(Icons.close, size: 22, color: Colors.white),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              if (_distanceText.isNotEmpty)
                Text(
                  '$_distanceText${_durationText.isNotEmpty ? ' | $_durationText' : ''}',
                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Colors.white.withOpacity(0.85)),
                  textAlign: TextAlign.center,
                ),
              const SizedBox(height: 12),
              SizedBox(
                height: 88,
                child: SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: categories.map((cat) {
                      final selected = _selectedCategory == cat.id;
                      // Show estimated fare from cheapest child or single vehicle
                      final catFare = cat.singleVehicle != null
                          ? _safeFareForVehicle(cat.singleVehicle!)
                          : (cat.children.isNotEmpty ? _safeFareForVehicle(cat.children.first) : 0.0);
                      return Padding(
                        padding: const EdgeInsets.only(right: 10),
                        child: Material(
                          color: Colors.transparent,
                          borderRadius: BorderRadius.circular(12),
                          elevation: 0,
                          child: InkWell(
                            onTap: () {
                              _onCategorySelected(cat);
                            },
                            borderRadius: BorderRadius.circular(12),
                            child: Container(
                              width: 84,
                              decoration: BoxDecoration(
                                color: Colors.black.withOpacity(selected ? 0.45 : 0.30),
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(
                                  color: selected ? _kNeonOrange.withOpacity(0.85) : Colors.white.withOpacity(0.10),
                                  width: 1,
                                ),
                                boxShadow: selected
                                    ? [
                                        BoxShadow(
                                          color: _kNeonOrange.withOpacity(0.35),
                                          blurRadius: 16,
                                          spreadRadius: 0,
                                        ),
                                      ]
                                    : [
                                        BoxShadow(
                                          color: Colors.black.withOpacity(0.30),
                                          blurRadius: 14,
                                          offset: const Offset(0, 8),
                                        ),
                                      ],
                              ),
                              padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 6),
                              child: Column(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Text(cat.emoji, style: const TextStyle(fontSize: 24)),
                                  const SizedBox(height: 2),
                                  Text(
                                    cat.label,
                                    style: TextStyle(
                                      fontSize: 10,
                                      fontWeight: FontWeight.w600,
                                      color: selected ? _kNeonOrange : Colors.white,
                                    ),
                                    textAlign: TextAlign.center,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                  if (catFare > 0) ...[
                                    const SizedBox(height: 2),
                                    Text(
                                      'S/ ${catFare.toStringAsFixed(1)}',
                                      style: TextStyle(
                                        fontSize: 10,
                                        fontWeight: FontWeight.bold,
                                        color: selected ? Colors.greenAccent : Colors.green.shade300,
                                      ),
                                      maxLines: 1,
                                    ),
                                  ],
                                ],
                              ),
                            ),
                          ),
                        ),
                      );
                    }).toList(),
                  ),
                ),
              ),
              AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                height: hasSubVehicles ? 90 : 0,
                child: hasSubVehicles && selectedCat.children.isNotEmpty
                    ? SingleChildScrollView(
                        scrollDirection: Axis.horizontal,
                        child: Row(
                          children: selectedCat.children.map((v) {
                            final fare = _safeFareForVehicle(v);
                            final selected = _selectedVehicle == v;
                            return Padding(
                              padding: const EdgeInsets.only(right: 10),
                              child: Material(
                                color: selected ? _kNeonOrange.withOpacity(0.15) : Colors.white,
                                borderRadius: BorderRadius.circular(12),
                                elevation: selected ? 4 : 2,
                                child: InkWell(
                                  onTap: () => _onSubVehicleSelected(v),
                                  borderRadius: BorderRadius.circular(12),
                                  child: Container(
                                    width: 95,
                                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
                                    child: Column(
                                      mainAxisAlignment: MainAxisAlignment.center,
                                      children: [
                                        if (v == VehicleType.truck_hauler)
                                          Image.asset(
                                            'assets/truck.png',
                                            width: 34,
                                            height: 34,
                                            fit: BoxFit.contain,
                                            errorBuilder: (_, __, ___) => Text(v.emoji, style: const TextStyle(fontSize: 24)),
                                          )
                                        else
                                          Text(v.emoji, style: const TextStyle(fontSize: 24)),
                                        const SizedBox(height: 4),
                                        Text(
                                          v.label,
                                          style: TextStyle(
                                            fontSize: 10,
                                            fontWeight: FontWeight.w600,
                                            color: selected ? _kNeonOrange : Colors.black87,
                                          ),
                                          textAlign: TextAlign.center,
                                          maxLines: 2,
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                        Text(
                                          'S/ ${fare.toStringAsFixed(2)}',
                                          style: TextStyle(
                                            fontSize: 11,
                                            fontWeight: FontWeight.bold,
                                            color: Colors.green.shade700,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                              ),
                            );
                          }).toList(),
                        ),
                      )
                    : const SizedBox.shrink(),
              ),
              if (_selectedVehicle != null) ...[
                const SizedBox(height: 10),
                _glassSurface(
                  borderRadius: BorderRadius.circular(12),
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(_t('your_offer'), style: GoogleFonts.poppins(fontSize: 14, fontWeight: FontWeight.w700, color: Colors.white)),
                      const SizedBox(height: 8),
                      TextField(
                        controller: _bidPriceController,
                        keyboardType: const TextInputType.numberWithOptions(decimal: true),
                        style: GoogleFonts.poppins(fontSize: 14, color: Colors.white, fontWeight: FontWeight.w600),
                        decoration: InputDecoration(
                          hintText: 'S/ ${_estimatedPrice.toStringAsFixed(2)}',
                          hintStyle: TextStyle(color: Colors.white.withOpacity(0.55)),
                          prefixIcon: const Icon(Icons.payments_outlined, color: _kNeonOrange, size: 20),
                          filled: true,
                          fillColor: Colors.black.withOpacity(0.25),
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: Colors.white.withOpacity(0.12))),
                          enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: Colors.white.withOpacity(0.12))),
                          focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: _kNeonOrange.withOpacity(0.75))),
                          contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
                        ),
                        onChanged: (v) {
                          final p = double.tryParse(v.trim().replaceAll(',', '.'));
                          setState(() => _userBidPrice = (p != null && p > 0) ? p : null);
                        },
                      ),
                      const SizedBox(height: 6),
                      Text(
                        _t('drivers_will_bid'),
                        style: GoogleFonts.poppins(fontSize: 12, color: Colors.white.withOpacity(0.70)),
                      ),
                    ],
                  ),
                ),
                // --- Outstation options ---
                if (_selectedVehicle == VehicleType.taxi_outstation) ...[
                  const SizedBox(height: 12),
                  _glassSurface(
                    borderRadius: BorderRadius.circular(12),
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text('Outstation Details', style: GoogleFonts.poppins(fontSize: 14, fontWeight: FontWeight.w700, color: Colors.white)),
                        const SizedBox(height: 8),
                        Row(
                          children: [
                            const Icon(Icons.people, color: _kNeonOrange, size: 20),
                            const SizedBox(width: 8),
                            Text('Passengers:', style: GoogleFonts.poppins(fontSize: 13, color: Colors.white)),
                            const Spacer(),
                            IconButton(
                              onPressed: _outstationPassengers > 1 ? () => setState(() => _outstationPassengers--) : null,
                              icon: const Icon(Icons.remove_circle_outline, color: Colors.white, size: 22),
                              visualDensity: VisualDensity.compact,
                            ),
                            Text('$_outstationPassengers', style: GoogleFonts.poppins(fontSize: 16, fontWeight: FontWeight.w700, color: _kNeonOrange)),
                            IconButton(
                              onPressed: _outstationPassengers < 8 ? () => setState(() => _outstationPassengers++) : null,
                              icon: const Icon(Icons.add_circle_outline, color: Colors.white, size: 22),
                              visualDensity: VisualDensity.compact,
                            ),
                          ],
                        ),
                        const SizedBox(height: 4),
                        Row(
                          children: [
                            const Icon(Icons.attach_money, color: _kNeonOrange, size: 20),
                            const SizedBox(width: 8),
                            Expanded(child: Text('Fare: S/ ${(baseRatePerKm * VehicleType.taxi_outstation.multiplier).toStringAsFixed(2)} per km', style: GoogleFonts.poppins(fontSize: 13, color: Colors.white.withOpacity(0.85)))),
                          ],
                        ),
                        const SizedBox(height: 8),
                        TextField(
                          onChanged: (v) => _outstationComments = v,
                          style: GoogleFonts.poppins(fontSize: 13, color: Colors.white),
                          maxLines: 2,
                          decoration: InputDecoration(
                            hintText: 'Comments (optional)',
                            hintStyle: TextStyle(color: Colors.white.withOpacity(0.5)),
                            filled: true,
                            fillColor: Colors.black.withOpacity(0.25),
                            border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide.none),
                            contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                          ),
                        ),
                        const SizedBox(height: 8),
                        Row(
                          children: [
                            Checkbox(
                              value: _outstationIsParcel,
                              onChanged: (v) => setState(() => _outstationIsParcel = v ?? false),
                              activeColor: _kNeonOrange,
                              side: const BorderSide(color: Colors.white),
                            ),
                            Expanded(child: Text('Booking for sending parcel', style: GoogleFonts.poppins(fontSize: 13, color: Colors.white))),
                            const Icon(Icons.inventory_2_outlined, color: _kNeonOrange, size: 20),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
                // --- Delivery options ---
                if (_selectedVehicle == VehicleType.delivery) ...[
                  const SizedBox(height: 12),
                  _glassSurface(
                    borderRadius: BorderRadius.circular(12),
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text('Delivery Details', style: GoogleFonts.poppins(fontSize: 14, fontWeight: FontWeight.w700, color: Colors.white)),
                        const SizedBox(height: 8),
                        InkWell(
                          onTap: () async {
                            try {
                              final picker = ImagePicker();
                              final xFile = await picker.pickImage(source: ImageSource.gallery, maxWidth: 800, maxHeight: 800, imageQuality: 80);
                              if (xFile == null || !mounted) return;
                              setState(() => _deliveryPhotoPath = xFile.path.isNotEmpty ? xFile.path : 'picked');
                              if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(_t('photo_added')), backgroundColor: Colors.green));
                            } catch (_) {}
                          },
                          child: Container(
                            padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 12),
                            decoration: BoxDecoration(
                              color: Colors.black.withOpacity(0.25),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Row(
                              children: [
                                Icon(_deliveryPhotoPath != null ? Icons.check_circle : Icons.camera_alt, color: _deliveryPhotoPath != null ? Colors.green : _kNeonOrange, size: 22),
                                const SizedBox(width: 10),
                                Text(_deliveryPhotoPath != null ? 'Photo added' : 'Add photo (optional)', style: GoogleFonts.poppins(fontSize: 13, color: Colors.white)),
                              ],
                            ),
                          ),
                        ),
                        const SizedBox(height: 8),
                        TextField(
                          onChanged: (v) => _deliveryComments = v,
                          style: GoogleFonts.poppins(fontSize: 13, color: Colors.white),
                          maxLines: 2,
                          decoration: InputDecoration(
                            hintText: 'Comments (optional)',
                            hintStyle: TextStyle(color: Colors.white.withOpacity(0.5)),
                            filled: true,
                            fillColor: Colors.black.withOpacity(0.25),
                            border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide.none),
                            contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                          ),
                        ),
                        const SizedBox(height: 8),
                        TextField(
                          onChanged: (v) => _deliveryWeight = v,
                          style: GoogleFonts.poppins(fontSize: 13, color: Colors.white),
                          keyboardType: TextInputType.number,
                          decoration: InputDecoration(
                            hintText: 'Weight in kg (optional)',
                            hintStyle: TextStyle(color: Colors.white.withOpacity(0.5)),
                            filled: true,
                            fillColor: Colors.black.withOpacity(0.25),
                            border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide.none),
                            contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                            suffixText: 'kg',
                            suffixStyle: GoogleFonts.poppins(fontSize: 13, color: Colors.white.withOpacity(0.7)),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
                // --- Freight helper toggle ---
                if (isFreightVehicle(_selectedVehicle!) && _selectedVehicle != VehicleType.delivery) ...[
                  const SizedBox(height: 12),
                  _glassSurface(
                    borderRadius: BorderRadius.circular(12),
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    child: Row(
                      children: [
                        const Icon(Icons.handyman_outlined, color: _kNeonOrange, size: 24),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text('Helper (carga/descarga)', style: GoogleFonts.poppins(fontSize: 14, fontWeight: FontWeight.w600, color: Colors.white)),
                              Text('+ S/ ${helperFeeSoles.toStringAsFixed(0)}', style: GoogleFonts.poppins(fontSize: 12, color: Colors.white.withOpacity(0.70))),
                            ],
                          ),
                        ),
                        Switch(
                          value: _needHelper,
                          onChanged: (v) => setState(() => _needHelper = v),
                          activeThumbColor: _kNeonOrange,
                        ),
                      ],
                    ),
                  ),
                ],
                const SizedBox(height: 12),
                _glassPrimaryButton(
                  onTap: _openBiddingSheet,
                  child: Text(
                    '${_t('find')} ${_selectedVehicle!.label} - S/ ${((_userBidPrice ?? _estimatedPrice)).toStringAsFixed(2)}',
                    style: GoogleFonts.poppins(fontSize: 16, fontWeight: FontWeight.w600, color: Colors.white),
                    textAlign: TextAlign.center,
                  ),
                ),
              ],
          ],
        ),
          ),
      ),
        ),
    );
    } catch (e) {
      return const SizedBox.shrink();
    }
  }

  _VehicleCategory? get _selectedCategoryData {
    if (_selectedCategory == null || _selectedCategory!.isEmpty) return null;
    try {
      for (final c in _vehicleCategories) {
        if (c.id == _selectedCategory) return c;
      }
    } catch (_) {
    }
    return null;
  }

  /// Safe fare for UI; returns 0.0 on any error to avoid crash.
  double _safeFareForVehicle(VehicleType v) {
    try {
      final km = _distanceKm.isNaN || _distanceKm < 0 ? 0.0 : _distanceKm;
      final delay = _trafficDelayMins.isNaN || _trafficDelayMins < 0 ? 0 : _trafficDelayMins;
      return calculateFare(distanceKm: km, trafficDelayMins: delay, vehicle: v);
    } catch (_) {
      return 0.0;
    }
  }

  Widget _buildServiceSelectionOverlay(Size size) {
    const boxSize = 64.0;
    const emojiSize = 24.0;
    const fontSize = 11.0;
    return Positioned(
      left: 0,
      right: 0,
      bottom: 0,
      child: _glassSurface(
        borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
        padding: const EdgeInsets.fromLTRB(12, 12, 12, 16),
        child: SafeArea(
          top: false,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                _t('select_service'),
                style: GoogleFonts.poppins(fontSize: 14, fontWeight: FontWeight.w700, color: Colors.white),
              ),
              const SizedBox(height: 10),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                alignment: WrapAlignment.center,
                children: [
                  ..._vehicleCategories.map((cat) {
                    return SizedBox(
                      width: boxSize,
                      child: _glassSurface(
                        borderRadius: BorderRadius.circular(12),
                        padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 6),
                        child: InkWell(
                          onTap: () => _onCategorySelected(cat),
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(cat.emoji, style: const TextStyle(fontSize: emojiSize)),
                              const SizedBox(height: 4),
                              Text(cat.label, style: GoogleFonts.poppins(fontSize: fontSize, fontWeight: FontWeight.w600, color: Colors.white), textAlign: TextAlign.center, maxLines: 1, overflow: TextOverflow.ellipsis),
                            ],
                          ),
                        ),
                      ),
                    );
                  }),
                  SizedBox(
                    width: boxSize,
                    child: _glassSurface(
                      borderRadius: BorderRadius.circular(12),
                      padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 6),
                      child: InkWell(
                        onTap: _onTourTapped,
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Text('🎯', style: TextStyle(fontSize: emojiSize)),
                            const SizedBox(height: 4),
                            Text(_t('attraction'), style: GoogleFonts.poppins(fontSize: fontSize, fontWeight: FontWeight.w600, color: Colors.white), textAlign: TextAlign.center, maxLines: 1, overflow: TextOverflow.ellipsis),
                          ],
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildHalfScreenSearchPanel(Size size, double height) {
    return Positioned(
      left: 0,
      right: 0,
      bottom: 0,
      height: height,
      child: _glassSurface(
        borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
        child: SafeArea(
          top: false,
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (_selectedCategory != null && _selectedCategory!.isNotEmpty) ...[
                  Row(
                    children: [
                      GestureDetector(
                        onTap: () => setState(() {
                          _selectedCategory = null;
                          _selectedVehicle = null;
                        }),
                        child: const Icon(Icons.arrow_back, size: 24, color: Colors.white),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(_selectedCategoryData?.label ?? '', style: GoogleFonts.poppins(fontSize: 16, fontWeight: FontWeight.w700, color: Colors.white)),
                      ),
                      GestureDetector(
                        onTap: () => setState(() {
                          _selectedCategory = null;
                          _selectedVehicle = null;
                        }),
                        child: Text(_t('cancel'), style: GoogleFonts.poppins(fontSize: 14, color: _kNeonOrange, fontWeight: FontWeight.w600)),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                ],
                TextField(
                  controller: _pickupController,
                  onTap: () => setState(() => _pickupFieldActive = true),
                  onChanged: (v) => _searchLocation(v, true),
                  style: GoogleFonts.poppins(fontSize: 13, color: Colors.white),
                  decoration: InputDecoration(
                    hintText: _t('origen'),
                    hintStyle: TextStyle(color: Colors.white.withOpacity(0.55)),
                    prefixIcon: Icon(Icons.location_on, color: Colors.greenAccent.shade200, size: 20),
                    suffixIcon: _pickupController.text.trim().isNotEmpty ? IconButton(icon: const Icon(Icons.close, size: 18, color: Colors.white), onPressed: () => _clearPickup()) : null,
                    filled: true,
                    fillColor: Colors.black.withOpacity(0.25),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: Colors.white.withOpacity(0.12))),
                    enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: Colors.white.withOpacity(0.12))),
                    focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: _kNeonOrange.withOpacity(0.75))),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
                  ),
                ),
                const SizedBox(height: 4),
                InkWell(
                  onTap: _pickupCurrentLocationLoading ? null : _setPickupToCurrentLocation,
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 4),
                    child: Row(
                      children: [
                        Icon(Icons.my_location, size: 18, color: _pickupCurrentLocationLoading ? Colors.white.withOpacity(0.35) : _kNeonOrange),
                        const SizedBox(width: 8),
                        Text(_t('your_current_location'), style: GoogleFonts.poppins(fontSize: 12, fontWeight: FontWeight.w600, color: _pickupCurrentLocationLoading ? Colors.white.withOpacity(0.35) : _kNeonOrange)),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: _dropController,
                  onTap: () => setState(() => _pickupFieldActive = false),
                  onChanged: (v) => _searchLocation(v, false),
                  style: GoogleFonts.poppins(fontSize: 13, color: Colors.white),
                  decoration: InputDecoration(
                    hintText: _t('destino'),
                    hintStyle: TextStyle(color: Colors.white.withOpacity(0.55)),
                    prefixIcon: const Icon(Icons.flag, color: Colors.redAccent, size: 20),
                    suffixIcon: _dropController.text.trim().isNotEmpty ? IconButton(icon: const Icon(Icons.close, size: 18, color: Colors.white), onPressed: () => _clearDrop()) : null,
                    filled: true,
                    fillColor: Colors.black.withOpacity(0.25),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: Colors.white.withOpacity(0.12))),
                    enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: Colors.white.withOpacity(0.12))),
                    focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: _kNeonOrange.withOpacity(0.75))),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
                  ),
                ),
                const SizedBox(height: 4),
                if (_activePredictions.isNotEmpty)
                  ConstrainedBox(
                    constraints: const BoxConstraints(maxHeight: 180),
                    child: ListView.builder(
                      shrinkWrap: true,
                      padding: EdgeInsets.zero,
                      itemCount: _activePredictions.length,
                      itemBuilder: (ctx, i) {
                        final p = _activePredictions[i];
                        final desc = p['description'] as String? ?? '';
                        return Material(
                          color: Colors.transparent,
                          child: InkWell(
                            onTap: () => _onPlaceSelected(p, _pickupFieldActive),
                            child: Padding(
                              padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
                              child: Row(
                                children: [
                                  Icon(Icons.location_on_outlined, size: 18, color: Colors.white.withOpacity(0.7)),
                                  const SizedBox(width: 8),
                                  Expanded(
                                    child: Text(
                                      desc,
                                      style: GoogleFonts.poppins(fontSize: 13, color: Colors.white),
                                      maxLines: 2,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        );
                      },
                    ),
                  ),
                if (_activePredictions.isEmpty) ...[
                  const SizedBox(height: 4),
                  InkWell(
                    onTap: _startMapTapForDestination,
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 6),
                      child: Row(
                        children: [
                          const Icon(Icons.map_outlined, size: 18, color: _kNeonOrange),
                          const SizedBox(width: 8),
                          Text(_t('tap_on_map_to_set_destination'), style: GoogleFonts.poppins(fontSize: 12, fontWeight: FontWeight.w600, color: _kNeonOrange)),
                        ],
                      ),
                    ),
                  ),
                ],
                const SizedBox(height: 8),
                _glassPrimaryButton(
                  height: 48,
                  onTap: _isLoadingRoute ? null : () async {
                    if (_dropController.text.trim().isEmpty && _dropDescription.isEmpty) {
                      if (!mounted) return;
                      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(_t('enter_destination')), backgroundColor: Colors.orange));
                      return;
                    }
                    if (_drop == null) {
                      if (!mounted) return;
                      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(_t('select_destination_first')), backgroundColor: Colors.orange));
                      return;
                    }
                    try {
                      await _fetchAndDrawRoute();
                      if (!mounted) return;
                      setState(() {
                        _selectedVehicle = null;
                        _selectedCategory = null;
                      });
                    } catch (e) {
                      if (!mounted) return;
                      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(_t('route_error')), backgroundColor: Colors.red));
                    }
                  },
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      _isLoadingRoute
                          ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, valueColor: AlwaysStoppedAnimation<Color>(Colors.white)))
                          : const Icon(Icons.search, size: 22, color: Colors.white),
                      const SizedBox(width: 10),
                      Text(_t('buscar_vehiculo'), style: GoogleFonts.poppins(fontSize: 16, fontWeight: FontWeight.w700, color: Colors.white)),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  void _clearPickup() {
    setState(() {
      _pickupController.clear();
      _pickupPredictions = [];
      _pickup = null;
      _pickupDescription = '';
      _updateMarkers();
      _polylines = {};
      _distanceText = '';
      _durationText = '';
      _distanceKm = 0.0;
      _trafficDelayMins = 0;
      _estimatedPrice = 0.0;
      _needHelper = false;
    });
  }

  void _clearDrop() {
    setState(() {
      _dropController.clear();
      _dropPredictions = [];
      _drop = null;
      _dropDescription = '';
      _updateMarkers();
      _polylines = {};
      _distanceText = '';
      _durationText = '';
      _distanceKm = 0.0;
      _trafficDelayMins = 0;
      _estimatedPrice = 0.0;
      _needHelper = false;
    });
  }

  Widget _glassSurface({
    required Widget child,
    BorderRadius borderRadius = const BorderRadius.all(Radius.circular(16)),
    EdgeInsetsGeometry? padding,
  }) {
    return ClipRRect(
      borderRadius: borderRadius,
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
        child: Container(
          padding: padding,
          decoration: BoxDecoration(
            color: Colors.black.withOpacity(0.40),
            borderRadius: borderRadius,
            border: Border.all(color: Colors.white.withOpacity(0.10), width: 1),
            boxShadow: [
              BoxShadow(
                color: _kNeonOrange.withOpacity(0.18),
                blurRadius: 18,
                spreadRadius: 0,
                offset: const Offset(0, 8),
              ),
            ],
          ),
          child: child,
        ),
      ),
    );
  }

  Widget _glassPrimaryButton({
    required VoidCallback? onTap,
    required Widget child,
    double height = 52,
    BorderRadius borderRadius = const BorderRadius.all(Radius.circular(14)),
  }) {
    final enabled = onTap != null;
    return SizedBox(
      width: double.infinity,
      height: height,
      child: Opacity(
        opacity: enabled ? 1 : 0.55,
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: onTap,
            borderRadius: borderRadius,
            child: Ink(
              decoration: BoxDecoration(
                borderRadius: borderRadius,
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [
                    _kNeonOrange.withOpacity(0.95),
                    const Color(0xFFFF8A3D).withOpacity(0.85),
                    _kNeonOrange.withOpacity(0.80),
                  ],
                ),
                border: Border.all(color: Colors.white.withOpacity(0.10), width: 1),
                boxShadow: [
                  BoxShadow(
                    color: _kNeonOrange.withOpacity(0.35),
                    blurRadius: 20,
                    spreadRadius: 0,
                    offset: const Offset(0, 10),
                  ),
                ],
              ),
              child: Center(child: child),
            ),
          ),
        ),
      ),
    );
  }

  Future<bool> _checkProfileComplete() async {
    final name = await ProfileStorageService.getName();
    final email = await ProfileStorageService.getEmail();
    final phone = await ProfileStorageService.getPhone();
    final nameOk = name != null && name.trim().isNotEmpty;
    final emailOk = email != null && email.trim().isNotEmpty;
    final phoneOk = phone != null && phone.trim().isNotEmpty;
    if (nameOk && emailOk && phoneOk) return true;
    if (!mounted) return false;
    final missing = <String>[];
    if (!nameOk) missing.add('Name');
    if (!emailOk) missing.add('Email');
    if (!phoneOk) missing.add('Phone');
    final go = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text(_t('profile_incomplete_title'), style: GoogleFonts.poppins(fontWeight: FontWeight.w700)),
        content: Text(
          '${_t('profile_incomplete_msg')}\n\nMissing: ${missing.join(', ')}',
          style: GoogleFonts.poppins(fontSize: 14),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: Text(_t('cancel'))),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: FilledButton.styleFrom(backgroundColor: _kNeonOrange),
            child: Text(_t('go_to_profile')),
          ),
        ],
      ),
    );
    if (go == true && mounted) {
      Navigator.of(context, rootNavigator: true).push(MaterialPageRoute(builder: (_) => const ProfileScreen()));
    }
    return false;
  }

  Future<void> _openBiddingSheet() async {
    if (_selectedVehicle == null || _pickup == null || _drop == null) return;
    final profileOk = await _checkProfileComplete();
    if (!profileOk) return;
    final parsedBid = double.tryParse(_bidPriceController.text.trim().replaceAll(',', '.'));
    final userPrice = (parsedBid != null && parsedBid > 0) ? parsedBid : _estimatedPrice;

    // Show waiting overlay before opening bidding sheet.
    setState(() {
      _isSearching = true;
      _driverCounterPrice = null;
      _searchingVehicleLabel = _selectedVehicle?.label;
    });

    // Track when overlay started so we can keep it visible for a minimum duration.
    final overlayStart = DateTime.now();

    final rideId = await _biddingService.createRide(
      pickupLat: _pickup!.latitude,
      pickupLng: _pickup!.longitude,
      dropLat: _drop!.latitude,
      dropLng: _drop!.longitude,
      pickupAddress: _pickupDescription.isEmpty ? _t('origen') : _pickupDescription,
      dropAddress: _dropDescription.isEmpty ? _t('destino') : _dropDescription,
      distanceKm: _distanceKm,
      trafficDelayMins: _trafficDelayMins,
      vehicleType: _selectedVehicle!.name,
      userPrice: userPrice,
      userRating: 4.5,
      outstationPassengers: _selectedVehicle == VehicleType.taxi_outstation ? _outstationPassengers : null,
      outstationComments: _selectedVehicle == VehicleType.taxi_outstation ? _outstationComments : null,
      outstationIsParcel: _selectedVehicle == VehicleType.taxi_outstation ? _outstationIsParcel : null,
      deliveryComments: _selectedVehicle == VehicleType.delivery ? _deliveryComments : null,
      deliveryWeight: _selectedVehicle == VehicleType.delivery ? _deliveryWeight : null,
      deliveryPhotoUrl: _selectedVehicle == VehicleType.delivery ? _deliveryPhotoPath : null,
    );
    if (!mounted) return;
    if (rideId == null || rideId.isEmpty) {
      setState(() {
        _isSearching = false;
        _searchingVehicleLabel = null;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(_t('request_create_failed'), style: GoogleFonts.poppins(fontSize: 14)),
          backgroundColor: Colors.orange,
        ),
      );
      return;
    }

    // Keep overlay visible for at least 4 seconds so user sees "Please wait finding your <vehicle>"
    final elapsed = DateTime.now().difference(overlayStart);
    final remaining = const Duration(seconds: 4) - elapsed;
    if (remaining > Duration.zero) {
      await Future.delayed(remaining);
    }
    if (!mounted) return;

    setState(() {
      _isSearching = false;
      _searchingVehicleLabel = null;
    });

    bool sheetHandled = false;
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (ctx) => DraggableScrollableSheet(
        initialChildSize: 0.6,
        minChildSize: 0.4,
        maxChildSize: 0.9,
        builder: (context, scrollController) => _LiveBiddingSheetContent(
          rideId: rideId,
          estimatedFare: _estimatedPrice,
          vehicleType: _selectedVehicle!,
          biddingService: _biddingService,
          scrollController: scrollController,
          onAccept: (driverName) {
            if (sheetHandled) return;
            sheetHandled = true;
            try { Navigator.of(ctx).pop(); } catch (_) {}
            _startDriverLocationPolling(rideId);
            setState(() => _isSearching = false);
            if (!mounted) return;
            _showDriverThankYouDialog(driverName);
          },
          onCancel: () {
            if (sheetHandled) return;
            sheetHandled = true;
            Navigator.of(ctx).pop();
          },
        ),
      ),
    );
  }

  /// User taps a parent vehicle category (Taxi, Truck, Bike, Delivery, Ambulance).
  void _onCategorySelected(_VehicleCategory cat) {
    setState(() {
      _selectedCategory = cat.id;
      _selectedVehicle = null;
      // If category has no children (single vehicle like Moto/Delivery), auto-select it
      if (cat.children.isEmpty && cat.singleVehicle != null) {
        _selectedVehicle = cat.singleVehicle;
        _estimatedPrice = _safeFareForVehicle(cat.singleVehicle!);
        _userBidPrice = _estimatedPrice;
      }
    });
    if (cat.children.isEmpty && cat.singleVehicle != null) {
      _bidPriceController.text = _estimatedPrice.toStringAsFixed(2);
    }
  }

  /// User taps a sub-vehicle (e.g. Taxi Std, Taxi SUV, Truck S, etc.)
  void _onSubVehicleSelected(VehicleType v) {
    setState(() {
      _selectedVehicle = v;
      _estimatedPrice = _safeFareForVehicle(v);
      _userBidPrice = _estimatedPrice;
    });
    _bidPriceController.text = _estimatedPrice.toStringAsFixed(2);
    _updateMarkers();
  }

  /// Clear route, polylines, distance, and reset vehicle selection
  void _clearRoute() {
    setState(() {
      _polylines = {};
      _distanceText = '';
      _durationText = '';
      _distanceKm = 0.0;
      _trafficDelayMins = 0;
      _estimatedPrice = 0.0;
      _userBidPrice = null;
      _selectedVehicle = null;
      _selectedCategory = null;
      _needHelper = false;
    });
    _bidPriceController.clear();
  }

  /// Navigate to tours/attractions screen
  void _onTourTapped() {
    Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => const ToursListScreen()),
    );
  }

  @override
  void dispose() {
    _driverLocationPollTimer?.cancel();
    _driverLocationPollTimer = null;
    _driverLocationSubscription?.cancel();
    _pickupController.dispose();
    _dropController.dispose();
    _messageController.dispose();
    _bidPriceController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.of(context).size;
    final searchPanelHeight = size.height * 0.5;
    final hasRouteDrawn = _distanceText.isNotEmpty;
    final showSearchPanel = !hasRouteDrawn && (_selectedCategory != null && _selectedCategory!.isNotEmpty);

    return Scaffold(
      key: _scaffoldKey,
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        toolbarHeight: 48,
        titleSpacing: 0,
        backgroundColor: Colors.transparent,
        elevation: 0,
        scrolledUnderElevation: 0,
        iconTheme: const IconThemeData(color: Colors.black87),
        title: Image.asset('assets/Both App logo.png', height: 32, fit: BoxFit.contain, errorBuilder: (_, __, ___) => Text('TB', style: GoogleFonts.poppins(fontSize: 22, fontWeight: FontWeight.w800, color: _kNeonOrange))),
        leading: IconButton(
          style: IconButton.styleFrom(backgroundColor: Colors.transparent),
          icon: const Icon(Icons.menu, color: Colors.black87, size: 24),
          onPressed: () => _scaffoldKey.currentState?.openDrawer(),
          tooltip: 'Menu',
        ),
      ),
      drawer: _UserMenuDrawer(onLanguageTap: _showLanguageSelector),
      body: SafeArea(
        top: false,
        child: Stack(
          fit: StackFit.expand,
          children: [
            SizedBox.expand(
              child: GoogleMap(
                key: const ValueKey<String>('home_map'),
                initialCameraPosition: _initialCamera,
                onMapCreated: (GoogleMapController c) {
                  if (_isMapCreated) return;
                  Future.delayed(const Duration(milliseconds: 300), () async {
                    if (!mounted || _isMapCreated) return;
                    try {
                      _mapController = c;
                      if (!_mapCompleter.isCompleted) _mapCompleter.complete(c);
                      _isMapCreated = true;
                      if (_userLocation == null) await _fetchUserLocation();
                      _updateMarkers();
                    } catch (_) {}
                  });
                },
                onTap: _waitingForMapTapDestination ? _onMapTappedForDestination : null,
                myLocationEnabled: false,
                myLocationButtonEnabled: false,
                zoomControlsEnabled: false,
                compassEnabled: false,
                mapToolbarEnabled: false,
                mapType: MapType.normal,
                markers: _markers,
                polylines: _polylines,
              ),
            ),
            if (_showLocationPrompt)
              Positioned(
                top: 56,
                left: 16,
                right: 16,
                child: _glassSurface(
                  borderRadius: BorderRadius.circular(12),
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                  child: Row(
                    children: [
                      const Icon(Icons.location_on, color: _kNeonOrange, size: 32),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              _t('allow_location_title'),
                              style: GoogleFonts.poppins(fontSize: 15, fontWeight: FontWeight.w700, color: Colors.white),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              _t('allow_location_message'),
                              style: GoogleFonts.poppins(fontSize: 13, color: Colors.white.withOpacity(0.70)),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 8),
                      SizedBox(
                        width: 140,
                        child: _glassPrimaryButton(
                          height: 42,
                          borderRadius: BorderRadius.circular(12),
                          onTap: _locationRequestInProgress ? null : _onAllowLocationTap,
                          child: _locationRequestInProgress
                              ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                              : Text(_t('allow_location_button'), style: GoogleFonts.poppins(fontWeight: FontWeight.w600, color: Colors.white), textAlign: TextAlign.center),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            if (_nearbyDriversCount != null && _nearbyDriversCount! > 0)
              Positioned(
                top: MediaQuery.of(context).padding.top + 52,
                left: 16,
                right: 16,
                child: _glassSurface(
                  borderRadius: BorderRadius.circular(12),
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  child: Row(
                    children: [
                      const Icon(Icons.local_taxi, color: _kNeonOrange, size: 28),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          _nearbyDriversCount! == 1
                              ? '1 taxi available within 3–5 km for booking'
                              : '$_nearbyDriversCount taxis available within 3–5 km for booking',
                          style: GoogleFonts.poppins(fontSize: 14, fontWeight: FontWeight.w600, color: Colors.white),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            if (_currentRideOtp != null && _currentRideOtp!.isNotEmpty)
              Positioned(
                top: MediaQuery.of(context).padding.top + 16,
                left: 16,
                right: 16,
                child: _glassSurface(
                  borderRadius: BorderRadius.circular(12),
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Row(
                        children: [
                          const Icon(Icons.lock, color: _kNeonOrange, size: 28),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Text(_t('tu_otp'), style: GoogleFonts.poppins(fontSize: 12, color: Colors.white.withOpacity(0.70))),
                                Text(_currentRideOtp!, style: GoogleFonts.poppins(fontSize: 24, fontWeight: FontWeight.w700, color: _kNeonOrange, letterSpacing: 4)),
                              ],
                            ),
                          ),
                          IconButton(
                            onPressed: _openChatSheet,
                            icon: const Icon(Icons.chat_bubble_outline, color: _kNeonOrange),
                            tooltip: _t('chat'),
                          ),
                          IconButton(
                            onPressed: _onCallDriver,
                            icon: const Icon(Icons.call, color: _kNeonOrange),
                            tooltip: _t('call'),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            if (!_waitingForMapTapDestination)
              showSearchPanel
                  ? _buildHalfScreenSearchPanel(size, searchPanelHeight)
                  : (hasRouteDrawn ? _buildVehicleSelector() : _buildServiceSelectionOverlay(size)),
            if (_waitingForMapTapDestination)
              Positioned(
                top: 12,
                left: 16,
                right: 16,
                child: Material(
                  elevation: 8,
                  borderRadius: BorderRadius.circular(12),
                  color: Colors.white,
                  child: InkWell(
                    onTap: () => setState(() => _waitingForMapTapDestination = false),
                    borderRadius: BorderRadius.circular(12),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                      child: Row(
                        children: [
                          const Icon(Icons.search, color: _kNeonOrange, size: 26),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Text(
                              _t('back_to_search'),
                              style: GoogleFonts.poppins(fontSize: 15, fontWeight: FontWeight.w600, color: Colors.black87),
                            ),
                          ),
                          Icon(Icons.arrow_forward_ios, size: 16, color: Colors.grey.shade600),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
          if (_isSearching) _SearchingOverlay(
            counterPrice: _driverCounterPrice,
            vehicleLabel: _searchingVehicleLabel,
            onCancel: () => setState(() { _isSearching = false; _driverCounterPrice = null; }),
            onDriverAccepted: (driverName) {
              setState(() { _isSearching = false; _driverCounterPrice = null; });
              if (!mounted) return;
              if (_currentRideId != null && _currentRideId!.isNotEmpty) {
                _startDriverLocationPolling(_currentRideId!);
              }
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text('¡El conductor $driverName ha aceptado tu oferta!', style: GoogleFonts.poppins(fontWeight: FontWeight.w600)),
                  backgroundColor: Colors.green,
                  duration: const Duration(seconds: 4),
                ),
              );
            },
            onDriverCounterBid: (price) => setState(() => _driverCounterPrice = price),
            onAcceptCounter: (price) {
              setState(() { _isSearching = false; _driverCounterPrice = null; });
              if (!mounted) return;
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(content: Text(_t('counter_accepted_msg', {'price': price.toStringAsFixed(2)}), style: GoogleFonts.poppins(fontWeight: FontWeight.w600)), backgroundColor: Colors.green),
              );
            },
            onRejectCounter: () => setState(() => _driverCounterPrice = null),
          ),
          ],
        ),
      ),
    );
  }
}

/// User app drawer: Profile, Wallet, History, Support, Logout.
class _UserMenuDrawer extends StatelessWidget {
  const _UserMenuDrawer({this.onLanguageTap});

  final VoidCallback? onLanguageTap;

  String _t(BuildContext context, String key) {
    return AppLocaleScope.of(context)?.t(key) ?? key;
  }

  @override
  Widget build(BuildContext context) {
    return Drawer(
      backgroundColor: Colors.white,
      child: SafeArea(
        child: ListView(
          padding: EdgeInsets.zero,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(24, 24, 24, 16),
              child: Image.asset('assets/Both App logo.png', height: 40, fit: BoxFit.contain, errorBuilder: (_, __, ___) => Text('TB', style: GoogleFonts.poppins(fontSize: 28, fontWeight: FontWeight.w800, color: _kNeonOrange))),
            ),
            const Divider(height: 1),
            ListTile(
              leading: const Icon(Icons.person_outline, color: _kNeonOrange),
              title: Text(_t(context, 'drawer_profile'), style: GoogleFonts.poppins(fontSize: 15, fontWeight: FontWeight.w600)),
              onTap: () {
                Navigator.of(context, rootNavigator: true).push(MaterialPageRoute(builder: (_) => const ProfileScreen()));
              },
            ),
            ListTile(
              leading: const Icon(Icons.history, color: Colors.black87),
              title: Text(_t(context, 'drawer_history'), style: GoogleFonts.poppins(fontSize: 15)),
              onTap: () {
                Navigator.of(context, rootNavigator: true).push(MaterialPageRoute(builder: (_) => const HistoryScreen()));
              },
            ),
            ListTile(
              leading: const Icon(Icons.support_agent_outlined, color: Colors.black87),
              title: Text(_t(context, 'drawer_support'), style: GoogleFonts.poppins(fontSize: 15)),
              onTap: () {
                Navigator.of(context, rootNavigator: true).push(MaterialPageRoute(builder: (_) => const SupportScreen()));
              },
            ),
            ListTile(
              leading: const Icon(Icons.translate, color: _kNeonOrange),
              title: Text(_t(context, 'profile_language'), style: GoogleFonts.poppins(fontSize: 15, fontWeight: FontWeight.w600)),
              subtitle: Text(AppLocaleScope.of(context)?.locale.languageCode.toUpperCase() ?? 'ES', style: GoogleFonts.poppins(fontSize: 12, color: Colors.grey.shade600)),
              onTap: () {
                Navigator.pop(context);
                onLanguageTap?.call();
              },
            ),
            const Divider(height: 1),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    'Join Us',
                    style: GoogleFonts.poppins(fontSize: 16, fontWeight: FontWeight.w700, color: Colors.black87),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Want to earn with us? Join as a Driver or register your Travel Agency.',
                    style: GoogleFonts.poppins(fontSize: 12, color: Colors.grey.shade600),
                  ),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: () async {
                            Navigator.pop(context);
                            final uri = Uri.parse('tbidder-driver://open');
                            try {
                              if (await canLaunchUrl(uri)) {
                                await launchUrl(uri, mode: LaunchMode.externalApplication);
                              } else {
                                if (context.mounted) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    const SnackBar(content: Text('Install the Driver app from Play Store'), backgroundColor: _kNeonOrange),
                                  );
                                }
                              }
                            } catch (_) {}
                          },
                          icon: const Icon(Icons.directions_car, size: 18),
                          label: Text('Driver', style: GoogleFonts.poppins(fontSize: 13, fontWeight: FontWeight.w600)),
                          style: OutlinedButton.styleFrom(
                            foregroundColor: _kNeonOrange,
                            side: const BorderSide(color: _kNeonOrange),
                            padding: const EdgeInsets.symmetric(vertical: 10),
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: () async {
                            Navigator.pop(context);
                            final uri = Uri.parse('https://www.transportbidder.com');
                            try {
                              if (await canLaunchUrl(uri)) {
                                await launchUrl(uri, mode: LaunchMode.externalApplication);
                              } else {
                                if (context.mounted) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    const SnackBar(content: Text('Visit www.transportbidder.com to apply'), backgroundColor: _kNeonOrange),
                                  );
                                }
                              }
                            } catch (_) {}
                          },
                          icon: const Icon(Icons.business, size: 18),
                          label: Text('Agency', style: GoogleFonts.poppins(fontSize: 13, fontWeight: FontWeight.w600)),
                          style: OutlinedButton.styleFrom(
                            foregroundColor: Colors.blueGrey,
                            side: const BorderSide(color: Colors.blueGrey),
                            padding: const EdgeInsets.symmetric(vertical: 10),
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const Divider(height: 1),
            ListTile(
              leading: const Icon(Icons.logout, color: Colors.red),
              title: Text(_t(context, 'drawer_logout'), style: GoogleFonts.poppins(fontSize: 15, color: Colors.red)),
              onTap: () async {
                final nav = Navigator.of(context);
                nav.pop();
                await ProfileStorageService.clear();
                nav.pushAndRemoveUntil(
                  MaterialPageRoute(builder: (_) => const LoginScreen()),
                  (r) => false,
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}

/// Chat sheet: messages list + send (only while ride not completed).
class _ChatSheet extends StatefulWidget {
  const _ChatSheet({
    required this.rideId,
    required this.initialMessages,
    required this.biddingService,
    required this.onMessagesUpdated,
  });

  final String rideId;
  final List<Map<String, dynamic>> initialMessages;
  final BiddingService biddingService;
  final VoidCallback onMessagesUpdated;

  @override
  State<_ChatSheet> createState() => _ChatSheetState();
}

class _ChatSheetState extends State<_ChatSheet> {
  late List<Map<String, dynamic>> _messages;
  final TextEditingController _textController = TextEditingController();
  final ScrollController _scrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    _messages = List.from(widget.initialMessages);
  }

  @override
  void dispose() {
    _textController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final text = _textController.text.trim();
    if (text.isEmpty) return;
    _textController.clear();
    final ok = await widget.biddingService.sendChatMessage(widget.rideId, text);
    if (!mounted) return;
    if (ok) {
      widget.onMessagesUpdated();
      final ride = await widget.biddingService.getRide(widget.rideId);
      if (!mounted) return;
      final msgs = ride?['messages'] as List<dynamic>?;
      if (msgs != null) setState(() => _messages = msgs.map((e) => Map<String, dynamic>.from(e as Map)).toList());
      _scrollToBottom();
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(AppLocaleScope.of(context)?.t('could_not_send') ?? translate('could_not_send', defaultLocale)),
          backgroundColor: Colors.orange,
        ),
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
                Text(t('chat'), style: GoogleFonts.poppins(fontSize: 18, fontWeight: FontWeight.w700)),
                const Spacer(),
                IconButton(onPressed: () => Navigator.pop(context), icon: const Icon(Icons.close)),
              ],
            ),
          ),
          ConstrainedBox(
            constraints: BoxConstraints(maxHeight: MediaQuery.of(context).size.height * 0.45),
            child: ListView.builder(
              controller: _scrollController,
              shrinkWrap: true,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              itemCount: _messages.length,
              itemBuilder: (context, i) {
                final m = _messages[i];
                final from = m['from'] as String? ?? '';
                final text = m['text'] as String? ?? '';
                final at = m['at'] as String?;
                final isUser = from == 'user';
                return Align(
                  alignment: isUser ? Alignment.centerRight : Alignment.centerLeft,
                  child: Container(
                    margin: const EdgeInsets.only(bottom: 8),
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    decoration: BoxDecoration(
                      color: isUser ? _kNeonOrange.withValues(alpha: 0.2) : Colors.grey.shade200,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(text, style: GoogleFonts.poppins(fontSize: 14)),
                        Text(_formatAt(at), style: GoogleFonts.poppins(fontSize: 10, color: Colors.grey.shade600)),
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
                    decoration: InputDecoration(
                      hintText: 'Message',
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
                  style: IconButton.styleFrom(backgroundColor: _kNeonOrange),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Live Bidding List: real driver bids from API (polling), bid cards, counter-offer.
class _LiveBiddingSheetContent extends StatefulWidget {
  const _LiveBiddingSheetContent({
    required this.rideId,
    required this.estimatedFare,
    required this.vehicleType,
    required this.biddingService,
    required this.scrollController,
    required this.onAccept,
    required this.onCancel,
  });

  final String rideId;
  final double estimatedFare;
  final VehicleType vehicleType;
  final BiddingService biddingService;
  final ScrollController scrollController;
  final void Function(String driverName) onAccept;
  final VoidCallback onCancel;

  @override
  State<_LiveBiddingSheetContent> createState() => _LiveBiddingSheetContentState();
}

class _LiveBiddingSheetContentState extends State<_LiveBiddingSheetContent> {
  final List<DriverBid> _bids = [];
  Timer? _pollTimer;
  bool _accepted = false;

  String _t(String key, [Map<String, dynamic>? params]) =>
      AppLocaleScope.of(context)?.t(key, params) ?? key;

  @override
  void initState() {
    super.initState();
    _pollRide();
    _pollTimer = Timer.periodic(const Duration(seconds: 2), (_) {
      if (!mounted || _accepted) return;
      _pollRide();
    });
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    _pollTimer = null;
    super.dispose();
  }

  Future<void> _pollRide() async {
    final ride = await widget.biddingService.getRide(widget.rideId);
    if (!mounted) return;
    if (ride == null) return;
    if (ride['status'] == 'accepted') {
      _accepted = true;
      _pollTimer?.cancel();
      final dp = ride['driverPhone'] as String?;
      final driverName = dp != null && dp.isNotEmpty ? dp : 'Conductor';
      widget.onAccept(driverName);
      return;
    }
    
    final rawBids = ride['bids'] as List<dynamic>? ?? [];
    // Map driverId -> latest Bid
    final latestBidsMap = <String, DriverBid>{};
    
    for (final b in rawBids) {
      final map = b as Map<String, dynamic>? ?? {};
      final id = map['id'] as String? ?? '';
      final driverId = map['driverId'] as String?;
      if (id.isEmpty || driverId == null) continue;
      
      final createdAtRaw = map['createdAt'];
      final createdAt = (createdAtRaw is String) 
          ? DateTime.tryParse(createdAtRaw) ?? DateTime.now() 
          : DateTime.now();

      final bid = DriverBid(
        id: id,
        driverId: driverId,
        driverName: (map['driverName'] as String?) ?? 'Conductor',
        carModel: (map['carModel'] as String?) ?? 'Auto',
        rating: (map['rating'] as num?)?.toDouble() ?? 4.5,
        price: (map['price'] as num?)?.toDouble() ?? widget.estimatedFare,
        createdAt: createdAt,
      );
      
      // Keep only the latest bid per driver
      if (!latestBidsMap.containsKey(driverId) || 
          bid.createdAt.isAfter(latestBidsMap[driverId]!.createdAt)) {
        latestBidsMap[driverId] = bid;
      }
    }

    final newBids = latestBidsMap.values.toList();
    // Sort by price ascending
    newBids.sort((a, b) => a.price.compareTo(b.price));

    if (mounted) {
      // Simple diff check to avoid unnecessary rebuilds if possible, 
      // but for now just replacing the list is safer to ensure updates show up.
      setState(() {
        _bids.clear();
        _bids.addAll(newBids);
      });
    }
  }

  Future<void> _showCounterOfferDialog(DriverBid bid) async {
    final controller = TextEditingController(text: bid.price.toStringAsFixed(2));
    final result = await showDialog<double?>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(_t('your_counter_offer'), style: GoogleFonts.poppins(fontWeight: FontWeight.w600)),
        content: TextField(
          controller: controller,
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          decoration: InputDecoration(
            labelText: _t('price_soles'),
            border: const OutlineInputBorder(),
          ),
          autofocus: true,
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: Text(_t('cancel')),
          ),
          ElevatedButton(
            onPressed: () {
              final v = double.tryParse(controller.text.trim());
              if (v != null && v >= 1) Navigator.of(ctx).pop(v);
            },
            style: ElevatedButton.styleFrom(backgroundColor: _kNeonOrange, foregroundColor: Colors.white),
            child: Text(_t('send')),
          ),
        ],
      ),
    );
    if (!mounted || result == null) return;
    // Bug fix: update local UI to show counter price + waiting status.
    // NOTE: Currently cosmetic only — no backend endpoint exists for user
    // counter-offers to a specific driver bid. The real negotiation happens
    // when user rejects and driver sends a new counter via the driver app.
    setState(() {
      bid.price = result;
      bid.status = _t('waiting_response');
    });
    await Future.delayed(const Duration(seconds: 2));
    if (!mounted) return;
    setState(() => bid.status = null);
  }

  Widget _buildBidCard(DriverBid bid) {
    final driverName = bid.driverName.isNotEmpty ? bid.driverName : 'Driver';
    final carModel = bid.carModel.isNotEmpty ? bid.carModel : 'Car';
    final price = bid.price.clamp(0.0, 9999.0);
    final rating = bid.rating.clamp(0.0, 5.0);
    final isWaiting = bid.status != null && bid.status!.isNotEmpty;
    final statusText = bid.status ?? '';
    final priceDiff = price - widget.estimatedFare;
    final priceDiffText = priceDiff > 0
        ? '+S/ ${priceDiff.toStringAsFixed(2)}'
        : priceDiff < 0
            ? '-S/ ${priceDiff.abs().toStringAsFixed(2)}'
            : '';
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        boxShadow: [
          BoxShadow(color: Colors.black.withOpacity(0.06), blurRadius: 8, offset: const Offset(0, 2)),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              children: [
                CircleAvatar(
                  radius: 24,
                  backgroundColor: _kNeonOrange.withOpacity(0.12),
                  child: Text(
                    driverName[0].toUpperCase(),
                    style: GoogleFonts.poppins(fontSize: 20, fontWeight: FontWeight.w700, color: _kNeonOrange),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        driverName,
                        style: GoogleFonts.poppins(fontSize: 15, fontWeight: FontWeight.w700, color: Colors.black87),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      Row(
                        children: [
                          Icon(Icons.star, size: 14, color: Colors.amber.shade700),
                          const SizedBox(width: 3),
                          Text(
                            rating.toStringAsFixed(1),
                            style: GoogleFonts.poppins(fontSize: 12, fontWeight: FontWeight.w600, color: Colors.grey.shade700),
                          ),
                          const SizedBox(width: 8),
                          Icon(Icons.directions_car, size: 14, color: Colors.grey.shade500),
                          const SizedBox(width: 3),
                          Flexible(
                            child: Text(
                              carModel,
                              style: GoogleFonts.poppins(fontSize: 12, color: Colors.grey.shade600),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ),
                      if (isWaiting && statusText.isNotEmpty) ...[
                        const SizedBox(height: 2),
                        Text(
                          statusText,
                          style: GoogleFonts.poppins(fontSize: 11, color: Colors.orange.shade800, fontStyle: FontStyle.italic),
                        ),
                      ],
                    ],
                  ),
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      'S/ ${price.toStringAsFixed(2)}',
                      style: GoogleFonts.poppins(fontSize: 20, fontWeight: FontWeight.w800, color: _kNeonOrange),
                    ),
                    if (priceDiffText.isNotEmpty)
                      Text(
                        priceDiffText,
                        style: GoogleFonts.poppins(
                          fontSize: 11,
                          fontWeight: FontWeight.w500,
                          color: priceDiff > 0 ? Colors.red.shade400 : Colors.green.shade600,
                        ),
                      ),
                  ],
                ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: SizedBox(
                    height: 40,
                    child: ElevatedButton(
                      onPressed: () async {
                        final ok = await widget.biddingService.acceptBid(widget.rideId, bid.id);
                        if (!mounted) return;
                        if (ok) {
                          widget.onAccept(driverName);
                        } else {
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(
                              content: Text(_t('no_accept_connection'), style: GoogleFonts.poppins(fontSize: 14)),
                              backgroundColor: Colors.orange,
                            ),
                          );
                        }
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF4CAF50),
                        foregroundColor: Colors.white,
                        elevation: 0,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                      child: Text(_t('accept'), style: GoogleFonts.poppins(fontSize: 14, fontWeight: FontWeight.w600)),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                SizedBox(
                  height: 40,
                  width: 40,
                  child: IconButton(
                    onPressed: () {
                      setState(() => _bids.remove(bid));
                    },
                    icon: Icon(Icons.close, size: 20, color: Colors.grey.shade500),
                    style: IconButton.styleFrom(
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10),
                        side: BorderSide(color: Colors.grey.shade300),
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

  Widget _buildBiddingList() {
    if (_bids.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const SizedBox(
                width: 56,
                height: 56,
                child: CircularProgressIndicator(color: _kNeonOrange, strokeWidth: 3),
              ),
              const SizedBox(height: 20),
              Text(
                _t('finding_driver'),
                style: GoogleFonts.poppins(fontSize: 18, fontWeight: FontWeight.w700, color: Colors.black87),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 8),
              Text(
                _t('please_wait_driver'),
                style: GoogleFonts.poppins(fontSize: 13, color: Colors.black54),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 16),
              Text(
                '${widget.vehicleType.emoji} ${widget.vehicleType.label} — S/ ${widget.estimatedFare.toStringAsFixed(2)}',
                style: GoogleFonts.poppins(fontSize: 15, fontWeight: FontWeight.w600, color: _kNeonOrange),
              ),
            ],
          ),
        ),
      );
    }
    return ListView.builder(
      controller: widget.scrollController,
      physics: const BouncingScrollPhysics(),
      shrinkWrap: true,
      padding: const EdgeInsets.only(bottom: 24),
      itemCount: _bids.length,
      itemBuilder: (context, index) {
        if (index < 0 || index >= _bids.length) return const SizedBox.shrink();
        final bid = _bids[index];
        final isNewest = index == _bids.length - 1;
        final content = _buildBidCard(bid);
        if (!isNewest) return content;
        return TweenAnimationBuilder<double>(
          key: ValueKey(bid.id),
          tween: Tween(begin: 0, end: 1),
          duration: const Duration(milliseconds: 280),
          curve: Curves.easeOut,
          builder: (context, value, child) {
            return Opacity(
              opacity: value,
              child: Transform.translate(
                offset: Offset(0, 10 * (1 - value)),
                child: child,
              ),
            );
          },
          child: content,
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: Color(0xFFF7F7F7),
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const SizedBox(height: 10),
          Center(
            child: Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(color: Colors.grey.shade400, borderRadius: BorderRadius.circular(2)),
            ),
          ),
          const SizedBox(height: 12),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
                boxShadow: [
                  BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 6, offset: const Offset(0, 2)),
                ],
              ),
              child: Row(
                children: [
                  Text(widget.vehicleType.emoji, style: const TextStyle(fontSize: 28)),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          widget.vehicleType.label,
                          style: GoogleFonts.poppins(fontSize: 14, fontWeight: FontWeight.w700, color: Colors.black87),
                        ),
                        Text(
                          'S/ ${widget.estimatedFare.toStringAsFixed(2)}',
                          style: GoogleFonts.poppins(fontSize: 12, fontWeight: FontWeight.w500, color: Colors.grey.shade600),
                        ),
                      ],
                    ),
                  ),
                  Text(
                    '${_bids.length}',
                    style: GoogleFonts.poppins(fontSize: 22, fontWeight: FontWeight.w800, color: _kNeonOrange),
                  ),
                  const SizedBox(width: 4),
                  Text(
                    _bids.length == 1 ? 'offer' : 'offers',
                    style: GoogleFonts.poppins(fontSize: 12, color: Colors.grey.shade600),
                  ),
                  const SizedBox(width: 8),
                  GestureDetector(
                    onTap: widget.onCancel,
                    child: Container(
                      padding: const EdgeInsets.all(6),
                      decoration: BoxDecoration(
                        color: Colors.grey.shade200,
                        shape: BoxShape.circle,
                      ),
                      child: Icon(Icons.close, size: 18, color: Colors.grey.shade600),
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 8),
          Expanded(
            child: _buildBiddingList(),
          ),
        ],
      ),
    );
  }
}

/// Legacy bidding sheet: estimated fare, +/- steps, manual bid, Confirm Bid.
class _BiddingSheetContent extends StatefulWidget {
  const _BiddingSheetContent({
    required this.estimatedFare,
    required this.vehicleType,
    required this.scrollController,
    required this.onConfirm,
  });

  final double estimatedFare;
  final VehicleType vehicleType;
  final ScrollController scrollController;
  final void Function(double bidPrice) onConfirm;

  @override
  State<_BiddingSheetContent> createState() => _BiddingSheetContentState();
}

class _BiddingSheetContentState extends State<_BiddingSheetContent> {
  static const double _step = 0.5; // S/ 0.5 steps
  late double _bidPrice;
  late TextEditingController _textController;

  @override
  void initState() {
    super.initState();
    _bidPrice = widget.estimatedFare;
    _textController = TextEditingController(text: widget.estimatedFare.toStringAsFixed(2));
  }

  @override
  void dispose() {
    _textController.dispose();
    super.dispose();
  }

  void _updateBid(double value) {
    setState(() {
      _bidPrice = value.clamp(0.5, 9999.0);
      _textController.text = _bidPrice.toStringAsFixed(2);
      _textController.selection = TextSelection.collapsed(offset: _textController.text.length);
    });
  }

  void _onConfirm() {
    final parsed = double.tryParse(_textController.text.trim());
    final price = (parsed ?? _bidPrice).clamp(0.5, 9999.0);
    widget.onConfirm(price);
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: _kCream,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: ListView(
        controller: widget.scrollController,
        padding: const EdgeInsets.fromLTRB(24, 20, 24, 32),
        children: [
          Center(
            child: Container(width: 40, height: 4, decoration: BoxDecoration(color: Colors.grey.shade400, borderRadius: BorderRadius.circular(2))),
          ),
          const SizedBox(height: 20),
          Text(
            'Tu oferta',
            style: GoogleFonts.poppins(fontSize: 18, fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 8),
          Text(
            'Tarifa estimada: S/ ${widget.estimatedFare.toStringAsFixed(2)}',
            style: GoogleFonts.poppins(fontSize: 22, fontWeight: FontWeight.w600, color: Colors.green.shade800),
          ),
          const SizedBox(height: 24),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              IconButton.filled(
                onPressed: () => _updateBid(_bidPrice - _step),
                icon: const Icon(Icons.remove),
                style: IconButton.styleFrom(backgroundColor: Colors.grey.shade300),
              ),
              const SizedBox(width: 16),
              SizedBox(
                width: 100,
                child: Text(
                  'S/ ${_bidPrice.toStringAsFixed(2)}',
                  textAlign: TextAlign.center,
                  style: GoogleFonts.poppins(fontSize: 24, fontWeight: FontWeight.w600),
                ),
              ),
              const SizedBox(width: 16),
              IconButton.filled(
                onPressed: () => _updateBid(_bidPrice + _step),
                icon: const Icon(Icons.add),
                style: IconButton.styleFrom(backgroundColor: Colors.grey.shade300),
              ),
            ],
          ),
          const SizedBox(height: 20),
          TextField(
            controller: _textController,
            keyboardType: TextInputType.number,
            decoration: InputDecoration(
              labelText: 'Precio de oferta (S/ )',
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              filled: true,
              fillColor: Colors.white,
            ),
            onChanged: (v) {
              final n = double.tryParse(v.trim());
              if (n != null) setState(() => _bidPrice = n.clamp(0.5, 9999.0));
            },
          ),
          const SizedBox(height: 28),
          SizedBox(
            height: 50,
            child: ElevatedButton(
              onPressed: _onConfirm,
              style: ElevatedButton.styleFrom(
                backgroundColor: _kNeonOrange,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              child: Text('Confirmar oferta', style: GoogleFonts.poppins(fontSize: 16, fontWeight: FontWeight.w600)),
            ),
          ),
        ],
      ),
    );
  }
}

/// Full-screen overlay: "Searching..." or driver counter bid "El conductor propone: S/ X.XX".
class _SearchingOverlay extends StatefulWidget {
  const _SearchingOverlay({
    required this.onCancel,
    this.onDriverAccepted,
    this.counterPrice,
    this.vehicleLabel,
    this.onDriverCounterBid,
    this.onAcceptCounter,
    this.onRejectCounter,
  });

  final VoidCallback onCancel;
  final void Function(String driverName)? onDriverAccepted;
  final double? counterPrice;
  final String? vehicleLabel;
  final void Function(double price)? onDriverCounterBid;
  final void Function(double price)? onAcceptCounter;
  final VoidCallback? onRejectCounter;

  @override
  State<_SearchingOverlay> createState() => _SearchingOverlayState();
}

class _SearchingOverlayState extends State<_SearchingOverlay> with SingleTickerProviderStateMixin {
  late AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(vsync: this, duration: const Duration(milliseconds: 2000))..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final counterPrice = widget.counterPrice;

    return Material(
      color: Colors.black54,
      child: SafeArea(
        child: Center(
          child: counterPrice != null
              ? _CounterBidCard(
                  counterPrice: counterPrice,
                  onAccept: () => widget.onAcceptCounter?.call(counterPrice),
                  onReject: widget.onRejectCounter ?? () {},
                )
              : Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    SizedBox(
                      width: 160,
                      height: 160,
                      child: AnimatedBuilder(
                        animation: _controller,
                        builder: (context, child) {
                          return CustomPaint(
                            painter: _RadarPainter(progress: _controller.value),
                            size: const Size(160, 160),
                          );
                        },
                      ),
                    ),
                    const SizedBox(height: 24),
                    Text(
                      widget.vehicleLabel != null && widget.vehicleLabel!.isNotEmpty
                          ? '${(AppLocaleScope.of(context)?.t('please_wait_driver') ?? translate('please_wait_driver', defaultLocale))}\n${widget.vehicleLabel!}'
                          : (AppLocaleScope.of(context)?.t('searching_nearby') ?? translate('searching_nearby', defaultLocale)),
                      style: GoogleFonts.poppins(fontSize: 16, fontWeight: FontWeight.w500, color: Colors.white),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 32),
                    TextButton(
                      onPressed: widget.onCancel,
                      child: Text(AppLocaleScope.of(context)?.t('cancel') ?? translate('cancel', defaultLocale), style: GoogleFonts.poppins(color: Colors.white70, fontWeight: FontWeight.w500)),
                    ),
                  ],
                ),
        ),
      ),
    );
  }
}

/// Card shown when driver sends counter bid: "El conductor propone: S/ X.XX" with ACEPTAR / RECHAZAR.
class _CounterBidCard extends StatelessWidget {
  const _CounterBidCard({
    required this.counterPrice,
    required this.onAccept,
    required this.onReject,
  });

  final double counterPrice;
  final VoidCallback onAccept;
  final VoidCallback onReject;

  @override
  Widget build(BuildContext context) {
    final scope = AppLocaleScope.of(context);
    final t = scope?.t ?? (String k, [Map<String, dynamic>? p]) => translate(k, defaultLocale, p);
    final priceStr = counterPrice.toStringAsFixed(2);
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24),
      child: Material(
        elevation: 8,
        borderRadius: BorderRadius.circular(16),
        color: Colors.white,
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                t('driver_proposes', {'price': priceStr}),
                style: GoogleFonts.poppins(fontSize: 20, fontWeight: FontWeight.w700, color: Colors.black87),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 24),
              Row(
                children: [
                  Expanded(
                    child: ElevatedButton(
                      onPressed: onAccept,
                      style: ElevatedButton.styleFrom(backgroundColor: Colors.green, foregroundColor: Colors.white, padding: const EdgeInsets.symmetric(vertical: 14)),
                      child: Text(t('accept'), style: GoogleFonts.poppins(fontWeight: FontWeight.w600)),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: OutlinedButton(
                      onPressed: onReject,
                      style: OutlinedButton.styleFrom(foregroundColor: Colors.red, side: const BorderSide(color: Colors.red), padding: const EdgeInsets.symmetric(vertical: 14)),
                      child: Text(t('reject'), style: GoogleFonts.poppins(fontWeight: FontWeight.w600)),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _RadarPainter extends CustomPainter {
  _RadarPainter({required this.progress});
  final double progress;

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final maxR = size.width / 2;
    for (int i = 1; i <= 3; i++) {
      final t = (progress + (i - 1) / 3) % 1.0;
      final r = maxR * t;
      final opacity = (1 - t) * 0.6;
      canvas.drawCircle(center, r, Paint()..color = Colors.green.withOpacity(opacity)..style = PaintingStyle.stroke..strokeWidth = 2);
    }
    canvas.drawCircle(center, maxR, Paint()..color = Colors.green.withOpacity(0.2)..style = PaintingStyle.stroke..strokeWidth = 1);
  }

  @override
  bool shouldRepaint(covariant _RadarPainter oldDelegate) => oldDelegate.progress != progress;
}
