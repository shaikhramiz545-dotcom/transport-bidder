@echo off
REM TransportBidder - 5 terminals kholta hai: Backend, User app, Driver app, Agency portal, Admin panel
REM Sabse pehle Terminal 1 (Backend) start hota hai; baaki uske baad chala sakte ho.

set "ROOT=%~dp0"
set "ROOT=%ROOT:~0,-1%"

echo Opening 5 terminals. Run in order: Backend first, then others.
echo.
echo Terminal 1: Backend (migrate + start)
start "TBidder - Backend" cmd /k cd /d "%ROOT%\backend" ^&^& npm run migrate ^&^& npm start

timeout /t 3 /nobreak >nul

echo Terminal 2: User app
start "TBidder - User App" cmd /k cd /d "%ROOT%\user_app" ^&^& flutter pub get ^&^& flutter run -d chrome --web-renderer=html

echo Terminal 3: Driver app
start "TBidder - Driver App" cmd /k cd /d "%ROOT%\driver_app" ^&^& flutter pub get ^&^& flutter run -d chrome --web-renderer=html

echo Terminal 4: Agency portal (Travel Partner)
start "TBidder - Agency Portal" cmd /k cd /d "%ROOT%\agency_portal" ^&^& npm install ^&^& npm run dev

echo Terminal 5: Admin panel
start "TBidder - Admin Panel" cmd /k cd /d "%ROOT%\admin_panel" ^&^& npm install ^&^& npm run dev

echo.
echo All 5 terminals opened. Backend must be running before others work.
echo URLs: Backend 4000 | User/Driver = Chrome | Agency 5174 | Admin 5173
pause
