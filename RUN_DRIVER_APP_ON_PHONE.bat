@echo off
REM TransportBidder - Driver app ko Android phone par run karo.
REM Pehle: Phone USB se connect karo, USB debugging ON, PC aur phone same WiFi par.
REM Apna PC IP niche set karo (ipconfig se IPv4 dekho - Wireless LAN adapter Wi-Fi).

set MY_PC_IP=192.168.1.5
set BACKEND_URL=http://%MY_PC_IP%:4000

echo Backend URL: %BACKEND_URL%
echo.
echo Ensure backend is running: cd backend ^& npm start
echo.
cd /d "%~dp0driver_app"
flutter run -d android --dart-define=BACKEND_URL=%BACKEND_URL%
pause
