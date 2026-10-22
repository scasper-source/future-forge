#!/bin/bash
# Future Forge — macOS booth mode: full screen, no browser bars, camera allowed without prompts.
# Quit with Cmd+Q.
cd "$(dirname "$0")"
PORT=8765
URL="http://127.0.0.1:$PORT/"
if xcode-select -p >/dev/null 2>&1 && command -v python3 >/dev/null 2>&1; then
  lsof -iTCP:$PORT -sTCP:LISTEN >/dev/null 2>&1 || (python3 -m http.server $PORT --bind 127.0.0.1 >/dev/null 2>&1 &)
  sleep 1
else
  URL="file://$(pwd)/index.html"
fi
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
EDGE="/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"
if [ -x "$CHROME" ]; then BIN="$CHROME"; elif [ -x "$EDGE" ]; then BIN="$EDGE"; else open "$URL"; echo "Chrome/Edge not found; opened in the default browser. Press Ctrl+Cmd+F for full screen."; exit 0; fi
"$BIN" --kiosk --app="$URL" --use-fake-ui-for-media-stream --autoplay-policy=no-user-gesture-required --no-first-run --user-data-dir="/tmp/future-forge-kiosk" >/dev/null 2>&1 &
