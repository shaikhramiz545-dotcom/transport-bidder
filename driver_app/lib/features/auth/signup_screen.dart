import 'package:flutter/material.dart';
import 'package:tbidder_driver_app/core/app_theme.dart';
import 'package:tbidder_driver_app/core/country_codes.dart';
import 'package:tbidder_driver_app/core/auth_api.dart';
import 'package:tbidder_driver_app/features/auth/email_otp_screen.dart';
import 'package:tbidder_driver_app/features/auth/login_screen.dart';
import 'package:tbidder_driver_app/features/home/home_screen.dart';
import 'package:tbidder_driver_app/services/profile_storage_service.dart';
import 'package:tbidder_driver_app/widgets/country_code_phone_input.dart';

/// Sign up screen — Name, Phone, Email, Password. On submit creates backend account, goes to email OTP screen.
class SignupScreen extends StatefulWidget {
  const SignupScreen({super.key});

  @override
  State<SignupScreen> createState() => _SignupScreenState();
}

class _SignupScreenState extends State<SignupScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _phoneController = TextEditingController();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _authApi = AuthApi();
  CountryCode _selectedCountryCode = countryCodes.firstWhere((c) => c.dialCode == '+51', orElse: () => countryCodes.first);
  bool _loading = false;
  bool _obscurePassword = true;

  String get _fullPhone {
    final digits = _phoneController.text.trim().replaceAll(RegExp(r'[^\d]'), '');
    return digits.isEmpty ? '' : '${_selectedCountryCode.dialCode}$digits';
  }

  @override
  void dispose() {
    _nameController.dispose();
    _phoneController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _signUp() async {
    if (!_formKey.currentState!.validate()) return;
    final name = _nameController.text.trim();
    final email = _emailController.text.trim();
    final phone = _fullPhone;
    final password = _passwordController.text;
    setState(() => _loading = true);
    try {
      final res = await _authApi.signup(
        email: email,
        password: password,
        name: name,
        phone: phone.isNotEmpty ? phone : null,
        role: 'driver',
      );
      if (!mounted) return;
      if (res.success) {
        await ProfileStorageService.saveName(name);
        await ProfileStorageService.saveEmail(email);
        if (phone.isNotEmpty) await ProfileStorageService.savePhone(phone);
        if (!mounted) return;
        // If backend auto-verified (dev mode, email delivery failed), go straight to home
        if (res.token != null && res.token!.isNotEmpty) {
          await ProfileStorageService.saveAuthToken(res.token);
          if (!mounted) return;
          Navigator.of(context).pushAndRemoveUntil(
            MaterialPageRoute(builder: (_) => const HomeScreen()),
            (route) => false,
          );
        } else {
          Navigator.of(context).pushAndRemoveUntil(
            MaterialPageRoute(
              builder: (_) => EmailOtpScreen(
                email: email,
                role: 'driver',
              ),
            ),
            (route) => false,
          );
        }
      } else if (res.message.contains('already exists')) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: const Text('An account already exists with this email.'),
            backgroundColor: Colors.orange,
            duration: const Duration(seconds: 5),
            action: SnackBarAction(
              label: 'Login',
              textColor: Colors.white,
              onPressed: () => Navigator.of(context).pushReplacement(
                MaterialPageRoute(builder: (_) => const LoginScreen()),
              ),
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.darkBg,
      appBar: AppBar(
        backgroundColor: AppTheme.darkBg,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => Navigator.of(context).pushReplacement(
            MaterialPageRoute(builder: (_) => const LoginScreen()),
          ),
        ),
        title: const Text('Sign up', style: TextStyle(color: AppTheme.onDark)),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const SizedBox(height: 16),
                Center(
                  child: Image.asset(
                    'assets/Both App logo.png',
                    height: 64,
                    fit: BoxFit.contain,
                    errorBuilder: (_, __, ___) => const SizedBox.shrink(),
                  ),
                ),
                const SizedBox(height: 16),
                Text(
                  'Create your driver account',
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(
                        fontWeight: FontWeight.bold,
                        color: AppTheme.onDark,
                      ),
                ),
                const SizedBox(height: 8),
                Text(
                  'Enter your details to start earning',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: Colors.grey.shade400,
                      ),
                ),
                const SizedBox(height: 32),
                TextFormField(
                  controller: _nameController,
                  textCapitalization: TextCapitalization.words,
                  style: const TextStyle(color: AppTheme.onDark),
                  decoration: _inputDecoration('Full name', 'Enter your name', Icons.person_outline),
                  validator: (v) {
                    final s = v?.trim() ?? '';
                    if (s.isEmpty) return 'Enter your name';
                    return null;
                  },
                ),
                const SizedBox(height: 20),
                CountryCodePhoneInput(
                  phoneController: _phoneController,
                  selectedCountryCode: _selectedCountryCode,
                  onCountryCodeChanged: (c) => setState(() => _selectedCountryCode = c),
                  labelText: 'Mobile number',
                  hintText: 'Enter mobile number',
                  validator: (v) {
                    final s = (v ?? '').trim().replaceAll(RegExp(r'[^\d]'), '');
                    if (s.isEmpty) return 'Enter your mobile number';
                    return null;
                  },
                ),
                const SizedBox(height: 20),
                TextFormField(
                  controller: _emailController,
                  keyboardType: TextInputType.emailAddress,
                  style: const TextStyle(color: AppTheme.onDark),
                  decoration: _inputDecoration('Email', 'Enter your email', Icons.email_outlined),
                  validator: (v) {
                    final s = v?.trim() ?? '';
                    if (s.isEmpty) return 'Enter your email';
                    if (!RegExp(r'^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$').hasMatch(s)) return 'Enter a valid email';
                    return null;
                  },
                ),
                const SizedBox(height: 20),
                TextFormField(
                  controller: _passwordController,
                  obscureText: _obscurePassword,
                  style: const TextStyle(color: AppTheme.onDark),
                  decoration: InputDecoration(
                    labelText: 'Password',
                    hintText: 'Create a password (min 6 characters)',
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
                    final s = v ?? '';
                    if (s.isEmpty) return 'Create a password';
                    if (s.length < 6) return 'Password must be at least 6 characters';
                    return null;
                  },
                ),
                const SizedBox(height: 32),
                FilledButton(
                  onPressed: _loading ? null : _signUp,
                  style: FilledButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  child: _loading
                      ? const SizedBox(
                          height: 22,
                          width: 22,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.black87),
                        )
                      : const Text('Create account'),
                ),
                const SizedBox(height: 24),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      'Already have an account? ',
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: AppTheme.onDark),
                    ),
                    TextButton(
                      onPressed: () => Navigator.of(context).pushReplacement(
                        MaterialPageRoute(builder: (_) => const LoginScreen()),
                      ),
                      style: TextButton.styleFrom(
                        foregroundColor: AppTheme.neonOrange,
                        padding: EdgeInsets.zero,
                        minimumSize: Size.zero,
                        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                      ),
                      child: const Text('Login'),
                    ),
                  ],
                ),
                const SizedBox(height: 24),
              ],
            ),
          ),
        ),
      ),
    );
  }

  InputDecoration _inputDecoration(String label, String hint, IconData icon) {
    return InputDecoration(
      labelText: label,
      hintText: hint,
      prefixIcon: Icon(icon, color: AppTheme.neonOrange, size: 22),
      labelStyle: const TextStyle(color: AppTheme.neonOrange),
      hintStyle: TextStyle(color: Colors.grey.shade600),
      fillColor: AppTheme.surfaceDark,
      filled: true,
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: AppTheme.neonOrange, width: 1.5),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: AppTheme.neonOrange, width: 2),
      ),
    );
  }
}
