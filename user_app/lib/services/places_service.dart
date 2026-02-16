import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:uuid/uuid.dart';

import '../core/api_config.dart';

/// Google Places Autocomplete & Details.
/// Uses backend proxy (kApiBaseUrl): Android emulator 10.0.2.2:4000, Web localhost:4000.
class PlacesService {
  PlacesService({String? apiKey, String? proxyBaseUrl})
      : _apiKey = apiKey ?? _defaultApiKey,
        _proxyBaseUrl = proxyBaseUrl ?? kApiBaseUrl;

  static const String _defaultApiKey = 'YOUR_GOOGLE_MAPS_API_KEY';
  final String _apiKey;
  final String _proxyBaseUrl;
  final Uuid _uuid = const Uuid();
  String? _sessionToken;

  String _newSessionToken() {
    _sessionToken = _uuid.v4();
    return _sessionToken!;
  }

  /// Fetches place predictions for [input]. Peru (region=pe) prioritized.
  Future<List<Map<String, dynamic>>> getPlacePredictions(String input) async {
    try {
      final trimmed = input.trim();
      if (trimmed.isEmpty) return [];

      final token = _sessionToken ?? _newSessionToken();

      // 1. Primary: backend proxy (works on web + mobile)
      final proxyUri = Uri.parse('$_proxyBaseUrl/api/places/autocomplete')
          .replace(queryParameters: {'input': trimmed, 'sessiontoken': token});
      
      final proxyRes = await http.get(proxyUri).timeout(
        const Duration(seconds: 15),
        onTimeout: () => throw Exception('Place search timeout'),
      );

      if (proxyRes.statusCode == 200) {
        final data = json.decode(proxyRes.body) as Map<String, dynamic>? ?? {};
        final status = data['status'] as String?;
        if (status == 'OK' || status == 'ZERO_RESULTS') {
          final predictions = data['predictions'] as List<dynamic>? ?? [];
          return predictions.map((e) => Map<String, dynamic>.from(e as Map)).toList();
        }
      }

      // 2. Fallback: Direct Google API (Only if proxy fails)
      final params = {
        'input': trimmed,
        'key': _apiKey,
        'language': 'es',
        'sessiontoken': token,
      };
      
      final directUri = Uri.https('maps.googleapis.com', '/maps/api/place/autocomplete/json', params);
      final res = await http.get(directUri).timeout(const Duration(seconds: 15));
      
      if (res.statusCode == 200) {
        final data = json.decode(res.body) as Map<String, dynamic>? ?? {};
        final status = data['status'] as String?;
        if (status == 'OK' || status == 'ZERO_RESULTS') {
          final predictions = data['predictions'] as List<dynamic>? ?? [];
          return predictions.map((e) => Map<String, dynamic>.from(e as Map)).toList();
        }
      }
      return [];
    } catch (_) {
      return [];
    }
  }

  /// Fetches place details for [placeId] and returns lat/lng (geometry) or null.
  Future<({double lat, double lng})?> getPlaceDetails(String placeId) async {
    try {
      // 1. Primary: Backend Proxy
      final Uri proxyUri = Uri.parse('$_proxyBaseUrl/api/places/details')
          .replace(queryParameters: {'place_id': placeId});
      
      final proxyRes = await http.get(proxyUri).timeout(
        const Duration(seconds: 15),
        onTimeout: () => throw Exception('Place details timeout'),
      );

      if (proxyRes.statusCode == 200) {
        final data = json.decode(proxyRes.body) as Map<String, dynamic>? ?? {};
        if (data['status'] == 'OK') {
          final result = data['result'] as Map<String, dynamic>? ?? {};
          final geometry = result['geometry'] as Map<String, dynamic>? ?? {};
          final location = geometry['location'] as Map<String, dynamic>? ?? {};
          final lat = (location['lat'] as num?)?.toDouble();
          final lng = (location['lng'] as num?)?.toDouble();
          if (lat != null && lng != null) {
            _sessionToken = null; // Reset session after successful selection
            return (lat: lat, lng: lng);
          }
        }
      }

      // 2. Fallback: Direct API (Not for Web usually, due to CORS, but kept as backup)
      if (!kIsWeb) {
        final params = {'place_id': placeId, 'key': _apiKey, 'fields': 'geometry', 'language': 'es'};
        final directUri = Uri.https('maps.googleapis.com', '/maps/api/place/details/json', params);
        
        final res = await http.get(directUri).timeout(const Duration(seconds: 15));
        
        if (res.statusCode == 200) {
          final data = json.decode(res.body) as Map<String, dynamic>? ?? {};
          if (data['status'] == 'OK') {
            final result = data['result'] as Map<String, dynamic>? ?? {};
            final geometry = result['geometry'] as Map<String, dynamic>? ?? {};
            final location = geometry['location'] as Map<String, dynamic>? ?? {};
            final lat = (location['lat'] as num?)?.toDouble();
            final lng = (location['lng'] as num?)?.toDouble();
            if (lat != null && lng != null) {
              _sessionToken = null;
              return (lat: lat, lng: lng);
            }
          }
        }
      }

      return null;
    } catch (_) {
      return null;
    }
  }
}