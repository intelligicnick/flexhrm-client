#!/bin/bash
# Creates a deployment-ready ZIP for VPS upload.
# Includes source, built dist, JSON seed data, and docs.
# Excludes node_modules and secrets.

set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
STAMP=$(date +%Y%m%d-%H%M)
OUT_NAME="flex-hrm-deploy-${STAMP}"
OUT_DIR="/tmp/${OUT_NAME}"
ZIP_PATH="${ROOT}/${OUT_NAME}.zip"

echo "==> Building production bundle..."
npm run build

echo "==> Preparing export folder..."
rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR"

# Core application files
cp package.json package-lock.json "$OUT_DIR/"
cp server.ts "$OUT_DIR/" 2>/dev/null || true
cp -r scripts src "$OUT_DIR/"
cp -r dist "$OUT_DIR/"
cp index.html vite.config.ts tsconfig.json "$OUT_DIR/" 2>/dev/null || true
cp README.md .env.example ecosystem.config.cjs "$OUT_DIR/"
cp -r deploy "$OUT_DIR/" 2>/dev/null || true
chmod +x "$OUT_DIR/scripts/"*.sh

# JSON seed data (used by backend migrate:json, not deleted from frontend)
for f in employees-db.json admins-db.json roles-db.json audit-logs-db.json; do
  if [ -f "$ROOT/$f" ]; then
    cp "$ROOT/$f" "$OUT_DIR/"
    echo "    + $f"
  fi
done

# Never include real .env
rm -f "$OUT_DIR/.env" "$OUT_DIR/.env.local"

echo "==> Creating ZIP..."
rm -f "$ZIP_PATH"
(cd /tmp && zip -r "$ZIP_PATH" "$OUT_NAME" -x "*.DS_Store")

echo ""
echo "Export complete:"
echo "  $ZIP_PATH"
echo ""
echo "Upload this ZIP to your VPS, then run scripts/install-on-server.sh"
echo "Deploy the MongoDB API backend separately (see flexhrm-server)."
