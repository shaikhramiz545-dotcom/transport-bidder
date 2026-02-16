import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart' show kIsWeb, defaultTargetPlatform, TargetPlatform;

/// Top-level background handler – must be top-level, not inside a class.
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  // Run when app is in background or terminated. Handle data here if needed.
}

/// FCM: get token, request permission, handle foreground/opened notifications.
class FcmService {
  static final FcmService _instance = FcmService._();
  factory FcmService() => _instance;

  FcmService._();

  final FirebaseMessaging _messaging = FirebaseMessaging.instance;

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
    if (token != null) lastToken = token;
    _setupForegroundListener();
    _setupOpenedAppListener();
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
      final title = message.notification?.title ?? message.data['title'] ?? 'Notification';
      final body = message.notification?.body ?? message.data['body'] ?? '';
      onForegroundMessage?.call(title, body);
    });
  }

  void _setupOpenedAppListener() {
    FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
      // final data = message.data;
      // if (data['type'] == 'ride') navigate to ride screen etc.
    });
  }
}
