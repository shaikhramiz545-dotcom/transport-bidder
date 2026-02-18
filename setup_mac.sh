#!/bin/bash
# Master Setup Script for macOS Migration
# This script cleans up Windows-specific artifacts and installs dependencies for macOS.

ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "=== TransportBidder macOS Setup ==="
echo "Project Root: $ROOT"
echo ""

# 1. Backend Setup
echo "--- Setting up Backend ---"
if [ -d "$ROOT/backend" ]; then
  cd "$ROOT/backend" || exit
  if [ -d "node_modules" ]; then
    echo "Removing existing node_modules (Windows artifacts)..."
    rm -rf node_modules
  fi
  echo "Installing backend dependencies..."
  npm install
else
  echo "Error: Backend directory not found!"
fi
echo ""

# 2. Admin Panel Setup
echo "--- Setting up Admin Panel ---"
if [ -d "$ROOT/admin_panel" ]; then
  cd "$ROOT/admin_panel" || exit
  if [ -d "node_modules" ]; then
    echo "Removing existing node_modules..."
    rm -rf node_modules
  fi
  echo "Installing admin panel dependencies..."
  npm install
else
  echo "Error: Admin Panel directory not found!"
fi
echo ""

# 3. Agency Portal Setup
echo "--- Setting up Agency Portal ---"
if [ -d "$ROOT/agency_portal" ]; then
  cd "$ROOT/agency_portal" || exit
  if [ -d "node_modules" ]; then
    echo "Removing existing node_modules..."
    rm -rf node_modules
  fi
  echo "Installing agency portal dependencies..."
  npm install
else
  echo "Error: Agency Portal directory not found!"
fi
echo ""

# 4. Mobile Apps Cleanup (Flutter)
# We need to clean to remove Windows paths from Generated.xcconfig etc.
echo "--- Cleaning Mobile Apps (Flutter) ---"

setup_flutter_app() {
  APP_DIR="$1"
  APP_NAME="$2"
  
  if [ -d "$APP_DIR" ]; then
    echo "Setting up $APP_NAME..."
    cd "$APP_DIR" || exit
    
    if command -v flutter &> /dev/null; then
      echo "Running flutter clean..."
      flutter clean
      echo "Running flutter pub get..."
      flutter pub get
      
      # iOS Setup (CocoaPods)
      if [ -d "ios" ]; then
        echo "Installing iOS Pods..."
        cd ios || exit
        if command -v pod &> /dev/null; then
          pod install
        else
          echo "Warning: 'pod' command not found. Skipping pod install. Make sure CocoaPods is installed."
        fi
        cd ..
      fi
    else
      echo "Warning: 'flutter' command not found. Skipping Flutter setup for $APP_NAME."
      echo "Please run 'flutter clean' and 'flutter pub get' manually in $APP_DIR."
    fi
  else
    echo "Error: $APP_NAME directory not found!"
  fi
  echo ""
}

setup_flutter_app "$ROOT/user_app" "User App"
setup_flutter_app "$ROOT/driver_app" "Driver App"

echo "=== Setup Complete ==="
echo "You can now run the project using ./start_all_terminals.sh"
echo "Make sure to check backend/.env for any Windows-specific paths if you have custom file storage configs."
