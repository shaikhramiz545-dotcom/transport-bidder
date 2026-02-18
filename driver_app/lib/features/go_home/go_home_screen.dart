import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:tbidder_driver_app/core/app_theme.dart';
import 'package:tbidder_driver_app/core/firm_config.dart';
import 'package:tbidder_driver_app/l10n/app_locale.dart';

const String _kHomeAddressKey = 'driver_home_address';

/// Go Home – accessible from drawer. Set home location, end-of-day navigation.
class GoHomeScreen extends StatefulWidget {
  const GoHomeScreen({super.key});

  @override
  State<GoHomeScreen> createState() => _GoHomeScreenState();
}

class _GoHomeScreenState extends State<GoHomeScreen> {
  String _homeAddress = '';
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadAddress();
  }

  Future<void> _loadAddress() async {
    final prefs = await SharedPreferences.getInstance();
    final addr = prefs.getString(_kHomeAddressKey) ?? '';
    if (mounted) setState(() { _homeAddress = addr; _loading = false; });
  }

  Future<void> _showEditAddress() async {
    final controller = TextEditingController(text: _homeAddress);
    final result = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppTheme.surfaceDark,
        title: const Text('Home address', style: TextStyle(color: AppTheme.onDark)),
        content: TextField(
          controller: controller,
          maxLines: 2,
          style: const TextStyle(color: AppTheme.onDark),
          decoration: InputDecoration(
            hintText: 'Enter your home address',
            hintStyle: TextStyle(color: Colors.grey.shade500),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel', style: TextStyle(color: AppTheme.neonOrange))),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: AppTheme.neonOrange),
            onPressed: () => Navigator.pop(ctx, controller.text.trim()),
            child: const Text('Save'),
          ),
        ],
      ),
    );
    if (result != null) {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_kHomeAddressKey, result);
      if (mounted) setState(() => _homeAddress = result);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = AppLocaleScope.of(context)?.t ?? (String k, [Map<String, dynamic>? p]) => translate(k, defaultLocale, p);
    return Scaffold(
      backgroundColor: AppTheme.darkBg,
      appBar: AppBar(
        title: Text(t('drawer_go_home'), style: GoogleFonts.poppins(fontSize: 18, fontWeight: FontWeight.w600, color: AppTheme.neonOrange)),
        leading: IconButton(icon: const Icon(Icons.arrow_back, color: AppTheme.neonOrange), onPressed: () => Navigator.pop(context)),
        backgroundColor: AppTheme.darkBg,
        elevation: 0,
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: AppTheme.neonOrange))
          : SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(t('drawer_go_home'), style: GoogleFonts.poppins(fontSize: 20, fontWeight: FontWeight.w700, color: AppTheme.onDark)),
              const SizedBox(height: 8),
              Text('Set home address, get directions when you finish.', style: GoogleFonts.poppins(fontSize: 14, color: Colors.grey.shade400)),
              const SizedBox(height: 24),
              Card(
                color: AppTheme.surfaceDark,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                child: ListTile(
                  leading: const Icon(Icons.home_outlined, color: AppTheme.neonOrange),
                  title: Text('Home address', style: GoogleFonts.poppins(fontSize: 15, color: AppTheme.onDark)),
                  subtitle: Text(_homeAddress.isEmpty ? 'Not set' : _homeAddress, style: GoogleFonts.poppins(fontSize: 12, color: Colors.grey.shade500)),
                  trailing: const Icon(Icons.edit, color: AppTheme.neonOrange, size: 20),
                  onTap: _showEditAddress,
                ),
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
}
