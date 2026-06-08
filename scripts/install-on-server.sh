#!/bin/bash
# One-time Flex HRM frontend install on VPS (run after unzip).
# Usage: chmod +x scripts/install-on-server.sh && ./scripts/install-on-server.sh
#
# Requires the NestJS + MongoDB backend running separately (see ../backend).

set -e
cd "$(dirname "$0")/.."
APP_DIR="$(pwd)"

echo "============================================"
echo "  Flex HRM — Frontend Installation"
echo "============================================"
echo ""

# --- Check Node.js ---
if ! command -v node &>/dev/null; then
  echo "Node.js not found. Install Node 20+ first:"
  echo "  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -"
  echo "  sudo apt-get install -y nodejs"
  exit 1
fi
echo "Node.js: $(node -v)"

# --- .env ---
if [ ! -f .env ]; then
  if [ -f .env.example ]; then
    cp .env.example .env
    echo ""
    echo "Created .env from .env.example"
    echo ">>> EDIT .env NOW with your BACKEND_URL, then re-run this script <<<"
    echo "  nano .env"
    exit 0
  else
    echo "ERROR: .env.example missing"
    exit 1
  fi
fi

mkdir -p "$APP_DIR/logs"

# --- Install & build ---
echo ""
echo "==> Installing dependencies..."
npm install

echo "==> Building production bundle..."
npm run build

# --- PM2 ---
echo ""
if command -v pm2 &>/dev/null; then
  echo "==> Starting with PM2..."
  pm2 delete flexhrm 2>/dev/null || true
  pm2 start ecosystem.config.cjs
  pm2 save
  echo ""
  echo "PM2 status:"
  pm2 status flexhrm
else
  echo "PM2 not installed. Install globally:"
  echo "  sudo npm install -g pm2"
  echo "Then run:"
  echo "  pm2 start ecosystem.config.cjs && pm2 save && pm2 startup"
  echo ""
  echo "Or start manually:"
  echo "  npm start"
fi

echo ""
echo "============================================"
echo "  Frontend installation complete!"
echo "  UI: http://YOUR_SERVER_IP:3000"
echo "  Ensure the MongoDB API backend is running"
echo "  and BACKEND_URL in .env points to it."
echo "============================================"
