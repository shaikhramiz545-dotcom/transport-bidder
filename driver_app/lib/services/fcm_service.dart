import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart' show kIsWeb, defaultTargetPlatform, TargetPlatform;
import 'dart:convert';
import 'package:http/http.dart' as http;

import 'package:tbidder_driver_app/core/api_config.dart';
import 'package:tbidder_driver_app/services/profile_storage_service.dart';

/// Top-level background handler – must be top-level, not inside a class.
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  // Run when app is in background or terminated. E.g. ride request – backend can send FCM.
}

/// FCM: get token, request permission, handle foreground/opened notifications.
class FcmService {
  static final FcmService _instance = FcmService._();
  factory FcmService() => _instance;

  FcmService._();

  final FirebaseMessaging _messaging = FirebaseMessaging.instance;

  Future<Map<String, String>> _authHeaders({bool json = false}) async {
    final headers = <String, String>{};
    if (json) headers['Content-Type'] = 'application/json';
    final token = await ProfileStorageService.getAuthToken();
    if (token != null && token.trim().isNotEmpty) {
      headers['Authorization'] = 'Bearer ${token.trim()}';
    }
    return headers;
  }

  Future<void> _registerTokenWithBackend(String token) async {
    try {
      final platform = defaultTargetPlatform.name;
      final uri = Uri.parse('$kApiBaseUrl/api/drivers/fcm-token');
      await http
          .post(
            uri,
            headers: await _authHeaders(json: true),
            body: jsonEncode({
              'token': token,
              'platform': platform,
            }),
          )
          .timeout(const Duration(seconds: 8), onTimeout: () => throw Exception('Timeout'));
    } catch (_) {
      // Best-effort
    }
  }

  /// Last FCM token (for testing – show in Profile).
  static String? lastToken;

  /// Callback for foreground messages – set from main to show SnackBar.
  static void Function(String title, String body)? onForegroundMessage;

  /// Call after Firebase.initializeApp(). Requests permission and gets token.
  /// On web, skips token (needs firebase-messaging-sw.js) so app still loads.
  Future<void> init() async {
    if (kIsWeb) {
      lastToken = null;
      _setupForegroundListener();
      _setupOpenedAppListener();
      return;
    }
    await _requestPermission();
    final token = await getToken();
    if (token != null) {
      lastToken = token;
      await _registerTokenWithBackend(token);
    }
    _setupForegroundListener();
    _setupOpenedAppListener();

    // Token can rotate; keep backend updated.
    FirebaseMessaging.instance.onTokenRefresh.listen((t) async {
      lastToken = t;
      await _registerTokenWithBackend(t);
    });
  }

  Future<void> _requestPermission() async {
    await _messaging.requestPermission(
      alert: true,
      badge: true,
      sound: true,
    );
  }

  /// Returns FCM token to send to backend. On web, returns null (no SW by default).
  Future<String?> getToken() async {
    if (kIsWeb) return null;
    if (defaultTargetPlatform == TargetPlatform.iOS) {
      final apns = await _messaging.getAPNSToken();
      if (apns == null) return null;
    }
    final t = await _messaging.getToken();
    if (t != null) lastToken = t;
    return t;
  }

  void _setupForegroundListener() {
    FirebaseMessaging.onMessage.listen((RemoteMessage message) {
      final title = message.notification?.title ?? message.data['title'] ?? 'New request';
      final body = message.notification?.body ?? message.data['body'] ?? '';
      onForegroundMessage?.call(title, body);
    });
  }

  void _setupOpenedAppListener() {
    FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
      // if (data['type'] == 'ride_request') navigate to home / request screen
    });
  }
}
