@echo off
title Future Forge
cd /d "%~dp0"
echo Starting Future Forge...
REM A tiny local web server (nothing to install) so the browser remembers the camera permission.
start "Future Forge server - close this window to stop" /min powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\serve.ps1" 8765
timeout /t 2 /nobreak >nul
curl -s -o nul --max-time 3 http://127.0.0.1:8765/index.html >nul 2>nul
if errorlevel 1 (
  echo The local server could not start. Opening index.html directly instead - everything still works.
  start "" "%~dp0index.html"
) else (
  start "" "http://127.0.0.1:8765/"
  echo Future Forge is open in your browser at http://127.0.0.1:8765/
)
echo You can close this window.
timeout /t 8 >nul
