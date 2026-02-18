import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

const String _kEarningsKey = 'driver_earnings';

/// Single earnings record (one completed ride).
class EarningsRecord {
  const EarningsRecord({
    required this.rideId,
    required this.amount,
    required this.completedAt,
  });

  final String rideId;
  final double amount;
  final DateTime completedAt;

  Map<String, dynamic> toJson() => {
        'rideId': rideId,
        'amount': amount,
        'completedAt': completedAt.toIso8601String(),
      };

  static EarningsRecord fromJson(Map<String, dynamic> json) {
    return EarningsRecord(
      rideId: json['rideId'] as String? ?? '',
      amount: (json['amount'] as num?)?.toDouble() ?? 0.0,
      completedAt: DateTime.tryParse(json['completedAt'] as String? ?? '') ?? DateTime.now(),
    );
  }
}

/// Load/save driver earnings locally (SharedPreferences).
class EarningsService {
  Future<List<EarningsRecord>> load() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_kEarningsKey);
    if (raw == null || raw.isEmpty) return [];
    try {
      final list = json.decode(raw) as List<dynamic>? ?? [];
      return list.map((e) => EarningsRecord.fromJson(Map<String, dynamic>.from(e as Map))).toList();
    } catch (_) {
      return [];
    }
  }

  Future<void> add(EarningsRecord record) async {
    final list = await load();
    if (list.any((e) => e.rideId == record.rideId)) return;
    list.add(record);
    list.sort((a, b) => a.completedAt.compareTo(b.completedAt));
    await _save(list);
  }

  Future<void> _save(List<EarningsRecord> list) async {
    final prefs = await SharedPreferences.getInstance();
    final raw = json.encode(list.map((e) => e.toJson()).toList());
    await prefs.setString(_kEarningsKey, raw);
  }

  /// Total earning (all time).
  Future<double> totalEarning() async {
    final list = await load();
    return list.fold<double>(0.0, (sum, e) => sum + e.amount);
  }

  /// Today's earning.
  Future<double> todayEarning() async {
    final list = await load();
    final now = DateTime.now();
    final todayStart = DateTime(now.year, now.month, now.day);
    return list
        .where((e) => e.completedAt.isAfter(todayStart) || e.completedAt.isAtSameMomentAs(todayStart))
        .fold<double>(0.0, (sum, e) => sum + e.amount);
  }

  /// Records in date range [start, end] (inclusive of day). Max 3 months.
  Future<List<EarningsRecord>> getInRange(DateTime start, DateTime end) async {
    final list = await load();
    final startDay = DateTime(start.year, start.month, start.day);
    var endDay = DateTime(end.year, end.month, end.day, 23, 59, 59);
    final limit = startDay.add(const Duration(days: 92)); // ~3 months
    if (endDay.isAfter(limit)) endDay = limit;
    return list
        .where((e) =>
            !e.completedAt.isBefore(startDay) && !e.completedAt.isAfter(endDay))
        .toList()
      ..sort((a, b) => a.completedAt.compareTo(b.completedAt));
  }

  /// Running balance: each record gets creditBalance (before) and closingBalance (after).
  static List<Map<String, dynamic>> withRunningBalance(List<EarningsRecord> records) {
    double running = 0.0;
    final out = <Map<String, dynamic>>[];
    for (final r in records) {
      out.add({
        'rideId': r.rideId,
        'date': r.completedAt,
        'amount': r.amount,
        'creditBalance': running,
        'closingBalance': running + r.amount,
      });
      running += r.amount;
    }
    return out;
  }
}
