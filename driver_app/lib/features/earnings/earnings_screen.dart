import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:share_plus/share_plus.dart';
import 'package:tbidder_driver_app/core/app_theme.dart';
import 'package:tbidder_driver_app/l10n/app_locale.dart';
import 'package:tbidder_driver_app/services/earnings_service.dart';

class EarningsScreen extends StatefulWidget {
  const EarningsScreen({super.key});
  @override
  State<EarningsScreen> createState() => _EarningsScreenState();
}

class _EarningsScreenState extends State<EarningsScreen> {
  final EarningsService _earnings = EarningsService();
  String _range = 'today';
  DateTime? _customFrom;
  DateTime? _customTo;

  @override
  void initState() {
    super.initState();
    _earnings.load().then((_) {
      if (mounted) setState(() {});
    });
  }

  (DateTime, DateTime) _getRange() {
    final now = DateTime.now();
    final todayStart = DateTime(now.year, now.month, now.day);
    switch (_range) {
      case 'today':
        return (todayStart, now);
      case 'week':
        final weekStart = todayStart.subtract(Duration(days: now.weekday - 1));
        return (weekStart, now);
      case 'month':
        final monthStart = DateTime(now.year, now.month, 1);
        return (monthStart, now);
      case 'custom':
        final from = _customFrom ?? todayStart;
        var to = _customTo ?? now;
        final limit = from.add(const Duration(days: 92));
        if (to.isAfter(limit)) to = limit;
        return (from, to);
      default:
        return (todayStart, now);
    }
  }

  Future<List<EarningsRecord>> _getRecords() async {
    final (start, end) = _getRange();
    return _earnings.getInRange(start, end);
  }

  Future<void> _exportPdf() async {
    final records = await _getRecords();
    final rows = EarningsService.withRunningBalance(records);
    if (rows.isEmpty) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(AppLocaleScope.of(context)?.t('today') ?? 'No data for selected range'), backgroundColor: Colors.orange),
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
              0: const pw.FlexColumnWidth(2),
              1: const pw.FlexColumnWidth(2),
              2: const pw.FlexColumnWidth(2),
              3: const pw.FlexColumnWidth(2),
              4: const pw.FlexColumnWidth(2),
            },
            children: [
              pw.TableRow(
                decoration: const pw.BoxDecoration(color: PdfColors.grey300),
                children: [
                  pw.Padding(padding: const pw.EdgeInsets.all(4), child: pw.Text('Date', style: pw.TextStyle(fontWeight: pw.FontWeight.bold))),
                  pw.Padding(padding: const pw.EdgeInsets.all(4), child: pw.Text('Time', style: pw.TextStyle(fontWeight: pw.FontWeight.bold))),
                  pw.Padding(padding: const pw.EdgeInsets.all(4), child: pw.Text('Amount (S/)', style: pw.TextStyle(fontWeight: pw.FontWeight.bold))),
                  pw.Padding(padding: const pw.EdgeInsets.all(4), child: pw.Text('Credit Balance (S/)', style: pw.TextStyle(fontWeight: pw.FontWeight.bold))),
                  pw.Padding(padding: const pw.EdgeInsets.all(4), child: pw.Text('Closing Balance (S/)', style: pw.TextStyle(fontWeight: pw.FontWeight.bold))),
                ],
              ),
              ...rows.map((r) {
                final d = r['date'] as DateTime;
                return pw.TableRow(
                  children: [
                    pw.Padding(padding: const pw.EdgeInsets.all(4), child: pw.Text('${d.day}/${d.month}/${d.year}')),
                    pw.Padding(padding: const pw.EdgeInsets.all(4), child: pw.Text('${d.hour.toString().padLeft(2, '0')}:${d.minute.toString().padLeft(2, '0')}')),
                    pw.Padding(padding: const pw.EdgeInsets.all(4), child: pw.Text('S/ ${(r['amount'] as num).toStringAsFixed(2)}')),
                    pw.Padding(padding: const pw.EdgeInsets.all(4), child: pw.Text('S/ ${(r['creditBalance'] as num).toStringAsFixed(2)}')),
                    pw.Padding(padding: const pw.EdgeInsets.all(4), child: pw.Text('S/ ${(r['closingBalance'] as num).toStringAsFixed(2)}')),
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
      [XFile.fromData(pdfBytes, name: 'TransportBidder_earnings_${DateTime.now().millisecondsSinceEpoch}.pdf', mimeType: 'application/pdf')],
      text: 'TransportBidder earnings statement',
    );
    }
  }

  Future<void> _exportCsv() async {
    final records = await _getRecords();
    final rows = EarningsService.withRunningBalance(records);
    if (rows.isEmpty) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(AppLocaleScope.of(context)?.t('today') ?? 'No data'), backgroundColor: Colors.orange),
      );
      }
      return;
    }
    final sb = StringBuffer();
    sb.writeln('Date,Time,Amount (S/),Credit Balance (S/),Closing Balance (S/)');
    for (final r in rows) {
      final d = r['date'] as DateTime;
      sb.writeln('${d.day}/${d.month}/${d.year},${d.hour.toString().padLeft(2, '0')}:${d.minute.toString().padLeft(2, '0')},${(r['amount'] as num).toStringAsFixed(2)},${(r['creditBalance'] as num).toStringAsFixed(2)},${(r['closingBalance'] as num).toStringAsFixed(2)}');
    }
    final csvBytes = utf8.encode(sb.toString());
    if (mounted) {
      await Share.shareXFiles(
      [XFile.fromData(csvBytes, name: 'TransportBidder_earnings_${DateTime.now().millisecondsSinceEpoch}.csv', mimeType: 'text/csv')],
      text: 'TransportBidder earnings (open in Excel)',
    );
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = AppLocaleScope.of(context)?.t ?? (String k, [Map<String, dynamic>? p]) => translate(k, defaultLocale, p);
    return Scaffold(
      backgroundColor: AppTheme.surfaceDark,
      appBar: AppBar(
        backgroundColor: AppTheme.surfaceDark,
        foregroundColor: AppTheme.onDark,
        title: Text(t('drawer_earnings')),
      ),
      body: ListView(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
        children: [
          Text(t('download_statement'), style: GoogleFonts.poppins(fontSize: 16, fontWeight: FontWeight.w600, color: AppTheme.onDark)),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _chip('today', t('today')),
              _chip('week', t('this_week')),
              _chip('month', t('month')),
              _chip('custom', t('custom')),
            ],
          ),
          if (_range == 'custom') ...[
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(child: OutlinedButton.icon(
                  onPressed: () async {
                    final d = await showDatePicker(context: context, initialDate: _customFrom ?? DateTime.now(), firstDate: DateTime.now().subtract(const Duration(days: 92)), lastDate: DateTime.now());
                    if (d != null && mounted) setState(() => _customFrom = d);
                  },
                  icon: const Icon(Icons.calendar_today, size: 18),
                  label: Text(_customFrom != null ? '${_customFrom!.day}/${_customFrom!.month}/${_customFrom!.year}' : t('from_date')),
                  style: OutlinedButton.styleFrom(foregroundColor: AppTheme.onDark),
                )),
                const SizedBox(width: 8),
                Expanded(child: OutlinedButton.icon(
                  onPressed: () async {
                    final d = await showDatePicker(context: context, initialDate: _customTo ?? DateTime.now(), firstDate: _customFrom ?? DateTime.now().subtract(const Duration(days: 92)), lastDate: DateTime.now());
                    if (d != null && mounted) setState(() => _customTo = d);
                  },
                  icon: const Icon(Icons.calendar_today, size: 18),
                  label: Text(_customTo != null ? '${_customTo!.day}/${_customTo!.month}/${_customTo!.year}' : t('to_date')),
                  style: OutlinedButton.styleFrom(foregroundColor: AppTheme.onDark),
                )),
              ],
            ),
            Text(t('max_3_months'), style: GoogleFonts.poppins(fontSize: 11, color: Colors.grey.shade400)),
          ],
          const SizedBox(height: 20),
          Row(
            children: [
              Expanded(
                child: FilledButton.icon(
                  onPressed: _exportPdf,
                  style: FilledButton.styleFrom(backgroundColor: Colors.red.shade700),
                  icon: const Icon(Icons.picture_as_pdf, size: 22),
                  label: Text(t('download_pdf'), style: GoogleFonts.poppins(fontWeight: FontWeight.w600)),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: FilledButton.icon(
                  onPressed: _exportCsv,
                  style: FilledButton.styleFrom(backgroundColor: Colors.green.shade700),
                  icon: const Icon(Icons.table_chart, size: 22),
                  label: Text(t('download_excel'), style: GoogleFonts.poppins(fontWeight: FontWeight.w600)),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _chip(String value, String label) {
    final selected = _range == value;
    return FilterChip(
      label: Text(label, style: GoogleFonts.poppins(fontSize: 12)),
      selected: selected,
      onSelected: (v) => setState(() => _range = value),
      selectedColor: AppTheme.neonOrange.withValues(alpha: 0.3),
      checkmarkColor: AppTheme.neonOrange,
    );
  }
}

