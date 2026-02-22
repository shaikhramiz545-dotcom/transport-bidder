import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:tbidder_driver_app/core/app_theme.dart';
import 'package:tbidder_driver_app/core/auth_api.dart';
import 'package:tbidder_driver_app/features/home/home_screen.dart';
import 'package:tbidder_driver_app/services/profile_storage_service.dart';
import 'package:tbidder_driver_app/services/ride_bid_service.dart';

/// OTP verification — Firebase 6-digit or backend 6-digit, dark theme.
class OtpScreen extends StatefulWidget {
  const OtpScreen({
    super.key,
    required this.phoneNumber,
    required this.role,
    this.verificationId,
    this.driverName,
    this.driverEmail,
  });

  final String phoneNumber;
  final String role;
  /// When set, verify with Firebase PhoneAuthProvider; otherwise use backend AuthApi.verify.
  final String? verificationId;
  final String? driverName;
  final String? driverEmail;

  @override
  State<OtpScreen> createState() => _OtpScreenState();
}

class _OtpScreenState extends State<OtpScreen> {
  final _formKey = GlobalKey<FormState>();
  final _otpController = TextEditingController();
  final _authApi = AuthApi();
  bool _loading = false;
  bool _resending = false;
  bool _autoVerifyFired = false;

  Future<void> _bootstrapBackendJwt() async {
    try {
      final login = await _authApi.login(phoneNumber: widget.phoneNumber, role: widget.role);
      if (!login.success || login.otp == null || login.otp!.trim().isEmpty) return;
      final verify = await _authApi.verify(phoneNumber: widget.phoneNumber, otp: login.otp!.trim());
      if (verify.success) {
        await ProfileStorageService.saveAuthToken(verify.token);
      }
    } catch (_) {}
  }

  @override
  void initState() {
    super.initState();
    _otpController.addListener(_maybeAutoVerify);
  }

  @override
  void dispose() {
    _otpController.removeListener(_maybeAutoVerify);
    _otpController.dispose();
    super.dispose();
  }

  int get _otpLength => 6;

  void _maybeAutoVerify() {
    // Bug fix: auto-verify once OTP length is complete.
    if (_autoVerifyFired || _loading) return;
    final value = _otpController.text.trim();
    if (value.length == _otpLength) {
      _autoVerifyFired = true;
      _verify();
    }
  }

  Future<void> _verify() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _loading = true);
    try {
      if (widget.verificationId != null) {
        final cred = PhoneAuthProvider.credential(
          verificationId: widget.verificationId!,
          smsCode: _otpController.text.trim(),
        );
        await FirebaseAuth.instance.signInWithCredential(cred);
        if (!mounted) return;
        await ProfileStorageService.savePhone(widget.phoneNumber);
        if (widget.driverName != null && widget.driverName!.isNotEmpty) {
          await ProfileStorageService.saveName(widget.driverName!);
        }
        if (widget.driverEmail != null && widget.driverEmail!.isNotEmpty) {
          await ProfileStorageService.saveEmail(widget.driverEmail!);
        }
        await _bootstrapBackendJwt();
        if (!mounted) return;
        Navigator.of(context).pushAndRemoveUntil(
          MaterialPageRoute(builder: (_) => const HomeScreen()),
          (r) => false,
        );
      } else {
        final res = await _authApi.verify(
          phoneNumber: widget.phoneNumber,
          otp: _otpController.text.trim(),
        );
        if (!mounted) return;
        if (res.success) {
          await ProfileStorageService.saveAuthToken(res.token);
          await ProfileStorageService.savePhone(widget.phoneNumber);
          // Auto-generate driver ID immediately after login
          String? driverId = res.user?.driverId;
          if (driverId == null || driverId.isEmpty) {
            // Call backend to generate driver ID using phone number
            try {
              final rideBidService = RideBidService();
              driverId = await rideBidService.resolveDriverIdByPhone(widget.phoneNumber);
              if (driverId != null && driverId.isNotEmpty) {
                await ProfileStorageService.saveDriverId(driverId);
              }
            } catch (_) {
              // If auto-generation fails, driver can still proceed - ID will be created on first /location call
            }
          } else {
            await ProfileStorageService.saveDriverId(driverId);
          }
          if (!mounted) return;
          Navigator.of(context).pushAndRemoveUntil(
            MaterialPageRoute(builder: (_) => const HomeScreen()),
            (r) => false,
          );
        } else {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(res.message)),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _loading = false);
      // Allow retry if verification failed.
      _autoVerifyFired = false;
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
                        color: AppTheme.onDark,
                      ),
                ),
                const SizedBox(height: 8),
                Text(
                  'We sent a 6-digit code to ${widget.phoneNumber}',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: AppTheme.onDark,
                      ),
                ),
                const SizedBox(height: 32),
                TextFormField(
                  controller: _otpController,
                  keyboardType: TextInputType.number,
                  maxLength: _otpLength,
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                        letterSpacing: 8,
                        color: AppTheme.neonOrange,
                      ),
                  decoration: InputDecoration(
                    hintText: _otpLength == 6 ? '······' : '····',
                    hintStyle: TextStyle(color: Colors.grey.shade600),
                    counterText: '',
                    fillColor: AppTheme.surfaceDark,
                    filled: true,
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
                    if (s.length != _otpLength) return _otpLength == 6 ? 'Enter the 6-digit code' : 'Enter the 4-digit code';
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
                            color: Colors.black87,
                          ),
                        )
                      : const Text('Verify'),
                ),
                const SizedBox(height: 16),
                TextButton(
                  onPressed: _resending ? null : _resendOtp,
                  style: TextButton.styleFrom(foregroundColor: AppTheme.neonOrange),
                  child: _resending
                      ? const SizedBox(
                          height: 16,
                          width: 16,
                          child: CircularProgressIndicator(strokeWidth: 2, color: AppTheme.neonOrange),
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
      if (widget.verificationId != null) {
        // Firebase phone OTP: re-trigger verifyPhoneNumber
        await FirebaseAuth.instance.verifyPhoneNumber(
          phoneNumber: widget.phoneNumber,
          timeout: const Duration(seconds: 60),
          verificationCompleted: (_) {},
          verificationFailed: (e) {
            if (!mounted) return;
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text(e.message ?? 'Failed to resend OTP'), backgroundColor: Colors.red),
            );
          },
          codeSent: (String verificationId, int? resendToken) {
            if (!mounted) return;
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text('OTP resent to ${widget.phoneNumber}'),
                backgroundColor: Colors.green,
              ),
            );
          },
          codeAutoRetrievalTimeout: (_) {},
        );
      } else {
        // Backend phone OTP: call login again to re-send
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
      }
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
