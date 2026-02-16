import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:image_picker/image_picker.dart';
import 'package:tbidder_user_app/core/app_brand.dart';
import 'package:tbidder_user_app/core/app_theme.dart';
import 'package:tbidder_user_app/core/country_codes.dart';
import 'package:tbidder_user_app/l10n/app_locale.dart';
import 'package:tbidder_user_app/widgets/country_code_phone_input.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:tbidder_user_app/core/auth_api.dart';
import 'package:tbidder_user_app/services/biometric_service.dart';
import 'package:tbidder_user_app/services/profile_storage_service.dart';

const Color _kNeonOrange = Color(0xFFFF6700);

/// Profile – user info, preferences. Name/Email/Phone from signup + editable.
class ProfileScreen extends StatefulWidget {
  final bool isFirstTime;
  
  const ProfileScreen({super.key, this.isFirstTime = false});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  String _name = '';
  String _email = '';
  String _phone = '';
  String? _photoBase64;
  bool _loading = true;
  bool _biometricEnabled = false;
  bool _biometricSupported = false;
  bool _notificationsEnabled = true;
  final _biometricService = BiometricService();

  @override
  void initState() {
    super.initState();
    _loadProfile();
    _loadBiometricState();
  }

  Future<void> _loadBiometricState() async {
    final enabled = await _biometricService.isEnabled();
    final supported = await _biometricService.isDeviceSupported();
    final notif = await ProfileStorageService.getNotificationsEnabled();
    if (mounted) {
      setState(() {
      _biometricEnabled = enabled;
      _biometricSupported = supported;
      _notificationsEnabled = notif;
    });
    }
  }

  void _showLanguageSelector() {
    final scope = AppLocaleScope.of(context);
    if (scope == null) return;
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(16))),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 24, horizontal: 20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(_t('select_language'), style: GoogleFonts.poppins(fontSize: 18, fontWeight: FontWeight.w700, color: AppTheme.textDark)),
              const SizedBox(height: 16),
              ...supportedLocales.map((loc) => ListTile(
                leading: Text(scope.locale.languageCode == loc.languageCode ? '✓' : '', style: GoogleFonts.poppins(fontSize: 18, color: _kNeonOrange)),
                title: Text(languageName(loc), style: GoogleFonts.poppins(fontSize: 16, color: AppTheme.textDark)),
                onTap: () {
                  scope.setLocale(loc);
                  Navigator.of(ctx).pop();
                },
              )),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _showNotificationsDialog() async {
    var value = _notificationsEnabled;
    final updated = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: Text(_t('profile_notifications')),
          content: Row(
            children: [
              Expanded(child: Text(_t('profile_notifications'), style: GoogleFonts.poppins())),
              Switch(
                value: value,
                onChanged: (v) => setDialogState(() => value = v),
                activeThumbColor: _kNeonOrange,
              ),
            ],
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, _notificationsEnabled), child: Text(_t('cancel'))),
            FilledButton(
              style: FilledButton.styleFrom(backgroundColor: _kNeonOrange),
              onPressed: () => Navigator.pop(ctx, value),
              child: Text(_t('save')),
            ),
          ],
        ),
      ),
    );
    if (updated != null && mounted) {
      await ProfileStorageService.saveNotificationsEnabled(updated);
      setState(() => _notificationsEnabled = updated);
    }
  }

  Future<void> _loadProfile() async {
    final name = await ProfileStorageService.getName();
    final email = await ProfileStorageService.getEmail();
    final phone = await ProfileStorageService.getPhone();
    final photoBase64 = await ProfileStorageService.getPhotoBase64();
    final photoUrl = await ProfileStorageService.getPhotoUrl();
    
    if (mounted) {
      setState(() {
      _name = name ?? '';
      _email = email ?? '';
      _phone = phone ?? '';
      _photoBase64 = photoBase64 ?? photoUrl; // Use URL if base64 not available
      _loading = false;
    });
    }
  }

  Future<void> _onBiometricToggle(bool enable) async {
    if (enable) {
      if (_email.isEmpty) {
        if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(_t('biometric_email_password_required')), backgroundColor: Colors.orange));
        return;
      }
      // First verify biometric hardware works
      final biometricOk = await _biometricService.authenticate(reason: 'Verify your identity to enable biometric login');
      if (!biometricOk) {
        if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Biometric verification failed'), backgroundColor: Colors.red));
        return;
      }
      final password = await _showPasswordDialog();
      if (password == null || password.isEmpty || !mounted) return;
      try {
        // Verify password via backend
        final res = await AuthApi().emailLogin(email: _email, password: password, role: 'user');
        if (!res.success) throw Exception('Invalid password');
        await _biometricService.enable(_email, password);
        if (mounted) {
          setState(() => _biometricEnabled = true);
          ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Biometric login enabled'), backgroundColor: _kNeonOrange));
        }
      } catch (_) {
        if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Wrong password'), backgroundColor: Colors.red));
      }
    } else {
      await _biometricService.disable();
      if (mounted) {
        setState(() => _biometricEnabled = false);
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Biometric login disabled')));
      }
    }
  }

  Future<String?> _showPasswordDialog() async {
    final controller = TextEditingController();
    return showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Enter password'),
        content: TextField(
          controller: controller,
          obscureText: true,
          decoration: const InputDecoration(hintText: 'Password'),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: Text(_t('cancel'))),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: _kNeonOrange),
            onPressed: () => Navigator.pop(ctx, controller.text),
            child: Text(_t('save')),
          ),
        ],
      ),
    );
  }

  Future<void> _pickPhoto() async {
    try {
      final picker = ImagePicker();
      final xFile = await picker.pickImage(source: ImageSource.gallery, maxWidth: 512, maxHeight: 512, imageQuality: 85);
      if (xFile == null || !mounted) return;
      final bytes = await xFile.readAsBytes();
      if (bytes.isNotEmpty) {
        final base64 = base64Encode(bytes);
        await ProfileStorageService.savePhotoBase64(base64);
        if (mounted) setState(() => _photoBase64 = base64);
      }
    } catch (_) {}
  }

  /// Parse existing phone string into country code + digits (for profile edit).
  static void parsePhone(String value, void Function(CountryCode code, String digits) onParsed) {
    final trimmed = value.trim().replaceAll(RegExp(r'[\s\-\(\)]'), '');
    CountryCode code = countryCodes.first;
    String digits = trimmed.replaceAll(RegExp(r'[^\d]'), '');
    if (trimmed.startsWith('+')) {
      final sorted = List<CountryCode>.from(countryCodes)
        ..sort((a, b) => b.dialCode.length.compareTo(a.dialCode.length));
      for (final c in sorted) {
        if (trimmed.startsWith(c.dialCode)) {
          code = c;
          digits = trimmed.substring(c.dialCode.length).replaceAll(RegExp(r'[^\d]'), '');
          break;
        }
      }
    }
    onParsed(code, digits);
  }

  Future<void> _showEditDialog(String field, String currentValue, String label, Future<void> Function(String) onSave) async {
    if (field == 'phone') {
      CountryCode selectedCode = countryCodes.first;
      String digits = '';
      parsePhone(currentValue, (code, d) {
        selectedCode = code;
        digits = d;
      });
      final phoneController = TextEditingController(text: digits);
      final result = await showDialog<String>(
        context: context,
        builder: (ctx) => StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
              title: Text(label),
              content: SingleChildScrollView(
                child: CountryCodePhoneInput(
                  phoneController: phoneController,
                  selectedCountryCode: selectedCode,
                  onCountryCodeChanged: (c) => setDialogState(() => selectedCode = c),
                  labelText: _t('profile_phone'),
                  hintText: _t('enter_phone'),
                ),
              ),
              actions: [
                TextButton(onPressed: () => Navigator.pop(ctx), child: Text(_t('cancel'))),
                FilledButton(
                  style: FilledButton.styleFrom(backgroundColor: _kNeonOrange),
                  onPressed: () {
                    final d = phoneController.text.trim().replaceAll(RegExp(r'[^\d]'), '');
                    final full = d.isEmpty ? '' : '${selectedCode.dialCode}$d';
                    Navigator.pop(ctx, full);
                  },
                  child: Text(_t('save')),
                ),
              ],
            );
          },
        ),
      );
      if (result != null && result.isNotEmpty) {
        await onSave(result);
        if (mounted) setState(() => _phone = result);
      }
      return;
    }
    final controller = TextEditingController(text: currentValue);
    final result = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(label),
        content: TextField(
          controller: controller,
          autofocus: true,
          keyboardType: field == 'email' ? TextInputType.emailAddress : TextInputType.name,
          decoration: InputDecoration(
            hintText: label,
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: Text(_t('cancel'))),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: _kNeonOrange),
            onPressed: () => Navigator.pop(ctx, controller.text.trim()),
            child: Text(_t('save')),
          ),
        ],
      ),
    );
    if (result != null && result.isNotEmpty) {
      await onSave(result);
      if (mounted) {
        setState(() {
        if (field == 'name') _name = result;
        if (field == 'email') _email = result;
      });
      }
    }
  }

  String _t(String key) => AppLocaleScope.of(context)?.t(key) ?? translate(key, defaultLocale);

  @override
  Widget build(BuildContext context) {
    final t = AppLocaleScope.of(context)?.t ?? (String k, [Map<String, dynamic>? p]) => translate(k, defaultLocale, p);
    return Scaffold(
      backgroundColor: const Color(0xFFF5F5DC),
      appBar: AppBar(
        title: Text(
          widget.isFirstTime ? 'Complete Your Profile' : t('drawer_profile'), 
          style: GoogleFonts.poppins(fontSize: 18, fontWeight: FontWeight.w600, color: AppTheme.textDark)
        ),
        leading: widget.isFirstTime 
          ? null 
          : IconButton(
              icon: const Icon(Icons.arrow_back, color: AppTheme.textDark),
              onPressed: () => Navigator.pop(context),
            ),
        backgroundColor: const Color(0xFFF5F5DC),
        elevation: 0,
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: _kNeonOrange))
          : SafeArea(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const SizedBox(height: 8),
                    Center(
                      child: GestureDetector(
                        onTap: _pickPhoto,
                        child: Stack(
                          children: [
                            CircleAvatar(
                              radius: 48,
                              backgroundColor: _kNeonOrange.withValues(alpha: 0.2),
                              backgroundImage: _photoBase64 != null
                                  ? (_photoBase64!.startsWith('http')
                                      ? NetworkImage(_photoBase64!) as ImageProvider
                                      : MemoryImage(base64Decode(_photoBase64!)))
                                  : null,
                              child: _photoBase64 != null ? null : Text('👤', style: GoogleFonts.poppins(fontSize: 40)),
                            ),
                            Positioned(
                              right: 0,
                              bottom: 0,
                              child: Container(
                                padding: const EdgeInsets.all(6),
                                decoration: const BoxDecoration(color: _kNeonOrange, shape: BoxShape.circle, boxShadow: [BoxShadow(color: Colors.black26, blurRadius: 4)]),
                                child: const Icon(Icons.camera_alt, color: Colors.white, size: 20),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 8),
                    Center(
                      child: Text(
                        _name.isEmpty ? t('profile_name') : _name,
                        style: GoogleFonts.poppins(fontSize: 22, fontWeight: FontWeight.w700, color: AppTheme.textDark),
                      ),
                    ),
                    const SizedBox(height: 4),
                    Center(child: Text(t('profile_passenger'), style: GoogleFonts.poppins(fontSize: 14, color: Colors.grey.shade600))),
                    const SizedBox(height: 8),
                    Center(
                      child: Text(
                        t('tap_photo_to_change'),
                        style: GoogleFonts.poppins(fontSize: 11, color: Colors.grey.shade500),
                      ),
                    ),
                    const SizedBox(height: 24),
                    _sectionTitle(t('profile_personal_info')),
                    const SizedBox(height: 12),
                    _editableInfoCard(
                      context,
                      t,
                      Icons.person_outline,
                      t('profile_name'),
                      _name.isEmpty ? '—' : _name,
                      () => _showEditDialog('name', _name, t('profile_name'), ProfileStorageService.saveName),
                    ),
                    _editableInfoCard(
                      context,
                      t,
                      Icons.email_outlined,
                      t('profile_email'),
                      _email.isEmpty ? '—' : _email,
                      () => _showEditDialog('email', _email, t('profile_email'), ProfileStorageService.saveEmail),
                    ),
                    _editableInfoCard(
                      context,
                      t,
                      Icons.phone_outlined,
                      t('profile_phone'),
                      _phone.isEmpty ? '—' : _phone,
                      () => _showEditDialog('phone', _phone, t('profile_phone'), ProfileStorageService.savePhone),
                    ),
                    const SizedBox(height: 24),
                    _sectionTitle(t('profile_preferences')),
                    const SizedBox(height: 12),
                    if (_biometricSupported) ...[
                      Card(
                        margin: const EdgeInsets.only(bottom: 10),
                        elevation: 0,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        color: Colors.white,
                        child: Padding(
                          padding: const EdgeInsets.all(16),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Container(
                                    padding: const EdgeInsets.all(8),
                                    decoration: BoxDecoration(
                                      color: _kNeonOrange.withValues(alpha: 0.12),
                                      borderRadius: BorderRadius.circular(10),
                                    ),
                                    child: const Icon(Icons.fingerprint, color: _kNeonOrange, size: 22),
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(t('biometric_settings_title'), style: GoogleFonts.poppins(fontSize: 16, fontWeight: FontWeight.w600, color: AppTheme.textDark)),
                                        const SizedBox(height: 4),
                                        Text(t('biometric_settings_message'), style: GoogleFonts.poppins(fontSize: 12, color: Colors.grey.shade600)),
                                      ],
                                    ),
                                  ),
                                  Switch(
                                    value: _biometricEnabled,
                                    onChanged: (v) => _onBiometricToggle(v),
                                    activeTrackColor: _kNeonOrange.withValues(alpha: 0.5),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                    _infoCard(
                      context,
                      t,
                      Icons.translate,
                      t('profile_language'),
                      (AppLocaleScope.of(context) != null ? languageName(AppLocaleScope.of(context)!.locale) : 'Español'),
                      _showLanguageSelector,
                    ),
                    _infoCard(
                      context,
                      t,
                      Icons.notifications_outlined,
                      t('profile_notifications'),
                      _notificationsEnabled ? t('profile_enabled') : t('profile_disabled'),
                      _showNotificationsDialog,
                    ),
                    const SizedBox(height: 16),
                    if (widget.isFirstTime) ...[
                      const SizedBox(height: 24),
                      Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: Colors.orange.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: Colors.orange.withValues(alpha: 0.3)),
                        ),
                        child: Column(
                          children: [
                            Row(
                              children: [
                                Icon(Icons.info_outline, color: Colors.orange.shade700, size: 20),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: Text(
                                    'Please complete your profile to continue',
                                    style: GoogleFonts.poppins(fontSize: 14, color: Colors.orange.shade700, fontWeight: FontWeight.w500),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 12),
                            SizedBox(
                              width: double.infinity,
                              child: FilledButton(
                                onPressed: _isProfileComplete() ? _saveAndContinue : null,
                                style: FilledButton.styleFrom(
                                  backgroundColor: _isProfileComplete() ? _kNeonOrange : Colors.grey,
                                  padding: const EdgeInsets.symmetric(vertical: 16),
                                ),
                                child: Text(
                                  _isProfileComplete() ? 'Continue' : 'Complete Profile (Name & Email Required)',
                                  style: GoogleFonts.poppins(fontSize: 16, fontWeight: FontWeight.w600),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                    const SizedBox(height: 16),
                    Center(
                      child: Text('$kAppName v2.0.0', style: GoogleFonts.poppins(fontSize: 12, fontWeight: FontWeight.w600, color: Colors.grey.shade500)),
                    ),
                    const SizedBox(height: 24),
                  ],
                ),
              ),
            ),
    );
  }

  bool _isProfileComplete() {
    return _name.isNotEmpty && _email.isNotEmpty;
  }

  Future<void> _saveAndContinue() async {
    if (!_isProfileComplete()) return;
    
    // Save current profile data
    await ProfileStorageService.saveName(_name);
    await ProfileStorageService.saveEmail(_email);
    if (_phone.isNotEmpty) {
      await ProfileStorageService.savePhone(_phone);
    }
    
    // Navigate to home screen
    if (mounted) {
      Navigator.of(context).pushNamedAndRemoveUntil('/home', (route) => false);
    }
  }

  Widget _sectionTitle(String text) {
    return Text(text, style: GoogleFonts.poppins(fontSize: 14, fontWeight: FontWeight.w600, color: Colors.grey.shade700));
  }

  Widget _editableInfoCard(BuildContext context, String Function(String) t, IconData icon, String label, String value, VoidCallback onTap) {
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      elevation: 0,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      color: Colors.white,
      child: ListTile(
        leading: Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(color: _kNeonOrange.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(10)),
          child: Icon(icon, color: _kNeonOrange, size: 22),
        ),
        title: Text(label, style: GoogleFonts.poppins(fontSize: 13, color: Colors.grey.shade600)),
        subtitle: Text(value, style: GoogleFonts.poppins(fontSize: 16, fontWeight: FontWeight.w600, color: AppTheme.textDark)),
        trailing: const Icon(Icons.edit, color: _kNeonOrange, size: 20),
        onTap: onTap,
      ),
    );
  }

  Widget _infoCard(BuildContext context, String Function(String) t, IconData icon, String label, String value, VoidCallback onTap) {
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      elevation: 0,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      color: Colors.white,
      child: ListTile(
        leading: Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(color: _kNeonOrange.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(10)),
          child: Icon(icon, color: _kNeonOrange, size: 22),
        ),
        title: Text(label, style: GoogleFonts.poppins(fontSize: 13, color: Colors.grey.shade600)),
        subtitle: Text(value, style: GoogleFonts.poppins(fontSize: 16, fontWeight: FontWeight.w600, color: AppTheme.textDark)),
        trailing: Icon(Icons.chevron_right, color: Colors.grey.shade400, size: 22),
        onTap: onTap,
      ),
    );
  }
}

/// Slider card: Become our driver | Become our partner — tap to open Driver app or Agency portal.
class _BecomeDriverPartnerCard extends StatefulWidget {
  const _BecomeDriverPartnerCard({required this.t});

  final String Function(String) t;

  @override
  State<_BecomeDriverPartnerCard> createState() => _BecomeDriverPartnerCardState();
}

class _BecomeDriverPartnerCardState extends State<_BecomeDriverPartnerCard> {
  bool _isDriver = true;

  Future<void> _openApp() async {
    final url = _isDriver ? kDriverAppUrl : kAgencyPortalUrl;
    final uri = Uri.parse(url);
    try {
      if (await canLaunchUrl(uri)) {
        await launchUrl(uri, mode: LaunchMode.externalApplication);
      } else {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(_isDriver ? 'Install Driver app to continue' : 'Open Partner portal in browser'),
              backgroundColor: _kNeonOrange,
            ),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Could not open: $e'), backgroundColor: Colors.red),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = widget.t;
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      elevation: 0,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      color: Colors.white,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              t('become_our'),
              style: GoogleFonts.poppins(fontSize: 13, color: Colors.grey.shade600),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: SegmentedButton<bool>(
                    segments: [
                      ButtonSegment(
                        value: true,
                        label: Text(t('become_driver')),
                        icon: const Icon(Icons.directions_car, size: 20),
                      ),
                      ButtonSegment(
                        value: false,
                        label: Text(t('become_partner')),
                        icon: const Icon(Icons.business, size: 20),
                      ),
                    ],
                    selected: {_isDriver},
                    onSelectionChanged: (Set<bool> s) => setState(() => _isDriver = s.first),
                    style: ButtonStyle(
                      visualDensity: VisualDensity.compact,
                      padding: WidgetStateProperty.all(const EdgeInsets.symmetric(vertical: 10)),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                FilledButton.icon(
                  onPressed: _openApp,
                  icon: const Icon(Icons.arrow_forward, size: 20),
                  label: Text(t('go')),
                  style: FilledButton.styleFrom(
                    backgroundColor: _kNeonOrange,
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
