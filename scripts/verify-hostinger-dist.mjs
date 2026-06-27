import fs from 'fs';
import path from 'path';

const dist = path.join(process.cwd(), 'dist');
const required = ['index.html', '.htaccess'];

const missing = required.filter((name) => !fs.existsSync(path.join(dist, name)));
if (missing.length) {
  console.error(`Hostinger dist check failed — missing: ${missing.join(', ')}`);
  process.exit(1);
}

console.log('Hostinger dist OK: index.html and .htaccess present');
