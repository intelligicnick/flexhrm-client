#!/bin/bash
# Build static frontend for Hostinger Website (public_html).
# Creates flexhrm-frontend-static-YYYYMMDD-HHMM.zip ready to upload.

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
STAMP=$(date +%Y%m%d-%H%M)
ZIP_NAME="flexhrm-frontend-static-${STAMP}.zip"
ZIP_PATH="${ROOT}/${ZIP_NAME}"

echo "==> Syncing shared client-config..."
node "$(dirname "$0")/sync-client-config.mjs"

echo "==> Building production static bundle (PWA disabled for Hostinger reliability)..."
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=4096}"
npm run build:hostinger:static

if [[ ! -f dist/index.html ]]; then
  echo "ERROR: dist/index.html missing — build failed." >&2
  exit 1
fi

npm run verify:hostinger

echo "==> Creating upload ZIP (static files only)..."
rm -f "$ZIP_PATH"
(
  cd dist
  zip -r "$ZIP_PATH" . -x "server.cjs" -x "server.cjs.map" -x "*.DS_Store"
)

echo ""
echo "Hostinger frontend bundle ready:"
echo "  $ZIP_PATH"
echo ""
echo "Upload in hPanel → Websites → greenyellow app → File Manager → public_html:"
echo "  1. Delete old files in public_html (keep .htaccess if re-uploading)"
echo "  2. Upload and extract $ZIP_NAME"
echo "  3. Confirm index.html and .htaccess are directly inside public_html"
echo "  4. Open https://greenyellow-woodpecker-750354.hostingersite.com/hrmlogin"
