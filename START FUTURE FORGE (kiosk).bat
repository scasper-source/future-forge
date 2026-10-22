@echo off
title Future Forge kiosk
cd /d "%~dp0"
REM Booth mode: full screen, no browser bars, camera allowed without prompts.
REM Exit kiosk mode with Alt+F4.
start "Future Forge server - close this window to stop" /min powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\serve.ps1" 8765
timeout /t 2 /nobreak >nul
set URL=http://127.0.0.1:8765/
curl -s -o nul --max-time 3 http://127.0.0.1:8765/index.html >nul 2>nul
if errorlevel 1 set URL=file:///%~dp0index.html
set BROWSER=
for %%p in ("%ProgramFiles%\Google\Chrome\Application\chrome.exe" "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" "%LocalAppData%\Google\Chrome\Application\chrome.exe" "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe") do (
  if not defined BROWSER if exist %%p set BROWSER=%%p
)
if not defined BROWSER (
  echo Chrome or Edge not found. Opening in the default browser instead ^(press F11 for full screen^).
  start "" "%URL%"
  timeout /t 6 >nul
  goto :eof
)
start "" %BROWSER% --kiosk --app="%URL%" --use-fake-ui-for-media-stream --autoplay-policy=no-user-gesture-required --disable-features=Translate --no-first-run --user-data-dir="%TEMP%\future-forge-kiosk"
