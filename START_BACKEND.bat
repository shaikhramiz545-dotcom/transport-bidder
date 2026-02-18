@echo off
title TBidder Backend - Port 4000
echo Starting TBidder API on http://localhost:4000 ...
echo Keep this window open. Tours and other features need this.
echo.
cd /d "%~dp0backend"
node src/server.js
pause
