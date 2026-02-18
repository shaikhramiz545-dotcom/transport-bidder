import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:tbidder_user_app/core/app_brand.dart';
import 'package:tbidder_user_app/core/app_theme.dart';
import 'package:tbidder_user_app/l10n/app_locale.dart';

const Color _kNeonOrange = Color(0xFFFF6700);
const String _kSupportPhone = '+51987654321';
const String _kSupportEmail = 'Support@transportbidder.com';

/// Support – accessible from drawer. FAQ, Chat, Call, Email.
class SupportScreen extends StatelessWidget {
  const SupportScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final t = AppLocaleScope.of(context)?.t ?? (String k, [Map<String, dynamic>? p]) => translate(k, defaultLocale, p);
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        title: Text(t('drawer_support'), style: GoogleFonts.poppins(fontSize: 18, fontWeight: FontWeight.w600, color: _kNeonOrange)),
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
              Text(t('drawer_support'), style: GoogleFonts.poppins(fontSize: 20, fontWeight: FontWeight.w700, color: Colors.black87)),
              const SizedBox(height: 8),
              Text('Help, FAQ, and contact options.', style: GoogleFonts.poppins(fontSize: 14, color: Colors.grey.shade600)),
              const SizedBox(height: 24),
              _tile(context, Icons.help_outline, 'FAQ', () => _showInfo(context, t, 'FAQ', 'Frequently asked questions will be available here.')),
              _tile(context, Icons.chat_bubble_outline, 'Chat', () => _showInfo(context, t, 'Chat', 'Live chat will be available here.')),
              _tile(context, Icons.phone_outlined, 'Call support', () => launchUrl(Uri.parse('tel:$_kSupportPhone'))),
              _tile(context, Icons.email_outlined, 'Email', () => launchUrl(Uri.parse('mailto:$_kSupportEmail'))),
              const Spacer(),
              Center(child: Text(kAppName, style: GoogleFonts.poppins(fontSize: 12, fontWeight: FontWeight.w600, color: AppTheme.textDark))),
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }

  Widget _tile(BuildContext context, IconData icon, String label, VoidCallback onTap) {
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      child: ListTile(
        leading: Icon(icon, color: _kNeonOrange),
        title: Text(label, style: GoogleFonts.poppins(fontSize: 15, color: Colors.black87)),
        trailing: const Icon(Icons.chevron_right, size: 20, color: Colors.grey),
        onTap: onTap,
      ),
    );
  }

  void _showInfo(BuildContext context, String Function(String) t, String title, String message) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(title),
        content: Text(message),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: Text(t('ok'), style: const TextStyle(color: _kNeonOrange))),
        ],
      ),
    );
  }
}
