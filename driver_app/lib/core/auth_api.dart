import 'dart:convert';

import 'package:http/http.dart' as http;

import 'api_config.dart';

/// Auth API client for email+password auth + legacy phone OTP.
class AuthApi {
  AuthApi({String? baseUrl}) : _base = baseUrl ?? kApiBaseUrl;

  final String _base;

  String _url(String path) => '$_base/api/auth$path';

  // ═══════════════════════════════════════════════════════════════
  // NEW: Email + Password auth (backend-managed, ZeptoMail OTP)
  // ═══════════════════════════════════════════════════════════════

  /// POST /api/auth/signup — Create account with email+password.
  Future<AuthResponse> signup({
    required String email,
    required String password,
    required String name,
    String? phone,
    String role = 'driver',
  }) async {
    try {
      final uri = Uri.parse(_url('/signup'));
      final res = await http.post(
        uri,
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'email': email.trim().toLowerCase(),
          'password': password,
          'name': name.trim(),
          if (phone != null && phone.trim().isNotEmpty) 'phone': phone.trim(),
          'role': role,
        }),
      ).timeout(const Duration(seconds: 15));

      Map<String, dynamic> data = {};
      try {
        final decoded = jsonDecode(res.body);
        if (decoded is Map<String, dynamic>) data = decoded;
      } catch (_) {
        // Non-JSON response body
      }

      final msg = (data['message'] as String?) ??
          ((data['error'] is Map) ? (data['error']['message'] as String?) : null) ??
          (res.statusCode == 429 ? 'Too many requests. Please wait and try again.' : null) ??
          'Signup failed';

      return AuthResponse(
        success: data['success'] as bool? ?? (res.statusCode >= 200 && res.statusCode < 300),
        message: msg,
        token: data['token'] as String?,
        user: _parseUser(data['user']),
      );
    } catch (e) {
      return const AuthResponse(success: false, message: 'Cannot reach server. Check network.');
    }
  }

  /// POST /api/auth/email-login — Login with email+password.
  Future<AuthResponse> emailLogin({
    required String email,
    required String password,
    String? role,
  }) async {
    try {
      final uri = Uri.parse(_url('/email-login'));
      final res = await http.post(
        uri,
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'email': email.trim().toLowerCase(),
          'password': password,
          if (role != null) 'role': role,
        }),
      ).timeout(const Duration(seconds: 15));

      Map<String, dynamic> data = {};
      try {
        final decoded = jsonDecode(res.body);
        if (decoded is Map<String, dynamic>) data = decoded;
      } catch (_) {}

      final code = data['code'] as String?;
      final msg = (data['message'] as String?) ??
          ((data['error'] is Map) ? (data['error']['message'] as String?) : null) ??
          (res.statusCode == 429 ? 'Too many requests. Please wait and try again.' : null) ??
          'Login failed';
      return AuthResponse(
        success: data['success'] as bool? ?? (res.statusCode >= 200 && res.statusCode < 300),
        message: msg,
        token: data['token'] as String?,
        user: _parseUser(data['user']),
        code: code,
      );
    } catch (e) {
      return const AuthResponse(success: false, message: 'Cannot reach server. Check network.');
    }
  }

  /// POST /api/auth/verify-email — Verify email OTP after signup.
  Future<AuthResponse> verifyEmail({
    required String email,
    required String otp,
    String role = 'driver',
  }) async {
    try {
      final uri = Uri.parse(_url('/verify-email'));
      final res = await http.post(
        uri,
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'email': email.trim().toLowerCase(),
          'otp': otp.trim(),
          'role': role,
        }),
      ).timeout(const Duration(seconds: 15));

      Map<String, dynamic> data = {};
      try {
        final decoded = jsonDecode(res.body);
        if (decoded is Map<String, dynamic>) data = decoded;
      } catch (_) {}

      final msg = (data['message'] as String?) ??
          ((data['error'] is Map) ? (data['error']['message'] as String?) : null) ??
          (res.statusCode == 429 ? 'Too many requests. Please wait and try again.' : null) ??
          'Verification failed';
      return AuthResponse(
        success: data['success'] as bool? ?? (res.statusCode >= 200 && res.statusCode < 300),
        message: msg,
        token: data['token'] as String?,
        user: _parseUser(data['user']),
      );
    } catch (e) {
      return const AuthResponse(success: false, message: 'Cannot reach server. Check network.');
    }
  }

  /// POST /api/auth/send-verification-otp — Resend verification OTP.
  Future<AuthResponse> sendVerificationOtp({
    required String email,
    String role = 'driver',
  }) async {
    try {
      final uri = Uri.parse(_url('/send-verification-otp'));
      final res = await http.post(
        uri,
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'email': email.trim().toLowerCase(), 'role': role}),
      ).timeout(const Duration(seconds: 15));
      final data = jsonDecode(res.body) as Map<String, dynamic>? ?? {};
      return AuthResponse(
        success: data['success'] as bool? ?? false,
        message: data['message'] as String? ?? 'Failed',
      );
    } catch (e) {
      return const AuthResponse(success: false, message: 'Cannot reach server. Check network.');
    }
  }

  /// POST /api/auth/forgot-password — Send password reset OTP.
  Future<AuthResponse> forgotPassword({
    required String email,
    String role = 'driver',
  }) async {
    try {
      final uri = Uri.parse(_url('/forgot-password'));
      final res = await http.post(
        uri,
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'email': email.trim().toLowerCase(), 'role': role}),
      ).timeout(const Duration(seconds: 15));
      final data = jsonDecode(res.body) as Map<String, dynamic>? ?? {};
      return AuthResponse(
        success: data['success'] as bool? ?? false,
        message: data['message'] as String? ?? 'Failed',
      );
    } catch (e) {
      return const AuthResponse(success: false, message: 'Cannot reach server. Check network.');
    }
  }

  /// POST /api/auth/reset-password — Verify OTP + set new password.
  Future<AuthResponse> resetPassword({
    required String email,
    required String otp,
    required String newPassword,
    String role = 'driver',
  }) async {
    try {
      final uri = Uri.parse(_url('/reset-password'));
      final res = await http.post(
        uri,
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'email': email.trim().toLowerCase(),
          'otp': otp.trim(),
          'newPassword': newPassword,
          'role': role,
        }),
      ).timeout(const Duration(seconds: 15));
      final data = jsonDecode(res.body) as Map<String, dynamic>? ?? {};
      return AuthResponse(
        success: data['success'] as bool? ?? false,
        message: data['message'] as String? ?? 'Failed',
      );
    } catch (e) {
      return const AuthResponse(success: false, message: 'Cannot reach server. Check network.');
    }
  }

  AppUserDto? _parseUser(dynamic u) {
    if (u == null || u is! Map<String, dynamic>) return null;
    return AppUserDto(
      id: u['id'] as String? ?? '',
      email: u['email'] as String? ?? '',
      name: u['name'] as String? ?? '',
      phone: u['phone'] as String? ?? '',
      role: u['role'] as String? ?? '',
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // LEGACY: Phone-based auth (kept for backward compat)
  // ═══════════════════════════════════════════════════════════════

  /// POST /api/auth/login — phone_number, role (user|driver).
  Future<LoginResponse> login({
    required String phoneNumber,
    required String role,
  }) async {
    try {
      final uri = Uri.parse(_url('/login'));
      final res = await http.post(
        uri,
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'phone_number': phoneNumber,
          'role': role,
        }),
      ).timeout(const Duration(seconds: 15));
      final data = jsonDecode(res.body) as Map<String, dynamic>? ?? {};
      return LoginResponse(
        success: data['success'] as bool? ?? false,
        message: data['message'] as String? ?? 'Unknown error',
        otp: data['otp'] as String?,
      );
    } catch (e) {
      return const LoginResponse(
        success: false,
        message: 'Cannot reach server. Check network.',
        otp: null,
      );
    }
  }

  /// POST /api/auth/verify — phone_number, otp.
  Future<VerifyResponse> verify({
    required String phoneNumber,
    required String otp,
  }) async {
    try {
      final uri = Uri.parse(_url('/verify'));
      final res = await http.post(
        uri,
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'phone_number': phoneNumber,
          'otp': otp,
        }),
      ).timeout(const Duration(seconds: 15));
      final data = jsonDecode(res.body) as Map<String, dynamic>? ?? {};
      final success = data['success'] as bool? ?? false;
      final user = data['user'] as Map<String, dynamic>?;
      return VerifyResponse(
        success: success,
        message: data['message'] as String? ?? 'Verification failed',
        token: data['token'] as String?,
        user: user != null
            ? UserDto(
                id: user['id'] as String? ?? '',
                phone: user['phone'] as String? ?? '',
                role: user['role'] as String? ?? '',
                rating: (user['rating'] as num?)?.toDouble() ?? 0,
                driverId: user['driverId'] as String?,
              )
            : null,
      );
    } catch (e) {
      return const VerifyResponse(
        success: false,
        message: 'Cannot reach server. Check network.',
        token: null,
        user: null,
      );
    }
  }

  /// POST /api/auth/driver/link-email — Store phone->email for driver (call on signup).
  Future<bool> linkEmail({required String phone, required String email}) async {
    try {
      final uri = Uri.parse(_url('/driver/link-email'));
      final res = await http.post(
        uri,
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'phone': phone.trim(), 'email': email.trim().toLowerCase()}),
      ).timeout(const Duration(seconds: 10));
      final data = jsonDecode(res.body) as Map<String, dynamic>? ?? {};
      return data['success'] as bool? ?? false;
    } catch (_) {
      return false;
    }
  }

  /// POST /api/auth/driver/forgot-password-phone — Send OTP to driver phone.
  Future<Map<String, dynamic>> sendResetOtpPhone(String phone) async {
    try {
      final uri = Uri.parse(_url('/driver/forgot-password-phone'));
      final res = await http.post(
        uri,
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'phone': phone.trim()}),
      ).timeout(const Duration(seconds: 15));
      final data = jsonDecode(res.body) as Map<String, dynamic>? ?? {};
      return {
        'success': data['success'] as bool? ?? false,
        'message': data['message'] as String? ?? 'Failed',
        'otp': data['otp'] as String?,
      };
    } catch (_) {
      return {'success': false, 'message': 'Cannot reach server.', 'otp': null};
    }
  }

  /// POST /api/auth/driver/reset-password-phone — Verify OTP and set new password (Firebase updated by backend).
  Future<Map<String, dynamic>> resetPasswordWithPhoneOtp({
    required String phone,
    required String otp,
    required String newPassword,
  }) async {
    try {
      final uri = Uri.parse(_url('/driver/reset-password-phone'));
      final res = await http.post(
        uri,
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'phone': phone.trim(),
          'otp': otp.trim(),
          'newPassword': newPassword,
        }),
      ).timeout(const Duration(seconds: 15));
      final data = jsonDecode(res.body) as Map<String, dynamic>? ?? {};
      return {
        'success': data['success'] as bool? ?? false,
        'message': data['message'] as String? ?? 'Failed',
      };
    } catch (_) {
      return {'success': false, 'message': 'Cannot reach server.'};
    }
  }

  /// GET /api/auth/driver/phone-by-email?email=xxx — Reverse lookup: get phone from linked email.
  /// Bug fix: needed for email login when Firebase credential has no phoneNumber.
  Future<String?> getPhoneByEmail(String email) async {
    try {
      final uri = Uri.parse(_url('/driver/phone-by-email')).replace(
        queryParameters: {'email': email.trim().toLowerCase()},
      );
      final res = await http
          .get(uri, headers: {'Content-Type': 'application/json'})
          .timeout(const Duration(seconds: 10));
      final data = jsonDecode(res.body) as Map<String, dynamic>? ?? {};
      if (data['success'] == true) {
        return data['phone'] as String?;
      }
      return null;
    } catch (_) {
      return null;
    }
  }

  /// GET /api/drivers/verification-status?driverId=xxx or phone=xxx
  /// Check if driver is registered and get verification status
  Future<VerifyResponse> getVerificationStatus(String phone) async {
    try {
      final uri = Uri.parse('$_base/api/drivers/verification-status').replace(
        queryParameters: {'phone': phone},
      );
      final res = await http
          .get(
            uri,
            headers: {'Content-Type': 'application/json'},
          )
          .timeout(
            const Duration(seconds: 15),
            onTimeout: () => throw Exception('Verification status request timeout'),
          );
      if (res.statusCode != 200) {
        return VerifyResponse(
          success: false,
          message: 'Server returned ${res.statusCode}',
          token: null,
          user: null,
        );
      }
      final data = jsonDecode(res.body) as Map<String, dynamic>? ?? {};
      // Backend returns {status, hasVerification, canGoOnline, ...} — NOT 'ok'.
      final hasStatus = data.containsKey('status');
      return VerifyResponse(
        success: hasStatus,
        message: data['message'] as String? ?? '',
        token: null,
        user: null,
      );
    } catch (e) {
      return VerifyResponse(
        success: false,
        message: 'Cannot reach server. Check backend at $_base and network.',
        token: null,
        user: null,
      );
    }
  }
}

/// Response for new email+password auth endpoints.
class AuthResponse {
  const AuthResponse({
    required this.success,
    required this.message,
    this.token,
    this.user,
    this.code,
  });
  final bool success;
  final String message;
  final String? token;
  final AppUserDto? user;
  final String? code; // e.g. 'email_not_verified'
}

class AppUserDto {
  const AppUserDto({
    required this.id,
    required this.email,
    required this.name,
    required this.phone,
    required this.role,
  });
  final String id;
  final String email;
  final String name;
  final String phone;
  final String role;
}

/// Legacy response classes (kept for backward compat with phone auth)
class LoginResponse {
  const LoginResponse({
    required this.success,
    required this.message,
    this.otp,
  });
  final bool success;
  final String message;
  final String? otp;
}

class VerifyResponse {
  const VerifyResponse({
    required this.success,
    required this.message,
    this.token,
    this.user,
  });
  final bool success;
  final String message;
  final String? token;
  final UserDto? user;
}

class UserDto {
  const UserDto({
    required this.id,
    required this.phone,
    required this.role,
    required this.rating,
    this.driverId,
  });
  final String id;
  final String phone;
  final String role;
  final double rating;
  final String? driverId; // Driver ID (DRV-XXXXX format)
}
