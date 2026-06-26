#!/usr/bin/env node
/** Read shared/client-config.json and print a field (apiOrigin, frontendOrigin, ...). */
const fs = require('fs');
const path = require('path');

const field = process.argv[2];
if (!field) {
  console.error('usage: read-client-config.js <field>');
  process.exit(1);
}

const configPath = path.join(__dirname, '..', 'shared', 'client-config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const value = config[field];
if (!value) {
  console.error(`unknown field: ${field}`);
  process.exit(1);
}
process.stdout.write(String(value));
