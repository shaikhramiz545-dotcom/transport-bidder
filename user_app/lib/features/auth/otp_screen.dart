import 'package:flutter/material.dart';
import 'package:tbidder_user_app/core/app_theme.dart';
import 'package:tbidder_user_app/core/auth_api.dart';
import 'package:tbidder_user_app/features/home/home_screen.dart';
import 'package:tbidder_user_app/services/profile_storage_service.dart';

/// OTP verification — 6-digit code, cream theme.
class OtpScreen extends StatefulWidget {
  const OtpScreen({
    super.key,
    required this.phoneNumber,
    required this.role,
  });

  final String phoneNumber;
  final String role;

  @override
  State<OtpScreen> createState() => _OtpScreenState();
}

class _OtpScreenState extends State<OtpScreen> {
  final _formKey = GlobalKey<FormState>();
  final _otpController = TextEditingController();
  final _authApi = AuthApi();
  bool _loading = false;
  bool _resending = false;
  bool _autoVerifyFired = false; // Prevent multiple auto-submits

  @override
  void initState() {
    super.initState();
    // Auto-submit when 4 digits entered
    _otpController.addListener(_maybeAutoVerify);
  }

  @override
  void dispose() {
    _otpController.removeListener(_maybeAutoVerify);
    _otpController.dispose();
    super.dispose();
  }

  void _maybeAutoVerify() {
    if (_autoVerifyFired || _loading) return;
    final value = _otpController.text.trim();
    if (value.length == 6) {
      _autoVerifyFired = true;
      _verify();
    }
  }

  Future<void> _verify() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _loading = true);
    try {
      final res = await _authApi.verify(
        phoneNumber: widget.phoneNumber,
        otp: _otpController.text.trim(),
      );
      if (!mounted) return;
      if (res.success) {
        await ProfileStorageService.saveAuthToken(res.token);
        await ProfileStorageService.savePhone(widget.phoneNumber);
        Navigator.of(context).pushAndRemoveUntil(
          MaterialPageRoute(
            builder: (_) => const HomeScreen(),
          ),
          (r) => false,
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(res.message)),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e')),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _loading = false);
        _autoVerifyFired = false; // Allow retry if verification failed
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.cream,
      appBar: AppBar(
        backgroundColor: AppTheme.cream,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => Navigator.of(context).pop(),
        ),
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const SizedBox(height: 8),
                Center(
                  child: Image.asset(
                    'assets/Both App logo.png',
                    height: 56,
                    fit: BoxFit.contain,
                    errorBuilder: (_, __, ___) => const SizedBox.shrink(),
                  ),
                ),
                const SizedBox(height: 16),
                Text(
                  'Enter verification code',
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                        fontWeight: FontWeight.bold,
                      ),
                ),
                const SizedBox(height: 8),
                Text(
                  'We sent a 6-digit code to ${widget.phoneNumber}',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: Colors.black54,
                      ),
                ),
                const SizedBox(height: 32),
                TextFormField(
                  controller: _otpController,
                  keyboardType: TextInputType.number,
                  maxLength: 6,
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                        letterSpacing: 8,
                      ),
                  decoration: InputDecoration(
                    hintText: '······',
                    counterText: '',
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: const BorderSide(
                        color: AppTheme.neonOrange,
                        width: 1.5,
                      ),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: const BorderSide(
                        color: AppTheme.neonOrange,
                        width: 2,
                      ),
                    ),
                  ),
                  validator: (v) {
                    final s = v?.trim() ?? '';
                    if (s.length != 6) return 'Enter the 6-digit code';
                    return null;
                  },
                ),
                const SizedBox(height: 24),
                FilledButton(
                  onPressed: _loading ? null : _verify,
                  style: FilledButton.styleFrom(
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
                      : const Text('Verify'),
                ),
                const SizedBox(height: 16),
                TextButton(
                  onPressed: _resending ? null : _resendOtp,
                  child: _resending
                      ? const SizedBox(
                          height: 16,
                          width: 16,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Text("Didn't receive the code? Resend"),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _resendOtp() async {
    setState(() => _resending = true);
    try {
      final res = await _authApi.login(
        phoneNumber: widget.phoneNumber,
        role: widget.role,
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(res.success ? 'OTP resent to ${widget.phoneNumber}' : res.message),
          backgroundColor: res.success ? Colors.green : Colors.red,
        ),
      );
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Failed to resend OTP'), backgroundColor: Colors.red),
      );
    } finally {
      if (mounted) setState(() => _resending = false);
    }
  }
}
