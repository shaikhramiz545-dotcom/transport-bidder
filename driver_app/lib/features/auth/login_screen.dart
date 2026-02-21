import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:tbidder_driver_app/core/app_theme.dart';
import 'package:tbidder_driver_app/core/firm_config.dart';
import 'package:tbidder_driver_app/core/auth_api.dart';
import 'package:tbidder_driver_app/features/auth/reset_password_screen.dart';
import 'package:tbidder_driver_app/features/auth/signup_screen.dart';
import 'package:tbidder_driver_app/features/home/home_screen.dart';
import 'package:tbidder_driver_app/services/biometric_service.dart';
import 'package:tbidder_driver_app/services/profile_storage_service.dart';

/// Login screen — Dark theme, email+password, backend auth.
class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _authApi = AuthApi();
  final _biometricService = BiometricService();
  bool _loading = false;
  bool _obscurePassword = true;
  bool _biometricAvailable = false;

  @override
  void initState() {
    super.initState();
    _checkBiometric();
  }

  Future<void> _checkBiometric() async {
    final hasCreds = await _biometricService.hasStoredCredentials();
    final supported = await _biometricService.isDeviceSupported();
    final enabled = await _biometricService.isEnabled();
    if (mounted) setState(() => _biometricAvailable = hasCreds && supported && enabled);
  }

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _loginWithEmail() async {
    if (!_formKey.currentState!.validate()) return;
    final email = _emailController.text.trim();
    final password = _passwordController.text.trim();
    setState(() => _loading = true);
    try {
      final res = await _authApi.emailLogin(email: email, password: password, role: 'driver');
      if (!mounted) return;
      if (res.success && res.token != null) {
        await ProfileStorageService.saveAuthToken(res.token);
        await ProfileStorageService.saveEmail(email);
        if (res.user?.name != null && res.user!.name.isNotEmpty) {
          await ProfileStorageService.saveName(res.user!.name);
        }
        if (res.user?.phone != null && res.user!.phone.isNotEmpty) {
          await ProfileStorageService.savePhone(res.user!.phone);
        }
        if (!mounted) return;
        await _maybeOfferBiometric(email, password);
        if (!mounted) return;
        Navigator.of(context).pushAndRemoveUntil(
          MaterialPageRoute(builder: (_) => const HomeScreen()),
          (r) => false,
        );
      } else if (res.code == 'email_not_verified') {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: const Text('Email not verified. Check your inbox.'),
            backgroundColor: Colors.orange,
            action: SnackBarAction(
              label: 'Resend',
              textColor: Colors.white,
              onPressed: () async {
                await _authApi.sendVerificationOtp(email: email, role: 'driver');
              },
            ),
          ),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(res.message), backgroundColor: Colors.red.shade700),
        );
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error: $e'), backgroundColor: Colors.red.shade700),
      );
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _maybeOfferBiometric(String email, String password) async {
    final supported = await _biometricService.isDeviceSupported();
    if (!supported) return;
    final alreadyShown = await _biometricService.hasPromptBeenShown();
    if (alreadyShown) return;
    if (!mounted) return;
    final biometricType = await _biometricService.getBiometricType();
    await showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF1E1E1E),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text(
          'Enable $biometricType Login?',
          style: GoogleFonts.poppins(fontWeight: FontWeight.w700, color: Colors.white),
        ),
        content: Text(
          'Sign in faster next time using $biometricType instead of typing your password.',
          style: GoogleFonts.poppins(fontSize: 14, color: Colors.grey.shade300),
        ),
        actions: [
          TextButton(
            onPressed: () async {
              Navigator.of(ctx).pop();
              final prefs = await SharedPreferences.getInstance();
              await prefs.setBool('driver_biometric_prompt_shown', true);
            },
            child: Text('Skip', style: TextStyle(color: Colors.grey.shade500)),
          ),
          FilledButton(
            onPressed: () async {
              Navigator.of(ctx).pop();
              await _biometricService.enable(email, password);
              if (mounted) setState(() => _biometricAvailable = true);
            },
            style: FilledButton.styleFrom(backgroundColor: const Color(0xFFFF6700)),
            child: Text('Enable $biometricType', style: GoogleFonts.poppins(fontWeight: FontWeight.w600)),
          ),
        ],
      ),
    );
  }

  Future<void> _loginWithBiometric() async {
    final biometricType = await _biometricService.getBiometricType();
    final success = await _biometricService.authenticate(
      reason: 'Use $biometricType to sign in to Tbidder Driver',
    );
    if (!success) return;
    final creds = await _biometricService.getStoredCredentials();
    if (creds == null) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('No saved credentials. Please log in with email.')));
      return;
    }
    _emailController.text = creds.email;
    _passwordController.text = creds.password;
    await _loginWithEmail();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.darkBg,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const SizedBox(height: 40),
                Center(
                  child: Image.asset(
                    'assets/Both App logo.png',
                    height: 80,
                    fit: BoxFit.contain,
                    errorBuilder: (_, __, ___) => Text(
                      kDriverAppTitle,
                      style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                            fontWeight: FontWeight.bold,
                            color: AppTheme.neonOrange,
                          ),
                    ),
                  ),
                ),
                const SizedBox(height: 8),
                Center(
                  child: Text(
                    'TransportBidder Driver v2.2.7',
                    style: GoogleFonts.poppins(fontSize: 11, color: Colors.grey.shade500),
                  ),
                ),
                const SizedBox(height: 24),
                TextFormField(
                    controller: _emailController,
                    keyboardType: TextInputType.emailAddress,
                    style: const TextStyle(color: AppTheme.onDark),
                    decoration: InputDecoration(
                      labelText: 'Email',
                      hintText: 'Enter your email',
                      prefixIcon: const Icon(Icons.email_outlined, color: AppTheme.neonOrange, size: 22),
                      labelStyle: const TextStyle(color: AppTheme.neonOrange),
                      hintStyle: TextStyle(color: Colors.grey.shade600),
                      fillColor: AppTheme.surfaceDark,
                      filled: true,
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppTheme.neonOrange, width: 1.5)),
                      focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppTheme.neonOrange, width: 2)),
                    ),
                    validator: (v) {
                      final s = v?.trim() ?? '';
                      if (s.isEmpty) return 'Enter your email';
                      if (!RegExp(r'^[\w\-\.]+@([\w\-]+\.)+[\w\-]{2,4}$').hasMatch(s)) return 'Enter a valid email';
                      return null;
                    },
                  ),
                  const SizedBox(height: 16),
                  TextFormField(
                    controller: _passwordController,
                    obscureText: _obscurePassword,
                    style: const TextStyle(color: AppTheme.onDark),
                    decoration: InputDecoration(
                      labelText: 'Password',
                      hintText: 'Enter your password',
                      prefixIcon: const Icon(Icons.lock_outline, color: AppTheme.neonOrange, size: 22),
                      suffixIcon: IconButton(
                        icon: Icon(_obscurePassword ? Icons.visibility_off : Icons.visibility, color: Colors.grey.shade500),
                        onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
                      ),
                      labelStyle: const TextStyle(color: AppTheme.neonOrange),
                      hintStyle: TextStyle(color: Colors.grey.shade600),
                      fillColor: AppTheme.surfaceDark,
                      filled: true,
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppTheme.neonOrange, width: 1.5)),
                      focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppTheme.neonOrange, width: 2)),
                    ),
                    validator: (v) {
                      if ((v ?? '').trim().isEmpty) return 'Enter your password';
                      return null;
                    },
                  ),
                  const SizedBox(height: 24),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton(
                      onPressed: _loading ? null : _loginWithEmail,
                      style: FilledButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      child: _loading
                          ? const SizedBox(height: 22, width: 22, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.black87))
                          : Text('Login', style: GoogleFonts.poppins(fontWeight: FontWeight.w600)),
                    ),
                  ),
                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton(
                    onPressed: _loading ? null : () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const SignupScreen())),
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      side: const BorderSide(color: AppTheme.neonOrange),
                    ),
                    child: Text('Sign up', style: GoogleFonts.poppins(fontWeight: FontWeight.w600)),
                  ),
                ),
                const SizedBox(height: 12),
                Center(
                  child: TextButton(
                    onPressed: () => Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => const ResetPasswordScreen()),
                    ),
                    style: TextButton.styleFrom(
                      foregroundColor: AppTheme.neonOrange,
                      padding: EdgeInsets.zero,
                      minimumSize: Size.zero,
                      tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    ),
                    child: const Text('Forgot password?'),
                  ),
                ),
                if (_biometricAvailable) ...[
                  const SizedBox(height: 20),
                  Row(children: [
                    Expanded(child: Divider(color: Colors.grey.shade700)),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 12),
                      child: Text('or', style: TextStyle(color: Colors.grey.shade500, fontSize: 13)),
                    ),
                    Expanded(child: Divider(color: Colors.grey.shade700)),
                  ]),
                  const SizedBox(height: 16),
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton.icon(
                      onPressed: _loading ? null : _loginWithBiometric,
                      icon: const Icon(Icons.fingerprint, size: 24, color: AppTheme.neonOrange),
                      label: FutureBuilder<String>(
                        future: BiometricService().getBiometricType(),
                        builder: (_, snap) => Text(
                          'Sign in with ${snap.data ?? 'Biometric'}',
                          style: GoogleFonts.poppins(fontWeight: FontWeight.w500),
                        ),
                      ),
                      style: OutlinedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        side: const BorderSide(color: AppTheme.neonOrange),
                        foregroundColor: AppTheme.neonOrange,
                      ),
                    ),
                  ),
                ],
                const SizedBox(height: 24),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
