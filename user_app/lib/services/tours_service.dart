import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:tbidder_user_app/core/api_config.dart';

/// Tours (Attractions) API – list, detail, create booking.
class ToursService {
  String get _base => '${kApiBaseUrl.replaceFirst(RegExp(r'/$'), '')}/api/tours';

  /// GET /api/tours – list approved tours. Optional: country, city, category, q
  Future<Map<String, dynamic>> list({String? country, String? city, String? category, String? q}) async {
    final query = <String, String>{};
    if (country != null && country.isNotEmpty) query['country'] = country;
    if (city != null && city.isNotEmpty) query['city'] = city;
    if (category != null && category.isNotEmpty) query['category'] = category;
    if (q != null && q.trim().isNotEmpty) query['q'] = q.trim();
    final uri = query.isEmpty ? Uri.parse(_base) : Uri.parse(_base).replace(queryParameters: query);
    final r = await http.get(uri);
    if (r.statusCode != 200) {
      throw Exception('Tours list failed: ${r.statusCode}');
    }
    return jsonDecode(r.body) as Map<String, dynamic>;
  }

  /// GET /api/tours/feature-flag
  Future<bool> isAttractionsEnabled() async {
    try {
      final r = await http.get(Uri.parse('$_base/feature-flag'));
      if (r.statusCode != 200) return false;
      final data = jsonDecode(r.body) as Map<String, dynamic>;
      return data['attractionsEnabled'] == true;
    } catch (_) {
      return false;
    }
  }

  /// GET /api/tours/:id – tour detail
  Future<Map<String, dynamic>> getDetail(String tourId) async {
    final r = await http.get(Uri.parse('$_base/$tourId'));
    if (r.statusCode == 404) throw Exception('Tour not found');
    if (r.statusCode != 200) throw Exception('Tour detail failed: ${r.statusCode}');
    return jsonDecode(r.body) as Map<String, dynamic>;
  }

  /// POST /api/tours/bookings – create booking, returns redirectUrl for payment
  Future<Map<String, dynamic>> createBooking({
    required String tourId,
    required String tourSlotId,
    required String paxOptionId,
    required int paxCount,
    required String guestName,
    required String guestEmail,
    String? guestPhone,
    String? guestWhatsApp,
    String? specialInstructions,
    String? preferredLanguage,
    String? meetingPoint,
    String? successUrl,
    String? backUrl,
  }) async {
    final body = {
      'tourId': tourId,
      'tourSlotId': tourSlotId,
      'paxOptionId': paxOptionId,
      'paxCount': paxCount,
      'guestName': guestName.trim(),
      'guestEmail': guestEmail.trim(),
      if (guestPhone != null && guestPhone.trim().isNotEmpty) 'guestPhone': guestPhone.trim(),
      if (guestWhatsApp != null && guestWhatsApp.trim().isNotEmpty) 'guestWhatsApp': guestWhatsApp.trim(),
      if (specialInstructions != null && specialInstructions.trim().isNotEmpty) 'specialInstructions': specialInstructions.trim(),
      if (preferredLanguage != null && preferredLanguage.trim().isNotEmpty) 'preferredLanguage': preferredLanguage.trim(),
      if (meetingPoint != null && meetingPoint.trim().isNotEmpty) 'meetingPoint': meetingPoint.trim(),
      if (successUrl != null && successUrl.isNotEmpty) 'successUrl': successUrl,
      if (backUrl != null && backUrl.isNotEmpty) 'backUrl': backUrl,
    };
    final r = await http.post(
      Uri.parse('$_base/bookings'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode(body),
    );
    final data = jsonDecode(r.body) as Map<String, dynamic>;
    if (r.statusCode == 503) {
      throw Exception(data['message'] ?? data['error'] ?? 'Payment not configured');
    }
    if (r.statusCode == 400 || r.statusCode == 404) {
      throw Exception(data['error'] ?? 'Booking failed');
    }
    if (r.statusCode != 201) {
      throw Exception(data['error'] ?? 'Booking failed: ${r.statusCode}');
    }
    return data;
  }
}
