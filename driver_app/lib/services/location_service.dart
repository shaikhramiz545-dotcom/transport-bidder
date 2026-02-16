import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:permission_handler/permission_handler.dart';

/// Always-allow location permission and live location stream (every 5s) for driver tracking.
class LocationService {
  final StreamController<LatLng> _locationController = StreamController<LatLng>.broadcast();

  /// Stream of driver's current position (emitted every ~5 seconds when started).
  Stream<LatLng> get locationStream => _locationController.stream;

  /// Request "Always" location permission. Shows Spanish dialog if not granted.
  /// On web, permission_handler is not implemented — treat as granted so app can run in Chrome.
  Future<bool> requestAlwaysLocationPermission(BuildContext context) async {
    if (kIsWeb) return true;
    try {
      final status = await Permission.locationWhenInUse.status;
    if (!status.isGranted) {
      final whenInUse = await Permission.locationWhenInUse.request();
      if (!whenInUse.isGranted) return false;
    }

    final always = await Permission.locationAlways.status;
    if (always.isGranted) return true;

    final shouldOpen = await _showAlwaysReasonDialog(context);
    if (!shouldOpen) return false;

    final result = await Permission.locationAlways.request();
    return result.isGranted;
    } on UnimplementedError {
      return true; // Web / unsupported platform
    }
  }

  Future<bool> _showAlwaysReasonDialog(BuildContext context) async {
    return await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        title: const Text('Ubicación siempre'),
        content: const Text(
          'Necesitamos tu ubicación siempre para que el usuario pueda rastrear el viaje en tiempo real.',
          style: TextStyle(fontSize: 16),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Permitir siempre'),
          ),
        ],
      ),
    ) ?? false;
  }

  Timer? _timer;

  /// Start emitting current location every 5 seconds. Call when driver goes online.
  void startLocationStream() {
    _timer?.cancel();
    void emitPosition() {
      Geolocator.getCurrentPosition(desiredAccuracy: LocationAccuracy.high).then((p) {
        _locationController.add(LatLng(p.latitude, p.longitude));
      }).catchError((_) {});
    }
    emitPosition();
    _timer = Timer.periodic(const Duration(seconds: 5), (_) => emitPosition());
  }

  /// Stop emitting. Call when driver goes offline.
  void stopLocationStream() {
    _timer?.cancel();
    _timer = null;
  }

  void dispose() {
    stopLocationStream();
    _locationController.close();
  }
}
