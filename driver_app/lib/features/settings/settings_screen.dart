import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:tbidder_driver_app/core/app_theme.dart';
import 'package:tbidder_driver_app/core/firm_config.dart';
import 'package:tbidder_driver_app/l10n/app_locale.dart';
import 'package:tbidder_driver_app/services/profile_storage_service.dart';
import 'package:url_launcher/url_launcher.dart';

/// Key used by home_screen and verification to store driver ID. Clearing this forces a fresh ID on next go-online.
const String _kDriverIdKey = 'driver_on_duty_id';

/// Settings – accessible from drawer. Firma ke hisaab; baad mein commission, notifications, etc.
class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final t = AppLocaleScope.of(context)?.t ?? (String k, [Map<String, dynamic>? p]) => translate(k, defaultLocale, p);
    return Scaffold(
      backgroundColor: AppTheme.darkBg,
      appBar: AppBar(
        title: Text(t('drawer_settings'), style: GoogleFonts.poppins(fontSize: 18, fontWeight: FontWeight.w600, color: AppTheme.neonOrange)),
        leading: IconButton(icon: const Icon(Icons.arrow_back, color: AppTheme.neonOrange), onPressed: () => Navigator.pop(context)),
        backgroundColor: AppTheme.darkBg,
        elevation: 0,
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(t('drawer_settings'), style: GoogleFonts.poppins(fontSize: 20, fontWeight: FontWeight.w700, color: AppTheme.onDark)),
              const SizedBox(height: 8),
              Text('Commission rates, notifications, language. Ye feature baad mein update kiya jayega.', style: GoogleFonts.poppins(fontSize: 14, color: Colors.grey.shade400)),
              const SizedBox(height: 24),
              _item(context, t, Icons.notifications_outlined, 'Notifications', 'Push & in-app', () => _showInfo(context, t, 'Notifications', 'Enable or disable push and in-app notifications.')),
              _item(context, t, Icons.percent_outlined, 'Commission', 'Rates by Firma', () => _showInfo(context, t, 'Commission', 'Commission rates are set by your Firma.')),
              _item(
                context,
                t,
                Icons.help_outline,
                'Help Center',
                'Email & WhatsApp',
                () => _openHelpCenter(context, t),
              ),
              _item(
                context,
                t,
                Icons.delete_sweep_outlined,
                'Clear local data (for testing)',
                'Removes driver ID & cache so next open gets fresh data',
                () => _clearLocalData(context, t),
              ),
              const Spacer(),
              Center(child: Text(kDriverAppTitle, style: GoogleFonts.poppins(fontSize: 12, color: Colors.grey.shade600))),
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }

  Widget _item(BuildContext context, String Function(String) t, IconData icon, String title, String subtitle, VoidCallback onTap) {
    return Card(
      color: AppTheme.surfaceDark,
      margin: const EdgeInsets.only(bottom: 8),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      child: ListTile(
        leading: Icon(icon, color: AppTheme.neonOrange),
        title: Text(title, style: GoogleFonts.poppins(fontSize: 15, color: AppTheme.onDark)),
        subtitle: Text(subtitle, style: GoogleFonts.poppins(fontSize: 12, color: Colors.grey.shade500)),
        onTap: onTap,
      ),
    );
  }

  void _showInfo(BuildContext context, String Function(String) t, String title, String message) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppTheme.surfaceDark,
        title: Text(title, style: const TextStyle(color: AppTheme.onDark)),
        content: Text(message, style: const TextStyle(color: AppTheme.onDark)),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: Text(t('ok'), style: const TextStyle(color: AppTheme.neonOrange))),
        ],
      ),
    );
  }

  /// Clears driver ID and verification welcome flags so the app fetches fresh status and gets a new driver ID on next use.
  static Future<void> _clearLocalData(BuildContext context, String Function(String) t) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove(_kDriverIdKey);
      // Bug fix: also clear cached profile so next open starts fresh.
      await ProfileStorageService.clear();
      final keys = prefs.getKeys();
      for (final k in keys) {
        if (k.startsWith('verification_welcome_shown_')) await prefs.remove(k);
        if (k.startsWith('verification_submitted_at_')) await prefs.remove(k);
        if (k.startsWith('driver_status_notice_')) await prefs.remove(k);
      }
      if (!context.mounted) return;
      showDialog<void>(
        context: context,
        builder: (ctx) => AlertDialog(
          backgroundColor: AppTheme.surfaceDark,
          title: const Text('Cache cleared', style: TextStyle(color: AppTheme.onDark)),
          content: const Text(
            'Driver ID and local cache removed. Restart the app (or go back to Home and go online again) to get a fresh driver ID and status.',
            style: TextStyle(color: AppTheme.onDark),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: Text(t('ok'), style: const TextStyle(color: AppTheme.neonOrange)),
            ),
          ],
        ),
      );
    } catch (_) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(t('error')), backgroundColor: Colors.red),
      );
    }
  }

  Future<void> _openHelpCenter(BuildContext context, String Function(String) t) async {
    const email = 'Support@transportbidder.com';
    const whatsapp = '+91XXXXXXXXXX';

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppTheme.surfaceDark,
        title: const Text('Help Center', style: TextStyle(color: AppTheme.onDark)),
        content: const Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Email: $email', style: TextStyle(color: AppTheme.onDark)),
            SizedBox(height: 8),
            Text('WhatsApp: $whatsapp', style: TextStyle(color: AppTheme.onDark)),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text(t('cancel'), style: const TextStyle(color: AppTheme.neonOrange)),
          ),
          TextButton(
            onPressed: () async {
              final uri = Uri.parse('mailto:$email');
              if (await canLaunchUrl(uri)) {
                await launchUrl(uri);
              }
            },
            child: const Text('Email', style: TextStyle(color: AppTheme.neonOrange)),
          ),
          TextButton(
            onPressed: () async {
              final number = whatsapp.replaceAll(RegExp(r'[^0-9+]'), '');
              final uri = Uri.parse('https://wa.me/${number.replaceAll('+', '')}');
              if (await canLaunchUrl(uri)) {
                await launchUrl(uri, mode: LaunchMode.externalApplication);
              }
            },
            child: const Text('WhatsApp', style: TextStyle(color: AppTheme.neonOrange)),
          ),
        ],
      ),
    );
  }
}
