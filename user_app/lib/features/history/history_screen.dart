import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:share_plus/share_plus.dart';
import 'package:tbidder_user_app/core/app_brand.dart';
import 'package:tbidder_user_app/core/app_theme.dart';
import 'package:tbidder_user_app/l10n/app_locale.dart';
import 'package:tbidder_user_app/services/history_service.dart';

const Color _kNeonOrange = Color(0xFFFF6700);

class HistoryScreen extends StatefulWidget {
  const HistoryScreen({super.key});

  @override
  State<HistoryScreen> createState() => _HistoryScreenState();
}

class _HistoryScreenState extends State<HistoryScreen> {
  final HistoryService _historyService = HistoryService();
  List<Map<String, dynamic>> _rides = [];
  bool _loading = true;
  String _filterStatus = 'all'; // all | completed | pending | accepted
  DateTime? _filterFrom;
  DateTime? _filterTo;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final status = _filterStatus == 'all' ? null : _filterStatus;
    final from = _filterFrom != null
        ? '${_filterFrom!.year}-${_filterFrom!.month.toString().padLeft(2, '0')}-${_filterFrom!.day.toString().padLeft(2, '0')}'
        : null;
    final to = _filterTo != null
        ? '${_filterTo!.year}-${_filterTo!.month.toString().padLeft(2, '0')}-${_filterTo!.day.toString().padLeft(2, '0')}'
        : null;
    final list = await _historyService.getRideHistory(
      status: status,
      from: from,
      to: to,
    );
    if (mounted) {
      setState(() {
      _rides = list;
      _loading = false;
    });
    }
  }

  String _formatDate(dynamic val) {
    if (val == null) return '-';
    try {
      final d = val is DateTime ? val : DateTime.tryParse(val.toString());
      return d != null ? '${d.day}/${d.month}/${d.year}' : '-';
    } catch (_) {
      return '-';
    }
  }

  String _statusLabel(String? s) {
    switch (s) {
      case 'completed':
        return 'Completed';
      case 'pending':
        return 'Pending';
      case 'accepted':
      case 'driver_arrived':
      case 'ride_started':
        return 'In progress';
      case 'declined':
        return 'Declined';
      default:
        return s ?? '-';
    }
  }

  Future<void> _exportPdf() async {
    if (_rides.isEmpty) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(_t('no_rides_to_export')), backgroundColor: Colors.orange),
      );
      }
      return;
    }
    final pdf = pw.Document();
    pdf.addPage(
      pw.Page(
        pageFormat: PdfPageFormat.a4,
        build: (pw.Context ctx) {
          return pw.Table(
            border: pw.TableBorder.all(width: 0.5),
            columnWidths: {
              0: const pw.FlexColumnWidth(1.5),
              1: const pw.FlexColumnWidth(1.5),
              2: const pw.FlexColumnWidth(2),
              3: const pw.FlexColumnWidth(2),
              4: const pw.FlexColumnWidth(1.2),
              5: const pw.FlexColumnWidth(1.2),
            },
            children: [
              pw.TableRow(
                decoration: const pw.BoxDecoration(color: PdfColors.grey300),
                children: [
                  pw.Padding(padding: const pw.EdgeInsets.all(4), child: pw.Text('Date', style: pw.TextStyle(fontWeight: pw.FontWeight.bold))),
                  pw.Padding(padding: const pw.EdgeInsets.all(4), child: pw.Text('Time', style: pw.TextStyle(fontWeight: pw.FontWeight.bold))),
                  pw.Padding(padding: const pw.EdgeInsets.all(4), child: pw.Text('From', style: pw.TextStyle(fontWeight: pw.FontWeight.bold))),
                  pw.Padding(padding: const pw.EdgeInsets.all(4), child: pw.Text('To', style: pw.TextStyle(fontWeight: pw.FontWeight.bold))),
                  pw.Padding(padding: const pw.EdgeInsets.all(4), child: pw.Text('Service', style: pw.TextStyle(fontWeight: pw.FontWeight.bold))),
                  pw.Padding(padding: const pw.EdgeInsets.all(4), child: pw.Text('Price (S/)', style: pw.TextStyle(fontWeight: pw.FontWeight.bold))),
                ],
              ),
              ..._rides.map((r) {
                final createdAt = r['createdAt'];
                DateTime? d;
                try {
                  d = createdAt is DateTime ? createdAt : DateTime.tryParse(createdAt?.toString() ?? '');
                } catch (_) {}
                return pw.TableRow(
                  children: [
                    pw.Padding(padding: const pw.EdgeInsets.all(4), child: pw.Text(d != null ? '${d.day}/${d.month}/${d.year}' : '-', style: const pw.TextStyle(fontSize: 9))),
                    pw.Padding(padding: const pw.EdgeInsets.all(4), child: pw.Text(d != null ? '${d.hour.toString().padLeft(2, '0')}:${d.minute.toString().padLeft(2, '0')}' : '-', style: const pw.TextStyle(fontSize: 9))),
                    pw.Padding(padding: const pw.EdgeInsets.all(4), child: pw.Text((r['pickupAddress'] as String? ?? '-').toString().length > 40 ? '${(r['pickupAddress'] as String).substring(0, 40)}...' : (r['pickupAddress'] as String? ?? '-'), style: const pw.TextStyle(fontSize: 9))),
                    pw.Padding(padding: const pw.EdgeInsets.all(4), child: pw.Text((r['dropAddress'] as String? ?? '-').toString().length > 40 ? '${(r['dropAddress'] as String).substring(0, 40)}...' : (r['dropAddress'] as String? ?? '-'), style: const pw.TextStyle(fontSize: 9))),
                    pw.Padding(padding: const pw.EdgeInsets.all(4), child: pw.Text(r['vehicleType'] as String? ?? '-', style: const pw.TextStyle(fontSize: 9))),
                    pw.Padding(padding: const pw.EdgeInsets.all(4), child: pw.Text('S/ ${((r['userPrice'] ?? r['counterPrice'] ?? 0) as num).toStringAsFixed(2)}', style: const pw.TextStyle(fontSize: 9))),
                  ],
                );
              }),
            ],
          );
        },
      ),
    );
    final pdfBytes = await pdf.save();
    if (mounted) {
      await Share.shareXFiles(
        [XFile.fromData(pdfBytes, name: 'TBidder_ride_history_${DateTime.now().millisecondsSinceEpoch}.pdf', mimeType: 'application/pdf')],
        text: 'TBidder ride history',
      );
    }
  }

  Future<void> _exportExcel() async {
    if (_rides.isEmpty) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(_t('no_rides_to_export')), backgroundColor: Colors.orange),
      );
      }
      return;
    }
    final sb = StringBuffer();
    sb.writeln('Date,Time,From,To,Service,Price (S/),Status');
    for (final r in _rides) {
      final createdAt = r['createdAt'];
      DateTime? d;
      try {
        d = createdAt is DateTime ? createdAt : DateTime.tryParse(createdAt?.toString() ?? '');
      } catch (_) {}
      final price = (r['userPrice'] ?? r['counterPrice'] ?? 0) as num;
      final from = (r['pickupAddress'] as String? ?? '').replaceAll(',', ' ');
      final to = (r['dropAddress'] as String? ?? '').replaceAll(',', ' ');
      sb.writeln('${d != null ? '${d.day}/${d.month}/${d.year}' : '-'},${d != null ? '${d.hour.toString().padLeft(2, '0')}:${d.minute.toString().padLeft(2, '0')}' : '-'},$from,$to,${r['vehicleType'] ?? '-'},${price.toStringAsFixed(2)},${r['status'] ?? '-'}');
    }
    final csvBytes = utf8.encode(sb.toString());
    if (mounted) {
      await Share.shareXFiles(
        [XFile.fromData(csvBytes, name: 'TBidder_ride_history_${DateTime.now().millisecondsSinceEpoch}.csv', mimeType: 'text/csv')],
        text: 'TBidder ride history (open in Excel)',
      );
    }
  }

  String _t(String key, [Map<String, dynamic>? params]) {
    final scope = AppLocaleScope.of(context);
    return scope?.t(key, params) ?? translate(key, defaultLocale, params);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        title: Text(_t('drawer_history'), style: GoogleFonts.poppins(fontSize: 18, fontWeight: FontWeight.w600, color: _kNeonOrange)),
        leading: IconButton(icon: const Icon(Icons.arrow_back, color: _kNeonOrange), onPressed: () => Navigator.pop(context)),
        backgroundColor: Colors.white,
        elevation: 0,
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(_t('ride_history_title'), style: GoogleFonts.poppins(fontSize: 18, fontWeight: FontWeight.w700, color: Colors.black87)),
              const SizedBox(height: 4),
              Text(_t('ride_history_subtitle'), style: GoogleFonts.poppins(fontSize: 13, color: Colors.grey.shade600)),
              const SizedBox(height: 16),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  FilterChip(
                    label: Text(_t('filter_all')),
                    selected: _filterStatus == 'all',
                    onSelected: (_) => setState(() { _filterStatus = 'all'; _load(); }),
                    selectedColor: _kNeonOrange.withOpacity(0.2),
                  ),
                  FilterChip(
                    label: Text(_t('filter_completed')),
                    selected: _filterStatus == 'completed',
                    onSelected: (_) => setState(() { _filterStatus = 'completed'; _load(); }),
                    selectedColor: _kNeonOrange.withOpacity(0.2),
                  ),
                  FilterChip(
                    label: Text(_t('filter_pending')),
                    selected: _filterStatus == 'pending',
                    onSelected: (_) => setState(() { _filterStatus = 'pending'; _load(); }),
                    selectedColor: _kNeonOrange.withOpacity(0.2),
                  ),
                  FilterChip(
                    label: Text(_t('filter_date_range')),
                    selected: _filterFrom != null || _filterTo != null,
                    onSelected: (_) async {
                      final from = await showDatePicker(
                        context: context,
                        initialDate: _filterFrom ?? DateTime.now().subtract(const Duration(days: 30)),
                        firstDate: DateTime.now().subtract(const Duration(days: 365)),
                        lastDate: DateTime.now(),
                      );
                      if (from != null && mounted) {
                        final to = await showDatePicker(
                          context: context,
                          initialDate: _filterTo ?? DateTime.now(),
                          firstDate: from,
                          lastDate: DateTime.now(),
                        );
                        if (to != null && mounted) setState(() { _filterFrom = from; _filterTo = to; _load(); });
                      }
                    },
                    selectedColor: _kNeonOrange.withOpacity(0.2),
                  ),
                  if (_filterFrom != null || _filterTo != null)
                    ActionChip(
                      avatar: const Icon(Icons.clear, size: 18, color: Colors.grey),
                      label: Text(_t('clear_filter')),
                      onPressed: () => setState(() { _filterFrom = null; _filterTo = null; _load(); }),
                    ),
                ],
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: FilledButton.icon(
                      onPressed: _rides.isEmpty ? null : _exportPdf,
                      style: FilledButton.styleFrom(backgroundColor: Colors.red.shade700),
                      icon: const Icon(Icons.picture_as_pdf, size: 20),
                      label: Text(_t('download_pdf'), style: GoogleFonts.poppins(fontSize: 13, fontWeight: FontWeight.w600)),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: FilledButton.icon(
                      onPressed: _rides.isEmpty ? null : _exportExcel,
                      style: FilledButton.styleFrom(backgroundColor: Colors.green.shade700),
                      icon: const Icon(Icons.table_chart, size: 20),
                      label: Text(_t('download_excel'), style: GoogleFonts.poppins(fontSize: 13, fontWeight: FontWeight.w600)),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              if (_loading)
                const Expanded(child: Center(child: CircularProgressIndicator(color: _kNeonOrange)))
              else if (_rides.isEmpty)
                Expanded(
                  child: Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.history, size: 64, color: Colors.grey.shade400),
                        const SizedBox(height: 16),
                        Text(_t('no_rides_yet'), style: GoogleFonts.poppins(fontSize: 16, color: Colors.grey.shade600)),
                      ],
                    ),
                  ),
                )
              else
                Expanded(
                  child: ListView.builder(
                    itemCount: _rides.length,
                    itemBuilder: (context, i) {
                      final r = _rides[i];
                      final price = (r['userPrice'] ?? r['counterPrice'] ?? 0) as num;
                      return Card(
                        margin: const EdgeInsets.only(bottom: 8),
                        elevation: 2,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        child: ListTile(
                          contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                          leading: CircleAvatar(
                            backgroundColor: _kNeonOrange.withOpacity(0.2),
                            child: Icon(_vehicleIcon(r['vehicleType']), color: _kNeonOrange, size: 24),
                          ),
                          title: Text(
                            r['pickupAddress'] as String? ?? '-',
                            style: GoogleFonts.poppins(fontSize: 14, fontWeight: FontWeight.w600),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          subtitle: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const SizedBox(height: 4),
                              Row(children: [Icon(Icons.flag, size: 14, color: Colors.red.shade400), const SizedBox(width: 4), Expanded(child: Text(r['dropAddress'] as String? ?? '-', style: GoogleFonts.poppins(fontSize: 12), maxLines: 1, overflow: TextOverflow.ellipsis))]),
                              const SizedBox(height: 4),
                              Row(
                                children: [
                                  Text(_formatDate(r['createdAt']), style: GoogleFonts.poppins(fontSize: 11, color: Colors.grey.shade600)),
                                  const SizedBox(width: 8),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                    decoration: BoxDecoration(color: _statusColor(r['status']).withOpacity(0.2), borderRadius: BorderRadius.circular(6)),
                                    child: Text(_statusLabel(r['status']), style: GoogleFonts.poppins(fontSize: 10, fontWeight: FontWeight.w600, color: _statusColor(r['status']))),
                                  ),
                                ],
                              ),
                            ],
                          ),
                          trailing: Text('S/ ${price.toStringAsFixed(2)}', style: GoogleFonts.poppins(fontSize: 16, fontWeight: FontWeight.w700, color: _kNeonOrange)),
                        ),
                      );
                    },
                  ),
                ),
              Center(child: Text(kAppName, style: GoogleFonts.poppins(fontSize: 12, fontWeight: FontWeight.w600, color: AppTheme.textDark))),
              const SizedBox(height: 16),
            ],
          ),
        ),
      ),
    );
  }

  IconData _vehicleIcon(String? type) {
    if (type == null) return Icons.directions_car;
    final t = type.toLowerCase();
    if (t.contains('taxi') || t.contains('car')) return Icons.local_taxi;
    if (t.contains('truck')) return Icons.local_shipping;
    if (t.contains('moto') || t.contains('bike')) return Icons.two_wheeler;
    if (t.contains('ambulance')) return Icons.medical_services;
    if (t.contains('delivery')) return Icons.inventory_2;
    return Icons.directions_car;
  }

  Color _statusColor(String? s) {
    switch (s) {
      case 'completed':
        return Colors.green;
      case 'pending':
        return Colors.orange;
      case 'declined':
        return Colors.red;
      default:
        return Colors.blue;
    }
  }
}
