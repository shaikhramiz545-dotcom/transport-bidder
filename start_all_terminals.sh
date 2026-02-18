#!/bin/bash
# TransportBidder - Opens 5 terminals: Backend, User app, Driver app, Agency portal, Admin panel
# Run in order: Backend first, then others.

ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "Opening 5 terminals. Run in order: Backend first, then others."
echo ""
echo "Terminal 1: Backend (migrate + start)"
osascript -e "tell application \"Terminal\" to do script \"export PATH='/usr/local/opt/postgresql@16/bin:\$PATH' && cd '$ROOT/backend' && npm run migrate && npm start\""

sleep 3

echo "Terminal 2: User app"
osascript -e "tell application \"Terminal\" to do script \"cd '$ROOT/user_app' && flutter pub get && flutter run -d chrome --web-renderer=html\""

echo "Terminal 3: Driver app"
osascript -e "tell application \"Terminal\" to do script \"cd '$ROOT/driver_app' && flutter pub get && flutter run -d chrome --web-renderer=html\""

echo "Terminal 4: Agency portal (Travel Partner)"
osascript -e "tell application \"Terminal\" to do script \"cd '$ROOT/agency_portal' && npm install && npm run dev\""

echo "Terminal 5: Admin panel"
osascript -e "tell application \"Terminal\" to do script \"cd '$ROOT/admin_panel' && npm install && npm run dev\""

echo ""
echo "All 5 terminals opened. Backend must be running before others work."
echo "URLs: Backend 4000 | User/Driver = Chrome | Agency 5174 | Admin 5173"
