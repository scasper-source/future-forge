#!/bin/bash
# Future Forge — macOS launcher. Double-click to run.
# Uses a tiny local web server if the Mac has Python (all Macs with Xcode
# command-line tools do); otherwise opens index.html directly, which also works.
cd "$(dirname "$0")"
PORT=8765
if xcode-select -p >/dev/null 2>&1 && command -v python3 >/dev/null 2>&1; then
  if ! lsof -iTCP:$PORT -sTCP:LISTEN >/dev/null 2>&1; then
    (python3 -m http.server $PORT --bind 127.0.0.1 >/dev/null 2>&1 &)
    sleep 1
  fi
  open "http://127.0.0.1:$PORT/"
  echo "Future Forge is running at http://127.0.0.1:$PORT/ — leave this window open, or close it to stop the server."
else
  open "index.html"
  echo "Opened index.html directly."
fi
