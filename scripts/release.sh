#!/bin/bash
# Build Rundown.app and install it to /Applications, replacing any running
# instance. Run via `npm run release`.
#
# electron-packager's zip extraction step is known to silently hang and
# exit 0 with no output on some newer Node builds (observed on Node 26.7.0).
# To stay working across machines/Node versions without manual intervention,
# this script tries a few candidate `node` binaries until one actually
# produces the .app bundle.
set -euo pipefail

cd "$(dirname "$0")/.."

APP_NAME="Rundown"
DIST_DIR="dist/${APP_NAME}-darwin-arm64"
DIST_APP="${DIST_DIR}/${APP_NAME}.app"
DEST="/Applications/${APP_NAME}.app"
BUILD_TIMEOUT=240

run_with_timeout() {
  local secs=$1; shift
  "$@" &
  local pid=$!
  ( sleep "$secs" && kill -9 "$pid" 2>/dev/null ) &
  local watcher=$!
  local status=0
  wait "$pid" 2>/dev/null || status=$?
  kill -9 "$watcher" 2>/dev/null || true
  wait "$watcher" 2>/dev/null || true
  return "$status"
}

echo "==> Installing dependencies"
npm install

echo "==> Finding a working node binary"
CANDIDATES=()
for c in /usr/local/bin/node /opt/homebrew/bin/node "$(command -v node)"; do
  if [ -n "$c" ] && [ -x "$c" ]; then
    already=0
    for existing in "${CANDIDATES[@]:-}"; do
      [ "$existing" = "$c" ] && already=1
    done
    [ "$already" -eq 0 ] && CANDIDATES+=("$c")
  fi
done

BUILD_OK=0
for NODE_BIN in "${CANDIDATES[@]}"; do
  echo "==> Trying build with $NODE_BIN ($("$NODE_BIN" -v))"
  rm -rf dist
  if run_with_timeout "$BUILD_TIMEOUT" "$NODE_BIN" ./node_modules/.bin/electron-packager . "$APP_NAME" \
      --platform=darwin --arch=arm64 --out=dist --overwrite --icon=icon.icns \
      && [ -d "$DIST_APP" ]; then
    echo "==> Build succeeded with $NODE_BIN"
    BUILD_OK=1
    break
  fi
  echo "==> Build failed or hung with $NODE_BIN, trying next candidate"
done

if [ "$BUILD_OK" -ne 1 ]; then
  echo "ERROR: could not build ${APP_NAME}.app with any available node binary." >&2
  echo "Tried: ${CANDIDATES[*]}" >&2
  exit 1
fi

echo "==> Quitting ${APP_NAME} if it's running"
osascript -e "tell application \"${APP_NAME}\" to quit" >/dev/null 2>&1 || true
sleep 1
pkill -x "$APP_NAME" >/dev/null 2>&1 || true

echo "==> Installing to /Applications"
rm -rf "$DEST"
cp -R "$DIST_APP" "$DEST"

echo "==> Launching ${APP_NAME}"
open "$DEST"

echo "==> Done."
