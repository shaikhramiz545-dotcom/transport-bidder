import 'dart:async';
import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_crashlytics/firebase_crashlytics.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:tbidder_user_app/core/app_brand.dart';
import 'package:tbidder_user_app/core/app_theme.dart';
import 'package:tbidder_user_app/features/auth/login_screen.dart';
import 'package:tbidder_user_app/features/home/home_screen.dart';
import 'package:tbidder_user_app/firebase_options.dart';
import 'package:tbidder_user_app/l10n/app_locale.dart';
import 'package:tbidder_user_app/services/fcm_service.dart';
import 'package:tbidder_user_app/services/profile_storage_service.dart';

final GlobalKey<ScaffoldMessengerState> kScaffoldMessengerKey = GlobalKey<ScaffoldMessengerState>();

void main() {
  runZonedGuarded(() async {
    WidgetsFlutterBinding.ensureInitialized();
    try {
      await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);

      FlutterError.onError = FirebaseCrashlytics.instance.recordFlutterFatalError;

      PlatformDispatcher.instance.onError = (error, stack) {
        FirebaseCrashlytics.instance.recordError(error, stack, fatal: true);
        return true;
      };

      if (kDebugMode) {
        await FirebaseCrashlytics.instance.setCrashlyticsCollectionEnabled(true);
      }

      FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);
      FcmService.onForegroundMessage = (title, body) {
        kScaffoldMessengerKey.currentState?.showSnackBar(
          SnackBar(content: Text('$title: $body'), backgroundColor: const Color(0xFFFF6700)),
        );
      };
      await FcmService().init();
    } catch (e) {
      // Web: FCM service worker missing etc. – app still runs; push works on Android/iOS.
    }
    runApp(const TbidderUserApp());
  }, (error, stack) {
    FirebaseCrashlytics.instance.recordError(error, stack, fatal: true);
  });
}

class TbidderUserApp extends StatefulWidget {
  const TbidderUserApp({super.key});

  @override
  State<TbidderUserApp> createState() => _TbidderUserAppState();
}

class _TbidderUserAppState extends State<TbidderUserApp> {
  Locale _locale = defaultLocale;
  bool _localeLoaded = false;

  @override
  void initState() {
    super.initState();
    loadLocale();
  }

  Future<void> loadLocale() async {
    final loc = await loadSavedLocale();
    if (mounted) setState(() { _locale = loc; _localeLoaded = true; });
  }

  void _setLocale(Locale locale) {
    saveLocale(locale);
    setState(() => _locale = locale);
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      scaffoldMessengerKey: kScaffoldMessengerKey,
      title: kAppName,
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light,
      locale: _locale,
      supportedLocales: supportedLocales,
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      builder: (context, child) {
        if (child == null) return const Scaffold(body: Center(child: CircularProgressIndicator()));
        return AppLocaleScope(
          locale: _locale,
          t: (key, [params]) => translate(key, _locale, params),
          setLocale: _setLocale,
          child: child,
        );
      },
      home: _localeLoaded ? const _AuthGate() : const _LoadingScreen(),
    );
  }
}


/// Auth gate: checks for saved JWT token → HomeScreen or LoginScreen.
class _AuthGate extends StatefulWidget {
  const _AuthGate();

  @override
  State<_AuthGate> createState() => _AuthGateState();
}

class _AuthGateState extends State<_AuthGate> {
  bool _checking = true;
  bool _loggedIn = false;

  @override
  void initState() {
    super.initState();
    _checkAuth();
  }

  Future<void> _checkAuth() async {
    final token = await ProfileStorageService.getAuthToken();
    if (mounted) {
      setState(() {
        _loggedIn = token != null && token.isNotEmpty;
        _checking = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_checking) return const _LoadingScreen();
    return _loggedIn ? const HomeScreen() : const LoginScreen();
  }
}

class _LoadingScreen extends StatelessWidget {
  const _LoadingScreen();

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: Center(child: CircularProgressIndicator()),
    );
  }
}
