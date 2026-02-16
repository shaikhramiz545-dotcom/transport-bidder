import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:tbidder_driver_app/core/app_theme.dart';
import 'package:tbidder_driver_app/l10n/app_locale.dart';
import 'package:tbidder_driver_app/services/wallet_api.dart';

const String _kDriverIdKey = 'driver_on_duty_id';

class ScratchCardScreen extends StatefulWidget {
  const ScratchCardScreen({super.key});

  @override
  State<ScratchCardScreen> createState() => _ScratchCardScreenState();
}

class _ScratchCardScreenState extends State<ScratchCardScreen> {
  final WalletApi _walletApi = WalletApi();
  String? _driverId;
  bool _loading = true;
  bool _canScratch = false;
  String? _lastScratchAt;
  bool _scratching = false;
  int? _wonCredits;
  int? _newBalance;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final prefs = await SharedPreferences.getInstance();
    final id = prefs.getString(_kDriverIdKey);
    setState(() => _driverId = id);
    if (id == null || id.isEmpty) {
      setState(() => _loading = false);
      return;
    }
    try {
      final status = await _walletApi.getScratchStatus(id);
      if (mounted) {
        setState(() {
        _canScratch = status.canScratch;
        _lastScratchAt = status.lastScratchAt;
        _loading = false;
      });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  String _t(String key, [Map<String, dynamic>? params]) {
    final scope = AppLocaleScope.of(context);
    return scope?.t(key, params) ?? translate(key, defaultLocale, params);
  }

  Future<void> _scratch() async {
    final id = _driverId;
    if (id == null || id.isEmpty || !_canScratch || _scratching) return;
    setState(() => _scratching = true);
    try {
      final result = await _walletApi.claimScratchCard(id);
      if (mounted && result != null) {
        setState(() {
          _wonCredits = result.credits;
          _newBalance = result.newBalance;
          _canScratch = false;
          _scratching = false;
        });
      } else if (mounted) {
        setState(() => _scratching = false);
      }
    } catch (e) {
      if (mounted) {
        setState(() => _scratching = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('$e', style: GoogleFonts.poppins()), backgroundColor: Colors.red),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.darkBg,
      appBar: AppBar(
        title: Text(_t('scratch_card_title'), style: GoogleFonts.poppins(fontWeight: FontWeight.w700)),
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: _driverId == null || _driverId!.isEmpty
              ? Center(
                  child: Text(
                    _t('wallet_go_online_first'),
                    textAlign: TextAlign.center,
                    style: GoogleFonts.poppins(fontSize: 16, color: Colors.grey.shade400),
                  ),
                )
              : _loading
                  ? const Center(child: CircularProgressIndicator(color: AppTheme.neonOrange))
                  : _wonCredits != null
                      ? _buildResult()
                      : _buildCard(),
        ),
      ),
    );
  }

  Widget _buildCard() {
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Text(
          _t('scratch_card_tomorrow'),
          style: GoogleFonts.poppins(fontSize: 14, color: Colors.grey.shade400),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 24),
        GestureDetector(
          onTap: _canScratch && !_scratching ? _scratch : null,
          child: Container(
            width: 200,
            height: 200,
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: _canScratch
                    ? [AppTheme.neonOrange, AppTheme.neonOrangeAlt]
                    : [Colors.grey.shade700, Colors.grey.shade800],
              ),
              borderRadius: BorderRadius.circular(20),
              boxShadow: [
                BoxShadow(
                  color: (_canScratch ? AppTheme.neonOrange : Colors.grey).withValues(alpha: 0.4),
                  blurRadius: 16,
                  spreadRadius: 2,
                ),
              ],
            ),
            child: Center(
              child: _scratching
                  ? const SizedBox(
                      width: 48,
                      height: 48,
                      child: CircularProgressIndicator(color: Colors.white, strokeWidth: 3),
                    )
                  : Text(
                      _canScratch ? _t('scratch_card_tap') : _t('scratch_card_used'),
                      textAlign: TextAlign.center,
                      style: GoogleFonts.poppins(
                        fontSize: _canScratch ? 18 : 14,
                        fontWeight: FontWeight.w700,
                        color: Colors.white,
                      ),
                    ),
            ),
          ),
        ),
        if (_lastScratchAt != null) ...[
          const SizedBox(height: 16),
          Text(
            'Última: $_lastScratchAt',
            style: GoogleFonts.poppins(fontSize: 12, color: Colors.grey.shade500),
          ),
        ],
      ],
    );
  }

  Widget _buildResult() {
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        const Icon(Icons.celebration, size: 80, color: AppTheme.neonOrange),
        const SizedBox(height: 24),
        Text(
          _t('scratch_card_won', {'credits': _wonCredits.toString()}),
          textAlign: TextAlign.center,
          style: GoogleFonts.poppins(fontSize: 22, fontWeight: FontWeight.w700, color: AppTheme.neonOrange),
        ),
        if (_newBalance != null) ...[
          const SizedBox(height: 12),
          Text(
            '${_t('wallet_balance')}: $_newBalance',
            style: GoogleFonts.poppins(fontSize: 16, color: AppTheme.onDark),
          ),
        ],
        const SizedBox(height: 32),
        Text(
          _t('scratch_card_tomorrow'),
          style: GoogleFonts.poppins(fontSize: 14, color: Colors.grey.shade400),
          textAlign: TextAlign.center,
        ),
      ],
    );
  }
}
