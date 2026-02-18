import 'dart:async';
import 'package:flutter/material.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:permission_handler/permission_handler.dart';

/// Always-allow location permission and driver location stream (for live tracking).
class LocationService {
  StreamSubscription<LatLng>? _driverSubscription;

  /// Request "Always" location permission. Shows Spanish dialog if not granted.
  Future<bool> requestAlwaysLocationPermission(BuildContext context) async {
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
  }

  Future<bool> _showAlwaysReasonDialog(BuildContext context) async {
    return await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        title: const Text('Ubicación siempre'),
        content: const Text(
          'Necesitamos tu ubicación siempre para que el usuario o conductor pueda rastrear el viaje en tiempo real.',
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

  /// Listen to driver location stream (e.g. from socket/API). [onDriverLocation] is called with interpolated updates.
  void listenToDriverLocation({
    required Stream<LatLng> driverStream,
    required void Function(LatLng) onDriverLocation,
  }) {
    _driverSubscription?.cancel();
    _driverSubscription = driverStream.listen(onDriverLocation);
  }

  void stopListeningToDriver() {
    _driverSubscription?.cancel();
    _driverSubscription = null;
  }

  void dispose() {
    stopListeningToDriver();
  }
}
