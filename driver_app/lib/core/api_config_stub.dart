/// Web / non-IO: match backend default PORT (4000).
/// Override: `--dart-define=BACKEND_URL=http://localhost:4000` (or your server URL).
const String kApiBaseUrl = String.fromEnvironment(
  'BACKEND_URL',
  defaultValue: 'https://tbidder-backend-738469456510.us-central1.run.app',
);
