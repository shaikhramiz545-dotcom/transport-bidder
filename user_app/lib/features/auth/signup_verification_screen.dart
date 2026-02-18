import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:tbidder_user_app/core/app_theme.dart';
import 'package:tbidder_user_app/features/home/home_screen.dart';
import 'package:tbidder_user_app/l10n/app_locale.dart';
import 'package:tbidder_user_app/services/biometric_service.dart';
import 'package:tbidder_user_app/services/profile_storage_service.dart';
import 'package:tbidder_user_app/widgets/biometric_prompt_dialog.dart';

/// After signup: user must verify email (Firebase link) and phone (OTP). Then only go to Home.
class SignupVerificationScreen extends StatefulWidget {
  const SignupVerificationScreen({
    super.key,
    required this.name,
    required this.email,
    required this.phone,
    required this.password,
  });

  final String name;
  final String email;
  final String phone;
  final String password;

  @override
  State<SignupVerificationScreen> createState() => _SignupVerificationScreenState();
}

class _SignupVerificationScreenState extends State<SignupVerificationScreen> {
  final _formKey = GlobalKey<FormState>();
  final _otpController = TextEditingController();
  final _biometricService = BiometricService();

  bool _emailVerified = false;
  bool _phoneVerified = false;
  bool _checkingEmail = false;
  bool _verifyingOtp = false;
  bool _phoneCodeSent = false;
  String? _phoneVerificationId;

  String _t(String k, [Map<String, dynamic>? p]) =>
      (AppLocaleScope.of(context)?.t ?? (String key, [Map<String, dynamic>? params]) => translate(key, defaultLocale, params))(k, p);

  @override
  void dispose() {
    _otpController.dispose();
    super.dispose();
  }

  Future<void> _checkEmailVerified() async {
    setState(() => _checkingEmail = true);
    try {
      await FirebaseAuth.instance.currentUser?.reload();
      final verified = FirebaseAuth.instance.currentUser?.emailVerified ?? false;
      if (mounted) {
        setState(() {
          _emailVerified = verified;
          _checkingEmail = false;
        });
        if (!verified) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(_t('email_not_verified_yet')), backgroundColor: Colors.orange),
          );
        }
      }
    } catch (_) {
      if (mounted) setState(() => _checkingEmail = false);
    }
  }

  /// Ensure E.164 format: +countryCode + number (e.g. +519876543210)
  String _normalizePhone(String phone) {
    final p = phone.trim().replaceAll(RegExp(r'[\s\-\(\)]'), '');
    if (p.isEmpty) return p;
    if (p.startsWith('+')) return p;
    // Default to +51 (Peru) if no country code provided
    if (p.length >= 10 && !p.startsWith('0')) return '+51$p';
    return '+51$p';
  }

  Future<void> _sendFirebasePhoneOtp() async {
    final phone = _normalizePhone(widget.phone);
    if (phone.isEmpty || phone.length < 10) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(_t('enter_phone')), backgroundColor: Colors.orange),
      );
      return;
    }
    setState(() => _verifyingOtp = true);
    try {
      await FirebaseAuth.instance.verifyPhoneNumber(
        phoneNumber: phone,
        timeout: const Duration(seconds: 60),
        verificationCompleted: (PhoneAuthCredential credential) async {
          try {
            final user = FirebaseAuth.instance.currentUser;
            if (user != null) {
              await user.linkWithCredential(credential);
            } else {
              await FirebaseAuth.instance.signInWithCredential(credential);
            }
            if (!mounted) return;
            setState(() {
              _phoneVerified = true;
              _phoneCodeSent = true;
              _verifyingOtp = false;
            });
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Phone verified.'), backgroundColor: Colors.green),
            );
          } catch (_) {}
        },
        verificationFailed: (FirebaseAuthException e) {
          if (!mounted) return;
          setState(() => _verifyingOtp = false);
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(e.message ?? 'Phone verification failed'), backgroundColor: Colors.red),
          );
        },
        codeSent: (String verificationId, int? resendToken) {
          if (!mounted) return;
          setState(() {
            _phoneVerificationId = verificationId;
            _phoneCodeSent = true;
            _verifyingOtp = false;
          });
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('OTP sent to your phone.'), backgroundColor: Colors.green),
          );
        },
        codeAutoRetrievalTimeout: (String verificationId) {
          _phoneVerificationId = verificationId;
        },
      );
    } catch (e) {
      if (mounted) {
        setState(() => _verifyingOtp = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Phone verification error: $e'), backgroundColor: Colors.red),
        );
      }
    }
    if (mounted && !_phoneCodeSent) setState(() => _verifyingOtp = false);
  }

  Future<void> _verifyPhoneOtpManual() async {
    final smsCode = _otpController.text.trim();
    if (smsCode.length < 4) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(_t('enter_otp')), backgroundColor: Colors.orange),
      );
      return;
    }
    if (_phoneVerificationId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please send OTP first.'), backgroundColor: Colors.orange),
      );
      return;
    }
    setState(() => _verifyingOtp = true);
    try {
      final cred = PhoneAuthProvider.credential(
        verificationId: _phoneVerificationId!,
        smsCode: smsCode,
      );
      final user = FirebaseAuth.instance.currentUser;
      if (user != null) {
        await user.linkWithCredential(cred);
      } else {
        await FirebaseAuth.instance.signInWithCredential(cred);
      }
      if (!mounted) return;
      setState(() => _phoneVerified = true);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Phone verified.'), backgroundColor: Colors.green),
      );
    } on FirebaseAuthException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.message ?? 'Invalid code'), backgroundColor: Colors.red),
      );
    } finally {
      if (mounted) setState(() => _verifyingOtp = false);
    }
  }

  Future<void> _finishAndGoHome() async {
    if (!_emailVerified || !_phoneVerified) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(_t('both_verifications_required')), backgroundColor: Colors.orange),
      );
      return;
    }
    await ProfileStorageService.saveName(widget.name);
    await ProfileStorageService.saveEmail(widget.email);
    await ProfileStorageService.savePhone(widget.phone);

    final supported = await _biometricService.isDeviceSupported();
    final shown = await _biometricService.hasPromptBeenShown();
    if (!mounted) return;
    if (!supported || shown) {
      Navigator.of(context).pushAndRemoveUntil(
        MaterialPageRoute(builder: (_) => const HomeScreen()),
        (route) => false,
      );
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Account verified. Welcome!'), backgroundColor: Colors.green),
      );
      return;
    }
    final type = await _biometricService.getBiometricType();
    await showBiometricAddPrompt(
      context: context,
      biometricType: type,
      onAdd: () async {
        await _biometricService.enable(widget.email, widget.password);
        if (!mounted) return;
        Navigator.of(context).pushAndRemoveUntil(
          MaterialPageRoute(builder: (_) => const HomeScreen()),
          (route) => false,
        );
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Account verified. $type added for quick login.'), backgroundColor: Colors.green),
        );
      },
      onSkip: () async {
        await _biometricService.markPromptShown();
        if (!mounted) return;
        Navigator.of(context).pushAndRemoveUntil(
          MaterialPageRoute(builder: (_) => const HomeScreen()),
          (route) => false,
        );
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Account verified. Welcome!'), backgroundColor: Colors.green),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.cream,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => Navigator.of(context).pop(),
          color: AppTheme.textDark,
        ),
        title: Text(
          _t('verify_email_phone_title'),
          style: Theme.of(context).textTheme.titleLarge?.copyWith(
                fontWeight: FontWeight.bold,
                color: AppTheme.textDark,
              ),
        ),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
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
                // --- Email verification ---
                Card(
                  margin: EdgeInsets.zero,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Icon(
                              _emailVerified ? Icons.check_circle : Icons.mail_outline,
                              color: _emailVerified ? Colors.green : AppTheme.neonOrange,
                              size: 28,
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Text(
                                _emailVerified ? 'Email verified' : '1. Verify email',
                                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                                      fontWeight: FontWeight.w600,
                                      color: _emailVerified ? Colors.green : AppTheme.textDark,
                                    ),
                              ),
                            ),
                          ],
                        ),
                        if (!_emailVerified) ...[
                          const SizedBox(height: 12),
                          Text(
                            _t('verify_email_sent', {'email': widget.email}),
                            style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: Colors.black87),
                          ),
                          const SizedBox(height: 12),
                          SizedBox(
                            width: double.infinity,
                            child: FilledButton.icon(
                              onPressed: _checkingEmail ? null : _checkEmailVerified,
                              style: FilledButton.styleFrom(
                                backgroundColor: AppTheme.neonOrange,
                                padding: const EdgeInsets.symmetric(vertical: 12),
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                              ),
                              icon: _checkingEmail
                                  ? const SizedBox(
                                      width: 20,
                                      height: 20,
                                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                                    )
                                  : const Icon(Icons.refresh, size: 20),
                              label: Text(_t('i_verified_email')),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 20),
                // --- Phone OTP ---
                Card(
                  margin: EdgeInsets.zero,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Icon(
                              _phoneVerified ? Icons.check_circle : Icons.phone_android,
                              color: _phoneVerified ? Colors.green : AppTheme.neonOrange,
                              size: 28,
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Text(
                                _phoneVerified ? 'Phone verified' : '2. Verify phone',
                                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                                      fontWeight: FontWeight.w600,
                                      color: _phoneVerified ? Colors.green : AppTheme.textDark,
                                    ),
                              ),
                            ),
                          ],
                        ),
                        if (!_phoneVerified) ...[
                          const SizedBox(height: 12),
                          Text(
                            _t('verify_phone_otp_sent', {'phone': widget.phone}),
                            style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: Colors.black87),
                          ),
                          const SizedBox(height: 12),
                          if (!_phoneCodeSent)
                            SizedBox(
                              width: double.infinity,
                              child: FilledButton(
                                onPressed: _verifyingOtp ? null : _sendFirebasePhoneOtp,
                                style: FilledButton.styleFrom(
                                  backgroundColor: AppTheme.neonOrange,
                                  padding: const EdgeInsets.symmetric(vertical: 12),
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                ),
                                child: _verifyingOtp
                                    ? const SizedBox(
                                        height: 22,
                                        width: 22,
                                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                                      )
                                    : const Text('Send OTP'),
                              ),
                            )
                          else ...[
                            TextFormField(
                              controller: _otpController,
                              keyboardType: TextInputType.number,
                              maxLength: 6,
                              textAlign: TextAlign.center,
                              style: Theme.of(context).textTheme.headlineSmall?.copyWith(letterSpacing: 8),
                              decoration: InputDecoration(
                                hintText: '······',
                                counterText: '',
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
                            ),
                            const SizedBox(height: 12),
                            SizedBox(
                              width: double.infinity,
                              child: FilledButton(
                                onPressed: _verifyingOtp ? null : _verifyPhoneOtpManual,
                                style: FilledButton.styleFrom(
                                  backgroundColor: AppTheme.neonOrange,
                                  padding: const EdgeInsets.symmetric(vertical: 12),
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                ),
                                child: _verifyingOtp
                                    ? const SizedBox(
                                        height: 22,
                                        width: 22,
                                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                                      )
                                    : Text(_t('verify_and_continue')),
                              ),
                            ),
                            const SizedBox(height: 8),
                            Center(
                              child: TextButton(
                                onPressed: _verifyingOtp ? null : _sendFirebasePhoneOtp,
                                child: const Text("Didn't receive the code? Resend"),
                              ),
                            ),
                          ],
                        ],
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 28),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    onPressed: _finishAndGoHome,
                    style: FilledButton.styleFrom(
                      backgroundColor: Colors.green,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    child: const Text('Continue to app'),
                  ),
                ),
                const SizedBox(height: 24),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
