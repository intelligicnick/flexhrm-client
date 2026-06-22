#!/bin/bash
# Production-build the Observer Admin web UI and package a debug APK.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ANDROID_DIR="${ROOT}/android-observer-app"
ASSETS_DIR="${ANDROID_DIR}/app/src/main/assets/www"

echo "==> Building production frontend bundle..."
cd "$ROOT"
VITE_DISABLE_PWA=true npm run build

echo "==> Syncing dist/ into Android assets..."
rm -rf "$ASSETS_DIR"
mkdir -p "$ASSETS_DIR"
cp -R dist/. "$ASSETS_DIR/"

echo "==> Building Android APK..."
cd "$ANDROID_DIR"

if [ ! -f local.properties ] && [ -f "${ROOT}/android-supervisor-app/local.properties" ]; then
  cp "${ROOT}/android-supervisor-app/local.properties" local.properties
fi

if [ -z "${JAVA_HOME:-}" ]; then
  if [ -d "/Applications/Android Studio.app/Contents/jbr/Contents/Home" ]; then
    export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
  fi
fi

chmod +x ./gradlew
./gradlew assembleDebug

APK_PATH="${ANDROID_DIR}/app/build/outputs/apk/debug/app-debug.apk"
STAMPED_APK="${ROOT}/FlexHRM-ObserverAdmin-v1.0.0.apk"
cp "$APK_PATH" "$STAMPED_APK"

echo ""
echo "APK ready:"
echo "  ${APK_PATH}"
echo "  ${STAMPED_APK}"
