import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:tbidder_user_app/core/app_brand.dart';
import 'package:tbidder_user_app/core/app_theme.dart';
import 'package:tbidder_user_app/core/auth_api.dart';
import 'package:tbidder_user_app/features/auth/reset_password_screen.dart';
import 'package:tbidder_user_app/features/auth/signup_screen.dart';
import 'package:tbidder_user_app/features/home/home_screen.dart';
import 'package:tbidder_user_app/l10n/app_locale.dart';
import 'package:tbidder_user_app/services/biometric_service.dart';
import 'package:tbidder_user_app/services/profile_storage_service.dart';
import 'package:tbidder_user_app/widgets/biometric_prompt_dialog.dart';

/// TBidder Login — App name at top, Email & Password, Login (Neon Orange) + Create Account (text button).
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
  bool _obscurePassword = true;
  bool _loading = false;
  bool _showBiometricLogin = false;
  String _biometricType = '';

  @override
  void initState() {
    super.initState();
    _checkBiometricAvailability();
  }

  Future<void> _checkBiometricAvailability() async {
    final enabled = await _biometricService.isEnabled();
    final hasCreds = await _biometricService.hasStoredCredentials();
    final type = await _biometricService.getBiometricType();
    if (mounted) {
      setState(() {
      _showBiometricLogin = enabled && hasCreds;
      _biometricType = type;
    });
    }
  }

  Future<void> _navigateToHome() async {
    if (!mounted) return;
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(builder: (_) => const HomeScreen()),
    );
  }

  Future<void> _maybeShowBiometricPrompt(String email, String password) async {
    final supported = await _biometricService.isDeviceSupported();
    final shown = await _biometricService.hasPromptBeenShown();
    if (!supported || shown || !mounted) {
      await _navigateToHome();
      return;
    }
    final type = await _biometricService.getBiometricType();
    if (!mounted) {
      return;
    }
    await showBiometricAddPrompt(
      context: context,
      biometricType: type,
      onAdd: () async {
        await _biometricService.enable(email, password);
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('$type added for quick login'), backgroundColor: AppTheme.neonOrange),
        );
        await _navigateToHome();
      },
      onSkip: () async {
        await _biometricService.markPromptShown();
        await _navigateToHome();
      },
    );
  }

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _login() async {
    if (!_formKey.currentState!.validate()) return;
    final email = _emailController.text.trim();
    final password = _passwordController.text;
    setState(() => _loading = true);
    try {
      final res = await _authApi.emailLogin(email: email, password: password, role: 'user');
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
        await _maybeShowBiometricPrompt(email, password);
      } else if (res.code == 'email_not_verified') {
        // Offer to resend verification OTP
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: const Text('Email not verified. Check your inbox.'),
            backgroundColor: Colors.orange,
            action: SnackBarAction(
              label: 'Resend',
              textColor: Colors.white,
              onPressed: () async {
                await _authApi.sendVerificationOtp(email: email, role: 'user');
              },
            ),
          ),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(res.message), backgroundColor: Colors.red),
        );
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error: ${e.toString()}'), backgroundColor: Colors.red),
      );
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _loginWithBiometric() async {
    setState(() => _loading = true);
    try {
      final creds = await _biometricService.getStoredCredentials();
      if (creds == null) {
        if (mounted) setState(() => _showBiometricLogin = false);
        return;
      }
      final ok = await _biometricService.authenticate(reason: 'Login to TBidder');
      if (!ok || !mounted) return;
      final res = await _authApi.emailLogin(email: creds.email, password: creds.password, role: 'user');
      if (!mounted) return;
      if (res.success && res.token != null) {
        await ProfileStorageService.saveAuthToken(res.token);
        await ProfileStorageService.saveEmail(creds.email);
        await _navigateToHome();
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(res.message), backgroundColor: Colors.red),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Biometric login failed'), backgroundColor: Colors.red),
        );
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _createAccount() {
    Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => const SignupScreen()),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.cream,
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
                    height: 88,
                    fit: BoxFit.contain,
                    errorBuilder: (_, __, ___) => Text(
                      kAppName,
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.headlineLarge?.copyWith(
                            fontWeight: FontWeight.bold,
                            color: AppTheme.textDark,
                          ),
                    ),
                  ),
                ),
                const SizedBox(height: 32),
                if (_showBiometricLogin) ...[
                  OutlinedButton.icon(
                    onPressed: _loading ? null : _loginWithBiometric,
                    icon: const Icon(Icons.fingerprint, size: 28, color: AppTheme.neonOrange),
                    label: Builder(
                      builder: (ctx) {
                        final t = AppLocaleScope.of(ctx)?.t ?? (String k, [Map<String, dynamic>? p]) => translate(k, defaultLocale, p);
                        return Text(t('biometric_login_with', {'type': _biometricType.isNotEmpty ? _biometricType : 'Biometric'}), style: GoogleFonts.poppins(fontWeight: FontWeight.w600));
                      },
                    ),
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      side: const BorderSide(color: AppTheme.neonOrange),
                    ),
                  ),
                  const SizedBox(height: 24),
                  Row(
                    children: [
                      Expanded(child: Divider(color: Colors.grey.shade400)),
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                        child: Text('or', style: TextStyle(color: Colors.grey.shade600, fontSize: 14)),
                      ),
                      Expanded(child: Divider(color: Colors.grey.shade400)),
                    ],
                  ),
                  const SizedBox(height: 24),
                ],
                TextFormField(
                  controller: _emailController,
                  keyboardType: TextInputType.emailAddress,
                  decoration: InputDecoration(
                    labelText: 'Email',
                    hintText: 'Enter your email',
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: const BorderSide(color: AppTheme.neonOrange, width: 1.5),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: const BorderSide(color: AppTheme.neonOrange, width: 2),
                    ),
                  ),
                  validator: (v) {
                    final s = v?.trim() ?? '';
                    if (s.isEmpty) return 'Enter your email';
                    return null;
                  },
                ),
                const SizedBox(height: 20),
                TextFormField(
                  controller: _passwordController,
                  obscureText: _obscurePassword,
                  decoration: InputDecoration(
                    labelText: 'Password',
                    hintText: 'Enter your password',
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: const BorderSide(color: AppTheme.neonOrange, width: 1.5),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: const BorderSide(color: AppTheme.neonOrange, width: 2),
                    ),
                    suffixIcon: IconButton(
                      icon: Icon(
                        _obscurePassword ? Icons.visibility_off : Icons.visibility,
                        color: AppTheme.textDark,
                      ),
                      onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
                    ),
                  ),
                  validator: (v) {
                    final s = v ?? '';
                    if (s.isEmpty) return 'Enter your password';
                    return null;
                  },
                ),
                const SizedBox(height: 12),
                Align(
                  alignment: Alignment.centerRight,
                  child: TextButton(
                    onPressed: () => Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => const ResetPasswordScreen()),
                    ),
                    child: const Text('Forgot password?'),
                  ),
                ),
                const SizedBox(height: 20),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    onPressed: _loading ? null : _login,
                    style: FilledButton.styleFrom(
                      backgroundColor: AppTheme.neonOrange,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                    child: _loading
                        ? const SizedBox(
                            height: 22,
                            width: 22,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : const Text('Login'),
                  ),
                ),
                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    onPressed: _loading ? null : _createAccount,
                    style: FilledButton.styleFrom(
                      backgroundColor: AppTheme.neonOrange,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                    child: const Text('Create Account'),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

}
