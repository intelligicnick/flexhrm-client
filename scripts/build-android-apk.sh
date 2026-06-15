#!/bin/bash
# Production-build the supervisor web UI and package a debug APK.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ANDROID_DIR="${ROOT}/android-supervisor-app"
ASSETS_DIR="${ANDROID_DIR}/app/src/main/assets/www"

echo "==> Building production frontend bundle..."
cd "$ROOT"
npm run build

echo "==> Syncing dist/ into Android assets..."
rm -rf "$ASSETS_DIR"
mkdir -p "$ASSETS_DIR"
cp -R dist/. "$ASSETS_DIR/"

echo "==> Building Android APK..."
cd "$ANDROID_DIR"
./gradlew assembleDebug

APK_PATH="${ANDROID_DIR}/app/build/outputs/apk/debug/app-debug.apk"
STAMPED_APK="${ROOT}/FlexHRM-FieldTeam-v1.5.apk"
cp "$APK_PATH" "$STAMPED_APK"

echo ""
echo "APK ready:"
echo "  ${APK_PATH}"
echo "  ${STAMPED_APK}"
