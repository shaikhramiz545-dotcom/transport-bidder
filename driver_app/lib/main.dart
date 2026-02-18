import 'dart:async';
import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_crashlytics/firebase_crashlytics.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:tbidder_driver_app/core/app_theme.dart';
import 'package:tbidder_driver_app/core/firm_config.dart';
import 'package:tbidder_driver_app/features/auth/login_screen.dart';
import 'package:tbidder_driver_app/features/home/home_screen.dart';
import 'package:tbidder_driver_app/firebase_options.dart';
import 'package:tbidder_driver_app/l10n/app_locale.dart';
import 'package:tbidder_driver_app/services/fcm_service.dart';
import 'package:tbidder_driver_app/services/profile_storage_service.dart';

final GlobalKey<ScaffoldMessengerState> kScaffoldMessengerKey = GlobalKey<ScaffoldMessengerState>();

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  await runZonedGuarded(() async {
    try {
      await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);

      FlutterError.onError = FirebaseCrashlytics.instance.recordFlutterFatalError;

      PlatformDispatcher.instance.onError = (error, stack) {
        FirebaseCrashlytics.instance.recordError(error, stack, fatal: true);
        return true;
      };

      FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);
      FcmService.onForegroundMessage = (title, body) {
        kScaffoldMessengerKey.currentState?.showSnackBar(
          SnackBar(content: Text('$title: $body'), backgroundColor: AppTheme.neonOrange),
        );
      };
      await FcmService().init();
    } catch (e) {
      // Web: FCM service worker missing etc. – app still runs; push works on Android/iOS.
    }
    runApp(const TbidderDriverApp());
  }, (error, stack) {
    FirebaseCrashlytics.instance.recordError(error, stack, fatal: true);
  });
}

class TbidderDriverApp extends StatefulWidget {
  const TbidderDriverApp({super.key});

  @override
  State<TbidderDriverApp> createState() => _TbidderDriverAppState();
}

class _TbidderDriverAppState extends State<TbidderDriverApp> {
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
      title: kDriverAppTitle,
      debugShowCheckedModeBanner: false,
      theme: AppTheme.dark,
      darkTheme: AppTheme.dark,
      themeMode: ThemeMode.dark,
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
      // Keep the user logged in across refresh if phone or Firebase session exists.
      home: _localeLoaded ? const _AuthGate() : const _LoadingScreen(),
    );
  }
}

class _AuthGate extends StatefulWidget {
  const _AuthGate();

  @override
  State<_AuthGate> createState() => _AuthGateState();
}

class _AuthGateState extends State<_AuthGate> {
  bool _checking = true;
  bool _isLoggedIn = false;

  @override
  void initState() {
    super.initState();
    _checkSession();
  }

  Future<void> _checkSession() async {
    final token = await ProfileStorageService.getAuthToken();
    if (!mounted) return;
    setState(() {
      _isLoggedIn = token != null && token.isNotEmpty;
      _checking = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_checking) return const _LoadingScreen();
    return _isLoggedIn ? const HomeScreen() : const LoginScreen();
  }
}

class _LoadingScreen extends StatelessWidget {
  const _LoadingScreen();

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      backgroundColor: AppTheme.darkBg,
      body: Center(child: CircularProgressIndicator(color: AppTheme.neonOrange)),
    );
  }
}
