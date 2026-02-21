import 'dart:convert';

import 'package:http/http.dart' as http;

import '../core/api_config.dart';

/// Pings backend GET /api/health to verify connectivity.
/// Use to show "Cannot reach server" or enable retry when backend is down.
class BackendHealthService {
  BackendHealthService({String? baseUrl}) : _baseUrl = baseUrl ?? kApiBaseUrl;

  final String _baseUrl;

  static const Duration _timeout = Duration(seconds: 5);

  /// Returns true if backend responds with 200 and body contains status: 'ok'.
  Future<bool> check() async {
    try {
      final uri = Uri.parse('$_baseUrl/api/v1/health');
      final response = await http.get(uri).timeout(
            _timeout,
            onTimeout: () => throw Exception('Health check timeout'),
          );
      if (response.statusCode != 200) return false;
      final data = json.decode(response.body) as Map<String, dynamic>?;
      return data?['status'] == 'ok';
    } catch (_) {
      return false;
    }
  }

  /// Same as [check] but returns a short message for debugging.
  Future<String> checkWithMessage() async {
    try {
      final uri = Uri.parse('$_baseUrl/api/v1/health');
      final response = await http.get(uri).timeout(
            _timeout,
            onTimeout: () => throw Exception('Health check timeout'),
          );
      if (response.statusCode != 200) {
        return 'Backend returned ${response.statusCode}';
      }
      final data = json.decode(response.body) as Map<String, dynamic>?;
      if (data?['status'] != 'ok') {
        return 'Backend health: status != ok';
      }
      return 'OK';
    } catch (e) {
      return 'Backend unreachable: $e';
    }
  }
}
