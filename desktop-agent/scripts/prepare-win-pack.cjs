const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const arch = process.argv.includes('--arm64') ? 'arm64' : 'x64';
const activeWinDir = path.join(root, 'node_modules', 'active-win');
const winBinding = path.join(
  activeWinDir,
  'lib',
  'binding',
  `napi-6-win32-unknown-${arch}`,
  'node-active-win.node',
);

if (process.platform === 'win32') {
  process.exit(0);
}

if (!fs.existsSync(activeWinDir)) {
  console.error('Run npm install in desktop-agent before packaging.');
  process.exit(1);
}

if (fs.existsSync(winBinding)) {
  console.log(`Windows native binary already present (${arch}).`);
  process.exit(0);
}

console.log(`Fetching active-win Windows (${arch}) native binary for packaging...`);
execSync(
  `npx node-pre-gyp install --fallback-to-build=false --target_platform=win32 --target_arch=${arch}`,
  { cwd: activeWinDir, stdio: 'inherit' },
);
