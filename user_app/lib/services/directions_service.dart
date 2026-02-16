import 'dart:convert';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:http/http.dart' as http;
import 'package:flutter_polyline_points/flutter_polyline_points.dart';

import '../core/api_config.dart';

/// Result of a directions request: polyline points, distance/duration text, traffic info.
class DirectionsResult {
  const DirectionsResult({
    required this.polylinePoints,
    required this.distanceText,
    required this.durationText,
    required this.distanceKm,
    required this.durationMins,
    this.durationInTrafficMins,
    this.trafficDelayMins,
  });

  final List<LatLng> polylinePoints;
  final String distanceText;
  /// Duration text (uses duration_in_traffic when available).
  final String durationText;
  /// Distance in kilometers (for fare calculation).
  final double distanceKm;
  /// Base duration in minutes.
  final int durationMins;
  /// Duration in traffic (minutes), when API provides it.
  final int? durationInTrafficMins;
  /// Extra minutes due to traffic (for fare and UI).
  final int? trafficDelayMins;
}

/// Directions via local backend proxy (fixes CORS on Web). Backend uses Maps_API_KEY.
class DirectionsService {
  DirectionsService();

  /// Fetches route between [origin] and [destination] via backend proxy.
  /// URL: $kApiBaseUrl/api/directions. Origin/destination as lat,lng strings.
  /// Backend adds API key and mode=driving; no key, departure_time, or traffic_model.
  Future<DirectionsResult?> getDirections({
    required LatLng origin,
    required LatLng destination,
  }) async {
    final originStr = '${origin.latitude},${origin.longitude}';
    final destinationStr = '${destination.latitude},${destination.longitude}';
    // Full URL: $kApiBaseUrl/api/directions?origin=...&destination=...
    final uri = Uri.parse(kApiBaseUrl).replace(
      path: '/api/directions',
      queryParameters: {
        'origin': originStr,
        'destination': destinationStr,
      },
    );

    final response = await http.get(uri).timeout(
      const Duration(seconds: 15),
      onTimeout: () => throw Exception('Directions request timeout'),
    );

    if (response.statusCode != 200) return null;

    Map<String, dynamic>? data;
    try {
      data = json.decode(response.body) as Map<String, dynamic>?;
    } catch (_) {
      return null;
    }
    if (data?['error'] == 'Invalid JSON from Google') return null;
    final status = data?['status'] as String?;
    if (status != 'OK') return null;

    final routes = data?['routes'] as List<dynamic>?;
    if (routes == null || routes.isEmpty) return null;

    final route = routes[0] as Map<String, dynamic>;
    final legs = route['legs'] as List<dynamic>?;
    if (legs == null || legs.isEmpty) return null;

    final leg = legs[0] as Map<String, dynamic>;
    final distance = leg['distance'] as Map<String, dynamic>?;
    final duration = leg['duration'] as Map<String, dynamic>?;
    final durationInTraffic = leg['duration_in_traffic'] as Map<String, dynamic>?;
    final distanceText = distance?['text'] as String? ?? '';
    final distanceMeters = (distance?['value'] as num?)?.toDouble() ?? 0.0;
    final distanceKm = distanceMeters / 1000.0;
    final durationSec = (duration?['value'] as num?)?.toInt() ?? 0;
    final durationMins = (durationSec / 60).ceil();
    final durationInTrafficSec = (durationInTraffic?['value'] as num?)?.toInt();
    final durationInTrafficMins = durationInTrafficSec != null ? (durationInTrafficSec / 60).ceil() : null;
    final durationInTrafficText = durationInTraffic?['text'] as String?;
    final trafficDelayMins = durationInTrafficMins != null ? (durationInTrafficMins - durationMins).clamp(0, 999) : null;
    final durationText = durationInTrafficText ?? duration?['text'] as String? ?? '';

    final overviewPolyline = route['overview_polyline'] as Map<String, dynamic>?;
    final encodedPoints = overviewPolyline?['points'] as String?;
    if (encodedPoints == null || encodedPoints.isEmpty) {
      return DirectionsResult(
        polylinePoints: [],
        distanceText: distanceText,
        durationText: durationText,
        distanceKm: distanceKm,
        durationMins: durationMins,
        durationInTrafficMins: durationInTrafficMins,
        trafficDelayMins: trafficDelayMins,
      );
    }

    final decoded = PolylinePoints().decodePolyline(encodedPoints);
    final polylinePoints = decoded
        .map((p) => LatLng(p.latitude, p.longitude))
        .toList();

    return DirectionsResult(
      polylinePoints: polylinePoints,
      distanceText: distanceText,
      durationText: durationText,
      distanceKm: distanceKm,
      durationMins: durationMins,
      durationInTrafficMins: durationInTrafficMins,
      trafficDelayMins: trafficDelayMins,
    );
  }
}
