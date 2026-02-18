#!/bin/bash
# Run User App on Android Phone
# Connect phone via USB, enable USB debugging, ensure PC and phone are on same WiFi.

# Get local IP (macOS)
MY_PC_IP=$(ipconfig getifaddr en0)
if [ -z "$MY_PC_IP" ]; then
  MY_PC_IP=$(ipconfig getifaddr en1) # Try WiFi if en0 (ethernet) fails
fi

BACKEND_URL="http://$MY_PC_IP:4000"

echo "Backend URL: $BACKEND_URL"
echo ""
echo "Ensure backend is running: cd backend && npm start"
echo ""

cd "$(dirname "$0")/user_app" || exit
flutter run -d android --dart-define=BACKEND_URL="$BACKEND_URL"
