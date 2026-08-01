#!/usr/bin/env bash
# Nobify desktop companion — macOS / Linux installer
# Downloads the latest companion binary from GitHub Releases, installs it to
# ~/.local/bin/nobify, and registers it to run at login (LaunchAgent on macOS,
# systemd --user on Linux).
#
#   curl -fsSL https://<owner>.github.io/<repo>/install.sh | bash
#
# Optional server URL:
#   curl -fsSL .../install.sh | bash -s -- --server https://my-server
#
# (c) Ionity Global (Pty) Ltd — https://www.ionity.co.za
set -euo pipefail

REPO="Ionity-Global/ionity-assets-ionity-global-ionity-today"
SERVER=""
while [ $# -gt 0 ]; do
  case "$1" in
    --server) SERVER="${2:-}"; shift 2 ;;
    --server=*) SERVER="${1#*=}"; shift ;;
    *) shift ;;
  esac
done

case "$(uname -s)" in
  Darwin) ASSET="nobify-companion-macos" ;;
  Linux)  ASSET="nobify-companion-linux" ;;
  *) echo "Unsupported OS: $(uname -s)"; exit 1 ;;
esac

URL="https://github.com/$REPO/releases/latest/download/$ASSET"
BIN_DIR="$HOME/.local/bin"
BIN="$BIN_DIR/nobify"

echo ""
echo "  Nobify companion installer"
echo "  =========================="
mkdir -p "$BIN_DIR"
echo "  Downloading $ASSET ..."
if ! curl -fsSL "$URL" -o "$BIN"; then
  echo "  Download failed. No release asset yet? See $URL"
  exit 1
fi
chmod +x "$BIN"
echo "  Installed to $BIN"

case ":$PATH:" in
  *":$BIN_DIR:"*) : ;;
  *) echo "  NOTE: add $BIN_DIR to your PATH." ;;
esac

if [ "$(uname -s)" = "Darwin" ]; then
  PLIST="$HOME/Library/LaunchAgents/za.co.ionity.nobify.plist"
  mkdir -p "$HOME/Library/LaunchAgents"
  ARGS="<string>$BIN</string>"
  [ -n "$SERVER" ] && ARGS="$ARGS<string>--server</string><string>$SERVER</string>"
  cat > "$PLIST" <<PLISTEOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>za.co.ionity.nobify</string>
  <key>ProgramArguments</key><array>$ARGS</array>
  <key>RunAtLoad</key><true/>
</dict></plist>
PLISTEOF
  launchctl unload "$PLIST" 2>/dev/null || true
  launchctl load "$PLIST" 2>/dev/null || true
  echo "  Registered LaunchAgent (starts at login)."
else
  UNIT_DIR="$HOME/.config/systemd/user"
  mkdir -p "$UNIT_DIR"
  EXECLINE="$BIN"
  [ -n "$SERVER" ] && EXECLINE="$BIN --server $SERVER"
  cat > "$UNIT_DIR/nobify.service" <<UNITEOF
[Unit]
Description=Nobify presence-detection companion
After=network-online.target

[Service]
ExecStart=$EXECLINE
Restart=on-failure

[Install]
WantedBy=default.target
UNITEOF
  if command -v systemctl >/dev/null 2>&1; then
    systemctl --user daemon-reload 2>/dev/null || true
    systemctl --user enable --now nobify.service 2>/dev/null || true
    echo "  Registered systemd --user service (starts at login)."
  else
    echo "  systemd not found; run manually: $EXECLINE"
  fi
fi

echo ""
if [ -n "$SERVER" ]; then
  echo "  Server set to: $SERVER"
else
  echo "  Start with your server URL:  nobify --server https://your-server"
fi
echo "  Done."
echo ""
