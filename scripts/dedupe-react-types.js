#!/usr/bin/env node
/**
 * Removes nested node_modules/@types/react so the project uses a single
 * React type definition. Multiple copies cause TS2786 (Element vs ReactNode).
 */
const fs = require('fs');
const path = require('path');

const typesDir = path.join(__dirname, '..', 'node_modules', '@types');
if (!fs.existsSync(typesDir)) process.exit(0);

for (const name of fs.readdirSync(typesDir)) {
  const nested = path.join(typesDir, name, 'node_modules', '@types', 'react');
  if (fs.existsSync(nested)) {
    fs.rmSync(nested, { recursive: true, force: true });
    console.log('[dedupe-react-types] removed', nested);
  }
}
