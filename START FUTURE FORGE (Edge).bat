@echo off
title Future Forge
cd /d "%~dp0"
echo Starting Future Forge in Microsoft Edge...
REM Same as START FUTURE FORGE.bat, but always opens Microsoft Edge (falls back to the default browser if Edge is missing).
start "Future Forge server - close this window to stop" /min powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\serve.ps1" 8765
timeout /t 2 /nobreak >nul
set URL=http://127.0.0.1:8765/
curl -s -o nul --max-time 3 http://127.0.0.1:8765/index.html >nul 2>nul
if errorlevel 1 set URL=file:///%~dp0index.html
set EDGE=
for %%p in ("%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe") do (
  if not defined EDGE if exist %%p set EDGE=%%p
)
if not defined EDGE (
  echo Microsoft Edge was not found. Opening in the default browser instead.
  start "" "%URL%"
) else (
  start "" %EDGE% "%URL%"
)
echo Future Forge is open. You can close this window.
timeout /t 5 >nul
