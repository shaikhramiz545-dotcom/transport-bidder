import 'dart:convert';

import 'package:http/http.dart' as http;

import 'package:tbidder_user_app/core/api_config.dart';
import 'package:tbidder_user_app/services/fare_service.dart';
import 'package:tbidder_user_app/services/profile_storage_service.dart';

/// Bidding service: create ride, poll bids, accept bid. Uses backend at kApiBaseUrl.
class BiddingService {
  String get _base => kApiBaseUrl;

  Future<Map<String, String>> _authHeaders({bool json = false}) async {
    final headers = <String, String>{};
    if (json) headers['Content-Type'] = 'application/json';
    final token = await ProfileStorageService.getAuthToken();
    if (token != null && token.trim().isNotEmpty) {
      headers['Authorization'] = 'Bearer ${token.trim()}';
    }
    return headers;
  }

  /// Creates a ride request. Returns rideId or null on failure.
  /// [userRating], [userPhotoUrl], [userPhone] optional.
  Future<String?> createRide({
    required double pickupLat,
    required double pickupLng,
    required double dropLat,
    required double dropLng,
    required String pickupAddress,
    required String dropAddress,
    required double distanceKm,
    required int trafficDelayMins,
    required String vehicleType,
    required double userPrice,
    double? userRating,
    String? userPhotoUrl,
    String? userPhone,
    // Outstation fields
    int? outstationPassengers,
    String? outstationComments,
    bool? outstationIsParcel,
    // Delivery fields
    String? deliveryComments,
    String? deliveryWeight,
    String? deliveryPhotoUrl,
  }) async {
    try {
      final uri = Uri.parse('$_base/api/rides');
      final body = {
        'pickupLat': pickupLat,
        'pickupLng': pickupLng,
        'dropLat': dropLat,
        'dropLng': dropLng,
        'pickupAddress': pickupAddress,
        'dropAddress': dropAddress,
        'distanceKm': distanceKm,
        'trafficDelayMins': trafficDelayMins,
        'vehicleType': vehicleType,
        'userPrice': userPrice,
        if (userRating != null) 'userRating': userRating,
        if (userPhotoUrl != null) 'userPhotoUrl': userPhotoUrl,
        if (userPhone != null && userPhone.isNotEmpty) 'userPhone': userPhone,
        if (outstationPassengers != null) 'outstationPassengers': outstationPassengers,
        if (outstationComments != null && outstationComments.isNotEmpty) 'outstationComments': outstationComments,
        if (outstationIsParcel == true) 'outstationIsParcel': true,
        if (deliveryComments != null && deliveryComments.isNotEmpty) 'deliveryComments': deliveryComments,
        if (deliveryWeight != null && deliveryWeight.isNotEmpty) 'deliveryWeight': deliveryWeight,
        if (deliveryPhotoUrl != null && deliveryPhotoUrl.isNotEmpty) 'deliveryPhotoUrl': deliveryPhotoUrl,
      };
      final res = await http
          .post(
            uri,
            headers: await _authHeaders(json: true),
            body: json.encode(body),
          )
          .timeout(const Duration(seconds: 15), onTimeout: () => throw Exception('Timeout'));
      if (res.statusCode == 409) {
        // ACTIVE_RIDE_EXISTS: reconnect to the existing ride instead of failing
        final data = json.decode(res.body) as Map<String, dynamic>?;
        final existingId = data?['existingRideId'] as String?;
        if (existingId != null && existingId.isNotEmpty) {
          print('[BiddingService] reconnecting to existing ride: $existingId');
          return existingId;
        }
        return null;
      }
      if (res.statusCode != 201) {
        print('[BiddingService] createRide failed: ${res.statusCode} ${res.body}');
        return null;
      }
      final data = json.decode(res.body) as Map<String, dynamic>?;
      return data?['rideId'] as String?;
    } catch (e) {
      print('[BiddingService] createRide error: $e');
      return null;
    }
  }

  /// Fetches ride with bids (for polling).
  Future<Map<String, dynamic>?> getRide(String rideId) async {
    try {
      final uri = Uri.parse('$_base/api/rides/$rideId');
      final res = await http.get(uri, headers: await _authHeaders()).timeout(
            const Duration(seconds: 10),
            onTimeout: () => throw Exception('Timeout'),
          );
      if (res.statusCode != 200) return null;
      final data = json.decode(res.body) as Map<String, dynamic>?;
      return data;
    } catch (_) {
      return null;
    }
  }

  /// Fetches driver's last location for accepted ride (for live tracking).
  Future<({double? lat, double? lng})?> getDriverLocation(String rideId) async {
    try {
      final uri = Uri.parse('$_base/api/rides/$rideId/driver-location');
      final res = await http.get(uri, headers: await _authHeaders()).timeout(
            const Duration(seconds: 10),
            onTimeout: () => throw Exception('Timeout'),
          );
      if (res.statusCode != 200) return null;
      final data = json.decode(res.body) as Map<String, dynamic>?;
      final lat = data?['lat'];
      final lng = data?['lng'];
      if (lat == null || lng == null) return (lat: null, lng: null);
      return (lat: (lat as num).toDouble(), lng: (lng as num).toDouble());
    } catch (_) {
      return null;
    }
  }

  /// User accepts a driver bid. Returns true on success.
  Future<bool> acceptBid(String rideId, String bidId) async {
    try {
      final uri = Uri.parse('$_base/api/rides/$rideId/accept-bid');
      final res = await http
          .post(
            uri,
            headers: await _authHeaders(json: true),
            body: json.encode({'bidId': bidId}),
          )
          .timeout(const Duration(seconds: 10), onTimeout: () => throw Exception('Timeout'));
      return res.statusCode >= 200 && res.statusCode < 300;
    } catch (_) {
      return false;
    }
  }

  /// User sends a counter-offer to a specific driver's bid. Returns true on success.
  Future<bool> userCounterOffer(String rideId, String bidId, double counterPrice) async {
    try {
      final uri = Uri.parse('$_base/api/rides/$rideId/user-counter');
      final res = await http
          .post(
            uri,
            headers: await _authHeaders(json: true),
            body: json.encode({'bidId': bidId, 'counterPrice': counterPrice}),
          )
          .timeout(const Duration(seconds: 10), onTimeout: () => throw Exception('Timeout'));
      return res.statusCode >= 200 && res.statusCode < 300;
    } catch (_) {
      return false;
    }
  }

  /// Send chat message (user). Only allowed until ride completed.
  Future<bool> sendChatMessage(String rideId, String text) async {
    try {
      final uri = Uri.parse('$_base/api/rides/$rideId/chat');
      final res = await http
          .post(
            uri,
            headers: await _authHeaders(json: true),
            body: json.encode({'from': 'user', 'text': text.trim()}),
          )
          .timeout(const Duration(seconds: 10), onTimeout: () => throw Exception('Timeout'));
      return res.statusCode >= 200 && res.statusCode < 300;
    } catch (_) {
      return false;
    }
  }

  /// Count drivers on duty within radius, optionally filtered by vehicle type.
  Future<int> getNearbyDriversCount(double lat, double lng, {double radiusKm = 5, String? vehicleType}) async {
    try {
      final params = <String, String>{
        'lat': lat.toString(),
        'lng': lng.toString(),
      };
      if (vehicleType != null && vehicleType.isNotEmpty) {
        params['vehicleType'] = vehicleType;
      } else {
        params['radiusKm'] = radiusKm.toString();
      }
      final uri = Uri.parse('$_base/api/drivers/nearby').replace(
        queryParameters: params,
      );
      final res = await http.get(uri, headers: await _authHeaders()).timeout(
            const Duration(seconds: 5),
            onTimeout: () => throw Exception('Timeout'),
          );
      if (res.statusCode != 200) return 0;
      final data = json.decode(res.body) as Map<String, dynamic>?;
      final count = data?['count'];
      return count is int ? count : 0;
    } catch (_) {
      return 0;
    }
  }

  /// Cancel an active ride (pending or accepted). Returns true on success.
  Future<bool> cancelRide(String rideId) async {
    try {
      final uri = Uri.parse('$_base/api/rides/$rideId/cancel');
      final res = await http
          .post(uri, headers: await _authHeaders(json: true))
          .timeout(const Duration(seconds: 10), onTimeout: () => throw Exception('Timeout'));
      return res.statusCode >= 200 && res.statusCode < 300;
    } catch (_) {
      return false;
    }
  }

  /// Legacy: sends user's bid to drivers (kept for compatibility; real flow uses createRide + drivers bid).
  void sendBidToDrivers(double bidPrice, VehicleType vehicleType) {
    // Real flow: createRide() is used; drivers then send bids via driver app.
  }
}
