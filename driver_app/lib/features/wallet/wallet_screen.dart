import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:image_picker/image_picker.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:tbidder_driver_app/core/app_theme.dart';
import 'package:tbidder_driver_app/l10n/app_locale.dart';
import 'package:tbidder_driver_app/services/wallet_api.dart';

const String _kDriverIdKey = 'driver_on_duty_id';
const String _kBankDetails = 'Banco de Crédito del Perú\nCCI: 002-193-00000000000000-00\nCuenta: 193-12345678-0-01';

class WalletScreen extends StatefulWidget {
  const WalletScreen({super.key, this.focusRecharge = false});

  // Bug fix: allow direct scroll to recharge section from approved popup.
  final bool focusRecharge;

  @override
  State<WalletScreen> createState() => _WalletScreenState();
}

class _WalletScreenState extends State<WalletScreen> {
  final WalletApi _walletApi = WalletApi();
  final TextEditingController _amountController = TextEditingController();
  final TextEditingController _transactionIdController = TextEditingController();

  String? _driverId;
  int _balance = 0;
  String? _creditsValidUntil; // YYYY-MM-DD – credits valid 1 year from last recharge
  List<Map<String, dynamic>> _transactions = [];
  bool _loading = true;
  bool _submitting = false;
  String? _screenshotBase64;
  Uint8List? _screenshotBytes; // For display on web (Image.file not supported)
  final GlobalKey _rechargeSectionKey = GlobalKey();

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  @override
  void dispose() {
    _amountController.dispose();
    _transactionIdController.dispose();
    super.dispose();
  }

  Future<void> _loadData() async {
    final prefs = await SharedPreferences.getInstance();
    final id = prefs.getString(_kDriverIdKey);
    setState(() => _driverId = id);
    if (id == null) {
      setState(() => _loading = false);

      return;
    }
    try {
      final (balance, validUntil) = await _walletApi.getBalanceWithValidity(id);
      final txList = await _walletApi.getTransactions(id);
      if (mounted) {
        setState(() {
        _balance = balance;
        _creditsValidUntil = validUntil;
        _transactions = txList;
        _loading = false;
      });
      }

      if (mounted && widget.focusRecharge) {
        // Bug fix: auto-focus recharge form after approved dialog.
        WidgetsBinding.instance.addPostFrameCallback((_) => _scrollToRechargeSection(context));
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _loadBalance() => _loadData();

  void _scrollToRechargeSection(BuildContext context) {
    final box = _rechargeSectionKey.currentContext?.findRenderObject() as RenderBox?;
    if (box != null && box.hasSize) {
      Scrollable.ensureVisible(
        _rechargeSectionKey.currentContext!,
        duration: const Duration(milliseconds: 400),
        curve: Curves.easeInOut,
      );
    }
  }

  /// Days until expiry (negative if past). null if no date.
  int? _daysUntilExpiry() {
    if (_creditsValidUntil == null || _creditsValidUntil!.isEmpty) return null;
    final end = DateTime.tryParse(_creditsValidUntil!);
    if (end == null) return null;
    final today = DateTime.now();
    final normalizedEnd = DateTime(end.year, end.month, end.day);
    final normalizedToday = DateTime(today.year, today.month, today.day);
    return normalizedEnd.difference(normalizedToday).inDays;
  }

  Widget _buildExpiryRow() {
    final days = _daysUntilExpiry();
    if (days == null) return const SizedBox.shrink();
    final isExpired = days < 0;
    final isWarning = !isExpired && days < 7;
    Color textColor = Colors.grey.shade500;
    IconData icon = Icons.event_available;
    String text;
    if (isExpired) {
      textColor = Colors.red.shade300;
      icon = Icons.event_busy;
      final d = DateTime.tryParse(_creditsValidUntil!);
      text = _t('wallet_expired_on', {'date': d != null ? '${d.day}/${d.month}/${d.year}' : _creditsValidUntil!});
    } else if (isWarning) {
      textColor = Colors.orange.shade300;
      icon = Icons.warning_amber_rounded;
      text = days <= 1 ? _t('wallet_expires_soon') : _t('wallet_expires_in_days', {'count': '$days'});
    } else {
      text = _t('wallet_expires_in_days', {'count': '$days'});
    }
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Icon(icon, size: 18, color: textColor),
        const SizedBox(width: 8),
        Text(
          text,
          style: GoogleFonts.poppins(fontSize: 13, fontWeight: FontWeight.w500, color: textColor),
        ),
      ],
    );
  }

  String _t(String key, [Map<String, dynamic>? params]) {
    final scope = AppLocaleScope.of(context);
    return scope?.t(key, params) ?? translate(key, defaultLocale, params);
  }

  Future<void> _pickScreenshot() async {
    final picker = ImagePicker();
    final x = await picker.pickImage(
      source: ImageSource.gallery,
      maxWidth: 600,
      imageQuality: 50,
    );
    if (x != null && mounted) {
      final bytes = await x.readAsBytes();
      final base64 = base64Encode(bytes);
      setState(() {
        _screenshotBase64 = 'data:image/jpeg;base64,$base64';
        _screenshotBytes = bytes; // For display on web (Image.file not supported)
      });
    }
  }

  Future<void> _copyBankDetails() async {
    await Clipboard.setData(const ClipboardData(text: _kBankDetails));
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(_t('wallet_copied'), style: GoogleFonts.poppins()),
          backgroundColor: AppTheme.neonOrange,
        ),
      );
    }
  }

  Future<void> _submit() async {
    final driverId = _driverId;
    if (driverId == null || driverId.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(_t('wallet_go_online_first'), style: GoogleFonts.poppins()),
          backgroundColor: Colors.orange,
        ),
      );
      return;
    }

    final amountText = _amountController.text.trim();
    final amount = double.tryParse(amountText);
    final transactionId = _transactionIdController.text.trim();

    if (amount == null || amount <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(_t('wallet_fill_all'), style: GoogleFonts.poppins()),
          backgroundColor: Colors.orange,
        ),
      );
      return;
    }

    if (transactionId.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(_t('wallet_fill_all'), style: GoogleFonts.poppins()),
          backgroundColor: Colors.orange,
        ),
      );
      return;
    }

    if (_screenshotBase64 == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(_t('wallet_fill_all'), style: GoogleFonts.poppins()),
          backgroundColor: Colors.orange,
        ),
      );
      return;
    }

    setState(() => _submitting = true);
    try {
      await _walletApi.submitRecharge(
        driverId: driverId,
        amountSoles: amount,
        transactionId: transactionId,
        screenshotUrl: _screenshotBase64!,
      );
      if (!mounted) return;
      _amountController.clear();
      _transactionIdController.clear();
      setState(() { _screenshotBase64 = null; _screenshotBytes = null; });
      await _loadBalance();
      await showDialog<void>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: Text(_t('wallet_submit'), style: GoogleFonts.poppins(fontWeight: FontWeight.w700)),
          content: Text(
            _t('wallet_submit_success'),
            style: GoogleFonts.poppins(fontSize: 16),
          ),
          actions: [
            FilledButton(
              onPressed: () => Navigator.pop(ctx),
              style: FilledButton.styleFrom(backgroundColor: AppTheme.neonOrange),
              child: Text(_t('close'), style: GoogleFonts.poppins(fontWeight: FontWeight.w600)),
            ),
          ],
        ),
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('$e', style: GoogleFonts.poppins()),
            backgroundColor: Colors.red,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.darkBg,
      appBar: AppBar(
        title: Text(_t('drawer_wallet'), style: GoogleFonts.poppins(fontWeight: FontWeight.w700)),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _loading ? null : () { setState(() => _loading = true); _loadData(); },
            tooltip: 'Refresh',
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _loadData,
        color: AppTheme.neonOrange,
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Primary: Balance (main visual)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 28),
              decoration: BoxDecoration(
                color: AppTheme.surfaceDark,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: AppTheme.neonOrange.withValues(alpha: 0.6), width: 2),
                boxShadow: [
                  BoxShadow(
                    color: AppTheme.neonOrange.withValues(alpha: 0.15),
                    blurRadius: 16,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Column(
                children: [
                  if (_loading)
                    const SizedBox(
                      height: 48,
                      width: 48,
                      child: CircularProgressIndicator(color: AppTheme.neonOrange, strokeWidth: 2),
                    )
                  else ...[
                    Text(
                      '$_balance',
                      style: GoogleFonts.poppins(fontSize: 48, fontWeight: FontWeight.w800, color: AppTheme.neonOrange, letterSpacing: -1),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      _t('wallet_balance'),
                      style: GoogleFonts.poppins(fontSize: 14, color: Colors.grey.shade400),
                    ),
                  ],
                  if (_creditsValidUntil != null && _creditsValidUntil!.isNotEmpty && !_loading) ...[
                    const SizedBox(height: 16),
                    _buildExpiryRow(),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 20),

            // Recharge Now CTA
            if (_driverId != null && _driverId!.isNotEmpty)
              FilledButton.icon(
                onPressed: () => _scrollToRechargeSection(context),
                icon: const Icon(Icons.add_circle_outline, size: 22),
                label: Text(_t('wallet_recharge_now'), style: GoogleFonts.poppins(fontSize: 16, fontWeight: FontWeight.w700)),
                style: FilledButton.styleFrom(
                  backgroundColor: AppTheme.neonOrange,
                  foregroundColor: Colors.black87,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  elevation: 2,
                ),
              ),
            if (_driverId != null && _driverId!.isNotEmpty) const SizedBox(height: 20),

            // Low / zero credit warnings
            if (!_loading && _driverId != null && _driverId!.isNotEmpty) ...[
              if (_balance == 0)
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.red.shade900.withValues(alpha: 0.3),
                    border: Border.all(color: Colors.red.shade700),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Row(
                    children: [
                      Icon(Icons.warning_amber_rounded, color: Colors.red.shade300, size: 28),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          _t('wallet_zero_credit_warning'),
                          style: GoogleFonts.poppins(fontSize: 14, fontWeight: FontWeight.w600, color: Colors.red.shade100),
                        ),
                      ),
                    ],
                  ),
                ),
              if (_balance > 0 && _balance < 20)
                Container(
                  margin: EdgeInsets.only(top: _balance == 0 ? 12 : 0),
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.orange.shade900.withValues(alpha: 0.3),
                    border: Border.all(color: Colors.orange.shade700),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Row(
                    children: [
                      Icon(Icons.info_outline, color: Colors.orange.shade300, size: 28),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          _t('wallet_low_credit_warning'),
                          style: GoogleFonts.poppins(fontSize: 14, fontWeight: FontWeight.w600, color: Colors.orange.shade100),
                        ),
                      ),
                    ],
                  ),
                ),
              if (_balance == 0 || (_balance > 0 && _balance < 20)) const SizedBox(height: 16),
            ],
            const SizedBox(height: 8),

            // Recharge approved banner – driver ko pata chalega credits add ho gaye
            if (_transactions.isNotEmpty &&
                (_transactions.first['status'] ?? '') == 'approved')
              Container(
                margin: const EdgeInsets.only(bottom: 16),
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.green.shade900.withValues(alpha: 0.3),
                  border: Border.all(color: Colors.green.shade700),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Row(
                  children: [
                    Icon(Icons.check_circle, color: Colors.green.shade400, size: 32),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        _t('wallet_recharge_approved_banner', {
                          'credits': '${_transactions.first['creditsAmount'] ?? 0}',
                        }),
                        style: GoogleFonts.poppins(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: Colors.green.shade100,
                        ),
                      ),
                    ),
                  ],
                ),
              ),

            // Recent recharge requests – status dikhane ke liye
            if (_driverId != null && _transactions.isNotEmpty) ...[
              Text(
                _t('wallet_recent_requests'),
                style: GoogleFonts.poppins(fontSize: 16, fontWeight: FontWeight.w600, color: AppTheme.onDark),
              ),
              const SizedBox(height: 12),
              ..._transactions.take(20).map((tx) {
                final status = (tx['status'] ?? 'pending') as String;
                final credits = tx['creditsAmount'] ?? 0;
                final amountSoles = tx['amountSoles'];
                final createdAt = tx['createdAt'] != null
                    ? DateTime.tryParse(tx['createdAt'].toString())?.toLocal()
                    : null;
                Color statusColor = Colors.orange;
                String statusText = _t('wallet_status_pending');
                if (status == 'approved') {
                  statusColor = Colors.green;
                  statusText = _t('wallet_status_approved');
                } else if (status == 'declined') {
                  statusColor = Colors.red;
                  statusText = _t('wallet_status_declined');
                } else if (status == 'needs_pdf') {
                  statusColor = Colors.amber.shade700;
                  statusText = _t('wallet_status_needs_pdf');
                }
                return Container(
                  margin: const EdgeInsets.only(bottom: 10),
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                  decoration: BoxDecoration(
                    color: AppTheme.surfaceDark,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: statusColor.withValues(alpha: 0.4)),
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              '+$credits credits',
                              style: GoogleFonts.poppins(fontSize: 16, fontWeight: FontWeight.w700, color: AppTheme.onDark),
                            ),
                            if (amountSoles != null)
                              Text(
                                'S/ ${amountSoles is num ? amountSoles.toStringAsFixed(2) : amountSoles}',
                                style: GoogleFonts.poppins(fontSize: 13, color: Colors.grey.shade400),
                              ),
                            if (createdAt != null)
                              Padding(
                                padding: const EdgeInsets.only(top: 4),
                                child: Text(
                                  '${createdAt.day}/${createdAt.month}/${createdAt.year}',
                                  style: GoogleFonts.poppins(fontSize: 12, color: Colors.grey.shade500),
                                ),
                              ),
                          ],
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                        decoration: BoxDecoration(
                          color: statusColor.withValues(alpha: 0.25),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Text(
                          statusText,
                          style: GoogleFonts.poppins(fontSize: 12, fontWeight: FontWeight.w600, color: statusColor),
                        ),
                      ),
                    ],
                  ),
                );
              }),
              const SizedBox(height: 24),
            ],

            // Middle: Payment Info (QR placeholder + Bank Details)
            Text(
              _t('wallet_payment_info'),
              style: GoogleFonts.poppins(fontSize: 16, fontWeight: FontWeight.w600, color: AppTheme.onDark),
            ),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: AppTheme.surfaceDark,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Column(
                children: [
                  Container(
                    width: 120,
                    height: 120,
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Icon(Icons.qr_code_2, size: 80, color: Colors.grey.shade600),
                  ),
                  const SizedBox(height: 16),
                  Text(
                    _t('wallet_bank_details'),
                    style: GoogleFonts.poppins(fontSize: 14, fontWeight: FontWeight.w600, color: AppTheme.onDark),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    _kBankDetails,
                    style: GoogleFonts.poppins(fontSize: 12, color: Colors.grey.shade400),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 12),
                  OutlinedButton.icon(
                    onPressed: _copyBankDetails,
                    icon: const Icon(Icons.copy, size: 18),
                    label: Text(_t('wallet_copy'), style: GoogleFonts.poppins(fontWeight: FontWeight.w600)),
                    style: OutlinedButton.styleFrom(foregroundColor: AppTheme.neonOrange),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),

            // Bottom: Verify Payment form
            SizedBox(key: _rechargeSectionKey),
            Text(
              _t('wallet_verify_payment'),
              style: GoogleFonts.poppins(fontSize: 16, fontWeight: FontWeight.w600, color: AppTheme.onDark),
            ),
            const SizedBox(height: 8),
            Text(
              _t('wallet_upload_screenshot'),
              style: GoogleFonts.poppins(fontSize: 14, color: AppTheme.onDark),
            ),
            const SizedBox(height: 8),
            GestureDetector(
              onTap: _pickScreenshot,
              child: Container(
                height: 140,
                decoration: BoxDecoration(
                  color: AppTheme.surfaceDark,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.grey.shade600),
                ),
                child: _screenshotBytes != null
                    ? ClipRRect(
                        borderRadius: BorderRadius.circular(12),
                        child: Image.memory(
                          _screenshotBytes!,
                          fit: BoxFit.cover,
                          width: double.infinity,
                        ),
                      )
                    : Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.add_photo_alternate, size: 48, color: Colors.grey.shade500),
                            const SizedBox(height: 8),
                            Text(
                              _t('wallet_upload_screenshot'),
                              style: GoogleFonts.poppins(fontSize: 14, color: Colors.grey.shade500),
                            ),
                          ],
                        ),
                      ),
              ),
            ),
            const SizedBox(height: 20),
            TextField(
              controller: _amountController,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              decoration: InputDecoration(
                labelText: _t('wallet_amount'),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                filled: true,
                fillColor: AppTheme.surfaceDark,
              ),
              style: GoogleFonts.poppins(color: AppTheme.onDark),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _transactionIdController,
              decoration: InputDecoration(
                labelText: _t('wallet_transaction_id'),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                filled: true,
                fillColor: AppTheme.surfaceDark,
              ),
              style: GoogleFonts.poppins(color: AppTheme.onDark),
            ),
            const SizedBox(height: 24),
            if (_driverId == null || _driverId!.isEmpty)
              Container(
                padding: const EdgeInsets.symmetric(vertical: 12),
                decoration: BoxDecoration(
                  color: Colors.orange.withValues(alpha: 0.2),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  _t('wallet_go_online_first'),
                  textAlign: TextAlign.center,
                  style: GoogleFonts.poppins(fontSize: 13, color: Colors.orange.shade300),
                ),
              )
            else
            FilledButton(
              onPressed: _submitting ? null : _submit,
              style: FilledButton.styleFrom(
                backgroundColor: AppTheme.neonOrange,
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              child: _submitting
                  ? const SizedBox(
                      height: 24,
                      width: 24,
                      child: CircularProgressIndicator(color: Colors.black87, strokeWidth: 2),
                    )
                  : Text(_t('wallet_submit'), style: GoogleFonts.poppins(fontSize: 16, fontWeight: FontWeight.w700)),
            ),
          ],
        ),
        ),
      ),
    );
  }
}
