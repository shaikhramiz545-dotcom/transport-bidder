import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:tbidder_user_app/core/app_brand.dart';
import 'package:tbidder_user_app/core/app_theme.dart';
import 'package:tbidder_user_app/l10n/app_locale.dart';

const Color _kNeonOrange = Color(0xFFFF6700);

void _showRechargeDialog(BuildContext context, String Function(String) t) {
  showDialog(
    context: context,
    builder: (ctx) => AlertDialog(
      title: const Text('Recharge'),
      content: const Text('Enter amount (S/) to recharge. Payment options will be available here.'),
      actions: [
        TextButton(onPressed: () => Navigator.pop(ctx), child: Text(t('ok'), style: const TextStyle(color: _kNeonOrange))),
      ],
    ),
  );
}

class WalletScreen extends StatelessWidget {
  const WalletScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final t = AppLocaleScope.of(context)?.t ?? (String k, [Map<String, dynamic>? p]) => translate(k, defaultLocale, p);
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        title: Text(t('drawer_wallet'), style: GoogleFonts.poppins(fontSize: 18, fontWeight: FontWeight.w600, color: _kNeonOrange)),
        leading: IconButton(icon: const Icon(Icons.arrow_back, color: _kNeonOrange), onPressed: () => Navigator.pop(context)),
        backgroundColor: Colors.white,
        elevation: 0,
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(t('drawer_wallet'), style: GoogleFonts.poppins(fontSize: 20, fontWeight: FontWeight.w700, color: Colors.black87)),
              const SizedBox(height: 8),
              Text('Balance, recharge, and transactions.', style: GoogleFonts.poppins(fontSize: 14, color: Colors.grey.shade600)),
              const SizedBox(height: 24),
              Card(
                margin: const EdgeInsets.only(bottom: 16),
                color: Color.lerp(_kNeonOrange, Colors.white, 0.9)!,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                child: Padding(
                  padding: const EdgeInsets.all(20),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text('Balance (S/)', style: GoogleFonts.poppins(fontSize: 14, color: Colors.grey.shade700)),
                      Text('0.00', style: GoogleFonts.poppins(fontSize: 22, fontWeight: FontWeight.w700, color: _kNeonOrange)),
                    ],
                  ),
                ),
              ),
              ListTile(
                leading: const Icon(Icons.add_circle_outline, color: _kNeonOrange),
                title: Text('Recharge', style: GoogleFonts.poppins(fontSize: 15, color: Colors.black87)),
                trailing: const Icon(Icons.chevron_right, size: 20, color: Colors.grey),
                onTap: () => _showRechargeDialog(context, t),
              ),
              const Spacer(),
              Center(child: Text(kAppName, style: GoogleFonts.poppins(fontSize: 12, fontWeight: FontWeight.w600, color: AppTheme.textDark))),
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }
}
