import 'dart:convert';

import 'package:http/http.dart' as http;

import '../core/api_config.dart';
import 'package:tbidder_user_app/services/profile_storage_service.dart';

/// Fetches user ride history from backend.
class HistoryService {
  String get _base => kApiBaseUrl;

  Future<Map<String, String>> _authHeaders() async {
    final headers = <String, String>{};
    final token = await ProfileStorageService.getAuthToken();
    if (token != null && token.trim().isNotEmpty) {
      headers['Authorization'] = 'Bearer ${token.trim()}';
    }
    return headers;
  }

  /// [status] e.g. 'completed', 'pending', 'accepted'
  /// [from], [to] date strings YYYY-MM-DD
  Future<List<Map<String, dynamic>>> getRideHistory({
    String? status,
    String? from,
    String? to,
    int limit = 50,
    String? userPhone,
  }) async {
    try {
      final params = <String, String>{'limit': limit.toString()};
      if (status != null && status.isNotEmpty) params['status'] = status;
      if (from != null && from.isNotEmpty) params['from'] = from;
      if (to != null && to.isNotEmpty) params['to'] = to;
      if (userPhone != null && userPhone.isNotEmpty) params['userPhone'] = userPhone;

      final uri = Uri.parse('$_base/api/rides').replace(queryParameters: params);
      final res = await http.get(uri, headers: await _authHeaders()).timeout(
            const Duration(seconds: 15),
            onTimeout: () => throw Exception('Timeout'),
          );
      if (res.statusCode != 200) return [];
      final data = json.decode(res.body) as Map<String, dynamic>?;
      final list = data?['rides'] as List<dynamic>? ?? [];
      return list.map((e) => Map<String, dynamic>.from(e as Map)).toList();
    } catch (_) {
      return [];
    }
  }
}
