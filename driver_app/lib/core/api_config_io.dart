/// Backend URL priority:
/// 1. --dart-define=BACKEND_URL=https://api.transportbidder.com (production)
/// 2. Android emulator: 10.0.2.2:4000 (host machine)
/// 3. iOS sim / desktop: localhost:4000
///
/// For physical device testing, build with:
///   flutter run --dart-define=BACKEND_URL=http://192.168.1.5:4000
/// For production APK:
///   flutter build apk --dart-define=BACKEND_URL=https://api.transportbidder.com
final String kApiBaseUrl = () {
  const override = String.fromEnvironment(
    'BACKEND_URL',
    defaultValue: '',
  );
  if (override.isNotEmpty) return override;
  return 'http://tbidder-prod.eba-tyxfmwej.ap-south-1.elasticbeanstalk.com';
}();
