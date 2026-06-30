#!/usr/bin/env node
/** Sync shared/client-config.json into frontend deploy artifacts. */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = path.join(root, 'shared', 'client-config.json');
const config = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));

const extensionConfig = {
  apiBase: config.apiOrigin,
  frontendOrigin: config.frontendOrigin,
};

const extensionConfigPath = path.join(root, 'public', 'extension-config.json');
fs.writeFileSync(extensionConfigPath, `${JSON.stringify(extensionConfig, null, 2)}\n`);
console.log('wrote public/extension-config.json');

const androidExtensionConfigTargets = [
  path.join(root, 'android-supervisor-app', 'app', 'src', 'main', 'assets', 'www', 'extension-config.json'),
  path.join(root, 'android-observer-app', 'app', 'src', 'main', 'assets', 'www', 'extension-config.json'),
];

for (const target of androidExtensionConfigTargets) {
  if (!fs.existsSync(path.dirname(target))) continue;
  fs.writeFileSync(target, `${JSON.stringify(extensionConfig, null, 2)}\n`);
  console.log(`wrote ${path.relative(root, target)}`);
}

console.log('client-config sync complete');
