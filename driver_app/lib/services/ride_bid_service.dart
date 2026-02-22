import 'dart:convert';

import 'package:flutter_polyline_points/flutter_polyline_points.dart';
import 'package:http/http.dart' as http;
import 'package:google_maps_flutter/google_maps_flutter.dart';

import 'package:tbidder_driver_app/core/api_config.dart';
import 'package:tbidder_driver_app/models/incoming_request.dart';
import 'package:tbidder_driver_app/services/profile_storage_service.dart';

/// Driver-side: fetch ride requests, accept / counter / decline bid.
class RideBidService {
  RideBidService({String? baseUrl}) : _base = baseUrl ?? kApiBaseUrl;
  final String _base;

  Future<Map<String, String>> _authHeaders({bool json = false}) async {
    final headers = <String, String>{};
    if (json) headers['Content-Type'] = 'application/json';
    final token = await ProfileStorageService.getAuthToken();
    if (token != null && token.trim().isNotEmpty) {
      headers['Authorization'] = 'Bearer ${token.trim()}';
    }
    return headers;
  }

  /// Fetches pending ride requests (for polling when driver is online).
  Future<List<IncomingRequest>> getRequests() async {
    try {
      final uri = Uri.parse('$_base/api/v1/drivers/requests');
      final res = await http.get(uri, headers: await _authHeaders()).timeout(
            const Duration(seconds: 10),
            onTimeout: () => throw Exception('Timeout'),
          );
      if (res.statusCode != 200) return [];
      final data = json.decode(res.body) as Map<String, dynamic>?;
      final list = data?['requests'] as List<dynamic>? ?? [];
      final out = <IncomingRequest>[];
      for (final r in list) {
        final ride = r as Map<String, dynamic>? ?? {};
        final pickup = ride['pickup'] as Map<String, dynamic>? ?? {};
        final drop = ride['drop'] as Map<String, dynamic>? ?? {};
        final lat1 = (pickup['lat'] as num?)?.toDouble() ?? 0.0;
        final lng1 = (pickup['lng'] as num?)?.toDouble() ?? 0.0;
        final lat2 = (drop['lat'] as num?)?.toDouble() ?? 0.0;
        final lng2 = (drop['lng'] as num?)?.toDouble() ?? 0.0;
        out.add(IncomingRequest(
          requestId: ride['id'] as String?,
          pickupAddress: (ride['pickupAddress'] as String?) ?? 'Origen',
          dropAddress: (ride['dropAddress'] as String?) ?? 'Destino',
          distanceKm: (ride['distanceKm'] as num?)?.toDouble() ?? 0.0,
          trafficDelayMins: (ride['trafficDelayMins'] as num?)?.toInt() ?? 0,
          userBidPrice: (ride['userPrice'] as num?)?.toDouble() ?? 0.0,
          vehicleLabel: (ride['vehicleType'] as String?) ?? 'Auto',
          pickup: LatLng(lat1, lng1),
          drop: LatLng(lat2, lng2),
          userRating: (ride['userRating'] as num?)?.toDouble(),
          userPhotoUrl: ride['userPhotoUrl'] as String?,
          outstationPassengers: (ride['outstationPassengers'] as num?)?.toInt(),
          outstationComments: ride['outstationComments'] as String?,
          outstationIsParcel: ride['outstationIsParcel'] as bool?,
          deliveryComments: ride['deliveryComments'] as String?,
          deliveryWeight: ride['deliveryWeight'] as String?,
          deliveryPhotoUrl: ride['deliveryPhotoUrl'] as String?,
        ));
      }
      return out;
    } catch (_) {
      return [];
    }
  }

  /// Fetch ride details (messages, userPhone, etc.).
  Future<Map<String, dynamic>?> getRide(String rideId) async {
    try {
      final uri = Uri.parse('$_base/api/v1/rides/$rideId');
      final res = await http.get(uri, headers: await _authHeaders()).timeout(
            const Duration(seconds: 10),
            onTimeout: () => throw Exception('Timeout'),
          );
      if (res.statusCode != 200) return null;
      return json.decode(res.body) as Map<String, dynamic>?;
    } catch (_) {
      return null;
    }
  }

  /// Create driverId if missing by calling verification-register with phone, then resolve.
  Future<String?> createDriverIdIfMissing(String phone) async {
    try {
      final token = await ProfileStorageService.getAuthToken();
      final headers = <String, String>{'Content-Type': 'application/json'};
      if (token != null && token.trim().isNotEmpty) {
        headers['Authorization'] = 'Bearer ${token.trim()}';
      }
      // verification-register generates driverId server-side when none exists
      await http
          .post(
            Uri.parse('$_base/api/v1/drivers/verification-register'),
            headers: headers,
            body: json.encode({'phone': phone.trim()}),
          )
          .timeout(const Duration(seconds: 10), onTimeout: () => throw Exception('Timeout'));
      // Re-resolve to fetch the generated ID
      return await resolveDriverIdByPhone(phone);
    } catch (_) {
      return null;
    }
  }

  /// Send chat message (driver). Only allowed until ride completed.
  Future<bool> sendChatMessage(String rideId, String text) async {
    try {
      final uri = Uri.parse('$_base/api/v1/rides/$rideId/chat');
      final res = await http.post(
        uri,
        headers: await _authHeaders(json: true),
        body: json.encode({'from': 'driver', 'text': text.trim()}),
      ).timeout(const Duration(seconds: 10), onTimeout: () => throw Exception('Timeout'));
      return res.statusCode >= 200 && res.statusCode < 300;
    } catch (_) {
      return false;
    }
  }

  /// Place a bid on a pending ride with a custom price (InDriver style).
  /// Uses upsert: if driver already bid on this ride, updates the existing bid.
  Future<(bool ok, String? bidId)> placeBid(
    String rideId, {
    required double price,
    String? driverId,
    String? driverName,
    String? driverPhone,
    String? carModel,
    double? rating,
  }) async {
    try {
      final body = <String, dynamic>{'price': price};
      if (driverId != null && driverId.trim().isNotEmpty) body['driverId'] = driverId.trim();
      if (driverName != null && driverName.trim().isNotEmpty) body['driverName'] = driverName.trim();
      if (driverPhone != null && driverPhone.trim().isNotEmpty) body['driverPhone'] = driverPhone.trim();
      if (carModel != null && carModel.trim().isNotEmpty) body['carModel'] = carModel.trim();
      if (rating != null) body['rating'] = rating;
      final res = await http.post(
        Uri.parse('$_base/api/v1/rides/$rideId/bid'),
        headers: await _authHeaders(json: true),
        body: json.encode(body),
      ).timeout(const Duration(seconds: 10), onTimeout: () => throw Exception('Timeout'));
      if (res.statusCode >= 200 && res.statusCode < 300) {
        final data = json.decode(res.body) as Map<String, dynamic>?;
        return (true, data?['bidId'] as String?);
      }
      return (false, null);
    } catch (_) {
      return (false, null);
    }
  }

  /// Notify backend: driver accepted the bid. [driverId] required for wallet check; [driverPhone] optional for call.
  /// Returns (true, null) on success; on 403 LOW_CREDIT/NO_CREDIT/EXPIRED returns (false, { code, message }).
  Future<(bool ok, ({String code, String message})?)> acceptBid(String requestId, {String? driverId, String? driverPhone}) async {
    try {
      final body = <String, dynamic>{};
      if (driverId != null && driverId.trim().isNotEmpty) body['driverId'] = driverId.trim();
      if (driverPhone != null && driverPhone.trim().isNotEmpty) body['driverPhone'] = driverPhone.trim();
      final res = await http.post(
        Uri.parse('$_base/api/v1/rides/$requestId/accept'),
        headers: await _authHeaders(json: true),
        body: json.encode(body.isEmpty ? {} : body),
      );
      if (res.statusCode >= 200 && res.statusCode < 300) return (true, null);
      if (res.statusCode == 403) {
        final data = json.decode(res.body) as Map<String, dynamic>?;
        final code = data?['code'] as String?;
        final message = data?['message'] as String? ?? data?['error'] as String? ?? 'Insufficient credits or expired. Recharge in Wallet.';
        if (code == 'EXPIRED' || code == 'LOW_CREDIT' || code == 'NO_CREDIT') {
          return (false, (code: code!, message: message));
        }
      }
      return (false, null);
    } catch (_) {
      return (false, null);
    }
  }

  /// Notify backend: driver sent a counter bid (price in S/). [driverPhone] optional.
  Future<bool> counterBid(String requestId, double counterPriceSoles, {String? driverPhone}) async {
    try {
      final body = <String, dynamic>{'counter_price': counterPriceSoles};
      if (driverPhone != null && driverPhone.trim().isNotEmpty) body['driverPhone'] = driverPhone.trim();
      final res = await http.post(
        Uri.parse('$_base/api/v1/rides/$requestId/counter'),
        headers: await _authHeaders(json: true),
        body: json.encode(body),
      );
      return res.statusCode >= 200 && res.statusCode < 300;
    } catch (_) {
      return false;
    }
  }

  /// Notify backend: driver declined the bid.
  Future<bool> declineBid(String requestId) async {
    try {
      final res = await http.post(
        Uri.parse('$_base/api/v1/rides/$requestId/decline'),
        headers: await _authHeaders(json: true),
      );
      return res.statusCode >= 200 && res.statusCode < 300;
    } catch (_) {
      return false;
    }
  }

  /// Driver marked arrived at pickup (user gets "driver arrived" notification).
  Future<bool> driverArrived(String rideId) async {
    try {
      final res = await http.post(
        Uri.parse('$_base/api/v1/rides/$rideId/driver-arrived'),
        headers: await _authHeaders(json: true),
      );
      return res.statusCode >= 200 && res.statusCode < 300;
    } catch (_) {
      return false;
    }
  }

  /// Driver enters OTP to start ride (then driver sees drop + route).
  Future<bool> startRide(String rideId, String otp) async {
    try {
      final res = await http.post(
        Uri.parse('$_base/api/v1/rides/$rideId/start-ride'),
        headers: await _authHeaders(json: true),
        body: json.encode({'otp': otp.trim()}),
      );
      return res.statusCode >= 200 && res.statusCode < 300;
    } catch (_) {
      return false;
    }
  }

  /// Driver slides to complete ride (user gets thank-you + rating screen).
  Future<bool> completeRide(String rideId) async {
    try {
      final res = await http.post(
        Uri.parse('$_base/api/v1/rides/$rideId/complete'),
        headers: await _authHeaders(json: true),
      );
      return res.statusCode >= 200 && res.statusCode < 300;
    } catch (_) {
      return false;
    }
  }

  /// Fetches route (polyline) from origin to destination for driver map.
  /// Returns list of LatLng or null on failure.
  Future<List<LatLng>?> getDirections(LatLng origin, LatLng destination) async {
    try {
      final originStr = '${origin.latitude},${origin.longitude}';
      final destStr = '${destination.latitude},${destination.longitude}';
      final uri = Uri.parse('$_base/api/v1/directions').replace(
        queryParameters: {'origin': originStr, 'destination': destStr},
      );
      final res = await http.get(uri, headers: await _authHeaders()).timeout(
            const Duration(seconds: 15),
            onTimeout: () => throw Exception('Timeout'),
          );
      if (res.statusCode != 200) return null;
      final data = json.decode(res.body) as Map<String, dynamic>?;
      if (data?['status'] != 'OK') return null;
      final routes = data?['routes'] as List<dynamic>?;
      if (routes == null || routes.isEmpty) return null;
      final route = routes[0] as Map<String, dynamic>;
      final overview = route['overview_polyline'] as Map<String, dynamic>?;
      final encoded = overview?['points'] as String?;
      if (encoded == null || encoded.isEmpty) return null;
      final decoded = PolylinePoints().decodePolyline(encoded);
      return decoded.map((p) => LatLng(p.latitude, p.longitude)).toList();
    } catch (_) {
      return null;
    }
  }

  /// Send driver's current location for live tracking (call periodically when on ride).
  Future<bool> updateDriverLocation(String rideId, double lat, double lng) async {
    try {
      final res = await http.post(
        Uri.parse('$_base/api/v1/rides/$rideId/driver-location'),
        headers: await _authHeaders(json: true),
        body: json.encode({'lat': lat, 'lng': lng}),
      );
      return res.statusCode >= 200 && res.statusCode < 300;
    } catch (_) {
      return false;
    }
  }

  /// Report driver on duty location (for "taxi available 3–5 km" in user app). Call every ~10 sec when online.
  /// Throws [DriverBlockedException] when status is not approved (403). Returns driverId on success.
  Future<String?> reportDriverLocation(
    String? driverId,
    double lat,
    double lng, {
    String vehicleType = 'car',
    String? phone,
  }) async {
    try {
      final body = <String, dynamic>{'lat': lat, 'lng': lng, 'vehicleType': vehicleType};
      if (driverId != null && driverId.isNotEmpty) body['driverId'] = driverId;
      if (phone != null && phone.trim().isNotEmpty) body['phone'] = phone.trim();
      final res = await http.post(
        Uri.parse('$_base/api/v1/drivers/location'),
        headers: await _authHeaders(json: true),
        body: json.encode(body),
      ).timeout(const Duration(seconds: 5), onTimeout: () => throw Exception('Timeout'));
      if (res.statusCode == 403) {
        try {
          final data = json.decode(res.body) as Map<String, dynamic>?;
          final msg = data?['message'] as String? ?? 'Account blocked. Please contact customer service.';
          throw DriverBlockedException(message: msg);
        } catch (e) {
          if (e is DriverBlockedException) rethrow;
          throw DriverBlockedException(message: 'Account blocked. Please contact customer service.');
        }
      }
      if (res.statusCode != 200) return null;
      final data = json.decode(res.body) as Map<String, dynamic>?;
      return data?['driverId'] as String?;
    } on DriverBlockedException {
      rethrow;
    } catch (_) {
      return null;
    }
  }

  /// Resolve driverId from phone (no creation, read-only).
  Future<String?> resolveDriverIdByPhone(String phone) async {
    try {
      final uri = Uri.parse('$_base/api/v1/drivers/resolve-id').replace(queryParameters: {'phone': phone.trim()});
      final res = await http.get(uri, headers: await _authHeaders()).timeout(const Duration(seconds: 5), onTimeout: () => throw Exception('Timeout'));
      if (res.statusCode != 200) return null;
      final data = json.decode(res.body) as Map<String, dynamic>?;
      final ok = data?['ok'] as bool? ?? false;
      if (!ok) return null;
      return data?['driverId'] as String?;
    } catch (_) {
      return null;
    }
  }

  /// GET verification status before going online. Returns status and blockReason.
  Future<Map<String, dynamic>?> getVerificationStatus(String? driverId) async {
    if (driverId == null || driverId.isEmpty) return null;
    try {
      final uri = Uri.parse('$_base/api/v1/drivers/verification-status').replace(queryParameters: {'driverId': driverId});
      final res = await http.get(uri, headers: await _authHeaders()).timeout(const Duration(seconds: 5), onTimeout: () => throw Exception('Timeout'));
      if (res.statusCode != 200) return null;
      final data = json.decode(res.body) as Map<String, dynamic>?;
      return data;
    } catch (_) {
      return null;
    }
  }

  /// GET verification status by phone number. Returns {success: bool, message: string, ...rest}
  Future<Map<String, dynamic>> getVerificationStatusByPhone(String phone) async {
    try {
      final uri = Uri.parse('$_base/api/v1/drivers/verification-status').replace(queryParameters: {'phone': phone.trim()});
      final res = await http.get(uri, headers: await _authHeaders()).timeout(const Duration(seconds: 5), onTimeout: () => throw Exception('Timeout'));
      if (res.statusCode != 200) {
        return {'success': false, 'message': 'Server returned ${res.statusCode}'};
      }
      final data = json.decode(res.body) as Map<String, dynamic>? ?? {};
      // Backend returns {status, hasVerification, canGoOnline, ...} — NOT 'ok'.
      final hasStatus = data.containsKey('status');
      return {
        'success': hasStatus,
        'status': data['status'] as String? ?? 'pending',
        'hasVerification': data['hasVerification'] as bool? ?? false,
        'message': data['message'] as String? ?? '',
      };
    } catch (_) {
      return {'success': false, 'message': 'Cannot reach server.'};
    }
  }

  /// Fetch this driver's active bids (for bid-won/bid-lost polling).
  /// Returns list of maps with: rideId, price, isWon, isLost, status, plus ride details.
  Future<List<Map<String, dynamic>>> getMyBids() async {
    try {
      final driverId = await _resolveDriverId();
      if (driverId == null || driverId.isEmpty) return [];
      final uri = Uri.parse('$_base/api/v1/rides/drivers/$driverId/bids');
      final res = await http.get(uri, headers: await _authHeaders()).timeout(
            const Duration(seconds: 10),
            onTimeout: () => throw Exception('Timeout'),
          );
      if (res.statusCode != 200) return [];
      final data = json.decode(res.body) as Map<String, dynamic>?;
      final list = data?['bids'] as List<dynamic>? ?? [];
      return list.map((b) {
        final bid = b as Map<String, dynamic>? ?? {};
        final status = bid['status'] as String? ?? 'pending';
        final ride = bid['ride'] as Map<String, dynamic>?;
        return <String, dynamic>{
          ...bid,
          'rideId': bid['rideId'] ?? ride?['id'],
          'isWon': status == 'accepted',
          'isLost': status == 'rejected' || status == 'expired',
        };
      }).toList();
    } catch (_) {
      return [];
    }
  }

  /// Resolve driverId from stored profile for API calls that need it.
  Future<String?> _resolveDriverId() async {
    final phone = await ProfileStorageService.getPhone();
    if (phone == null || phone.trim().isEmpty) return null;
    return resolveDriverIdByPhone(phone);
  }

  /// Driver going offline – stop showing in nearby.
  Future<bool> reportDriverOffline(String? driverId) async {
    if (driverId == null || driverId.isEmpty) return true;
    try {
      final res = await http.post(
        Uri.parse('$_base/api/v1/drivers/offline'),
        headers: await _authHeaders(json: true),
        body: json.encode({'driverId': driverId}),
      ).timeout(const Duration(seconds: 3), onTimeout: () => throw Exception('Timeout'));
      return res.statusCode >= 200 && res.statusCode < 300;
    } catch (_) {
      return false;
    }
  }
}

/// Thrown when driver cannot go online (pending / temp_blocked / suspended).
class DriverBlockedException implements Exception {
  DriverBlockedException({required this.message});
  final String message;
  @override
  String toString() => message;
}
