import 'dart:convert';

import 'package:http/http.dart' as http;

import '../core/api_config.dart';
import 'package:tbidder_driver_app/services/profile_storage_service.dart';

/// Wallet API – driver prepaid recharge (manual, admin-approved).
class WalletApi {
  WalletApi({String? baseUrl}) : _baseUrl = baseUrl ?? kApiBaseUrl;

  final String _baseUrl;

  Future<Map<String, String>> _authHeaders({bool json = false}) async {
    final headers = <String, String>{};
    if (json) headers['Content-Type'] = 'application/json';
    final token = await ProfileStorageService.getAuthToken();
    if (token != null && token.trim().isNotEmpty) {
      headers['Authorization'] = 'Bearer ${token.trim()}';
    }
    return headers;
  }

  /// GET /api/wallet/balance?driverId=xxx – Returns effective balance (0 if credits expired). Credits valid 1 year.
  Future<int> getBalance(String driverId) async {
    final data = await getBalanceWithValidity(driverId);
    return data.$1;
  }

  Map<String, dynamic>? _parseJson(String body) {
    try {
      return jsonDecode(body) as Map<String, dynamic>?;
    } on FormatException {
      return null;
    }
  }

  /// GET /api/wallet/balance – Returns (effectiveBalance, creditsValidUntil).
  Future<(int balance, String? creditsValidUntil)> getBalanceWithValidity(String driverId) async {
    final uri = Uri.parse('$_baseUrl/api/v1/wallet/balance').replace(
      queryParameters: {'driverId': driverId},
    );
    final res = await http.get(uri, headers: await _authHeaders());
    if (res.statusCode != 200) return (0, null);
    final body = _parseJson(res.body);
    final balance = body?['balance'];
    int b = 0;
    if (balance is int) b = balance;
    if (balance is num) b = balance.toInt();
    final validUntil = body?['creditsValidUntil'] as String?;
    return (b, validUntil);
  }

  /// GET /api/wallet/transactions?driverId=xxx
  Future<List<Map<String, dynamic>>> getTransactions(String driverId) async {
    final uri = Uri.parse('$_baseUrl/api/v1/wallet/transactions').replace(
      queryParameters: {'driverId': driverId},
    );
    final res = await http.get(uri, headers: await _authHeaders());
    if (res.statusCode != 200) return [];
    final body = _parseJson(res.body);
    final list = body?['transactions'] as List<dynamic>? ?? [];
    return list.map((e) => Map<String, dynamic>.from(e as Map)).toList();
  }

  /// GET /api/wallet/scratch-status?driverId=xxx
  Future<({bool canScratch, String? lastScratchAt})> getScratchStatus(String driverId) async {
    final uri = Uri.parse('$_baseUrl/api/v1/wallet/scratch-status').replace(
      queryParameters: {'driverId': driverId},
    );
    final res = await http.get(uri, headers: await _authHeaders());
    if (res.statusCode != 200) return (canScratch: false, lastScratchAt: null);
    final body = _parseJson(res.body);
    final canScratch = body?['canScratch'] as bool? ?? false;
    final lastScratchAt = body?['lastScratchAt'] as String?;
    return (canScratch: canScratch, lastScratchAt: lastScratchAt);
  }

  /// POST /api/wallet/scratch-card – claim daily 1–10 credits.
  Future<({int credits, int newBalance})?> claimScratchCard(String driverId) async {
    final uri = Uri.parse('$_baseUrl/api/v1/wallet/scratch-card');
    final res = await http.post(
      uri,
      headers: await _authHeaders(json: true),
      body: jsonEncode({'driverId': driverId}),
    );
    final body = _parseJson(res.body);
    if (res.statusCode != 200) throw Exception(body?['message'] ?? body?['error'] ?? 'Failed');
    final credits = (body?['credits'] as num?)?.toInt() ?? 0;
    final newBalance = (body?['newBalance'] as num?)?.toInt() ?? 0;
    return (credits: credits, newBalance: newBalance);
  }

  /// POST /api/wallet/recharge
  Future<Map<String, dynamic>?> submitRecharge({
    required String driverId,
    required double amountSoles,
    required String transactionId,
    required String screenshotUrl,
  }) async {
    final uri = Uri.parse('$_baseUrl/api/v1/wallet/recharge');
    final res = await http.post(
      uri,
      headers: await _authHeaders(json: true),
      body: jsonEncode({
        'driverId': driverId,
        'amountSoles': amountSoles,
        'transactionId': transactionId,
        'screenshotUrl': screenshotUrl,
      }),
    );
    final body = _parseJson(res.body);
    if (body == null) {
      if (res.body.trim().startsWith('<')) {
        throw Exception('Backend not reachable. Run: cd backend && npm start');
      }
      throw Exception('Invalid server response');
    }
    if (res.statusCode == 201) return body;
    throw Exception(body['error'] ?? 'Failed to submit');
  }
}
