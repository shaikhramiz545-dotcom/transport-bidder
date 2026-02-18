/// Web: localhost by default; server deploy par --dart-define=BACKEND_URL=https://api.yourserver.com
const String kApiBaseUrl = String.fromEnvironment(
  'BACKEND_URL',
  defaultValue: 'https://tbidder-backend-738469456510.us-central1.run.app',
);
