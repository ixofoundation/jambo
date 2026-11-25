#!/usr/bin/env node
/**
 * Writes public/sw.js (gitignored) from sw/sw.js, stamping in a version so each
 * deploy ships a different file and installed apps see an update.
 *
 * Version: VERCEL_GIT_COMMIT_SHA (first 12 characters) on Vercel, otherwise
 * "local-<time>". With NEXT_PUBLIC_SW_KILL_SWITCH=1 it writes sw/kill-switch.js instead,
 * which removes the worker from every phone that has it. See docs/pwa.md.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dest = path.join(root, 'public', 'sw.js');

if (process.env.NEXT_PUBLIC_SW_KILL_SWITCH === '1') {
  fs.copyFileSync(path.join(root, 'sw', 'kill-switch.js'), dest);
  console.warn('[build-sw] NEXT_PUBLIC_SW_KILL_SWITCH=1: wrote the kill switch to public/sw.js');
  process.exit(0);
}

const sha = process.env.VERCEL_GIT_COMMIT_SHA;
const version = sha ? sha.slice(0, 12) : `local-${Date.now()}`;
const source = fs.readFileSync(path.join(root, 'sw', 'sw.js'), 'utf8');
if (!source.includes('__SW_VERSION__')) throw new Error('[build-sw] sw/sw.js has no __SW_VERSION__ placeholder');

fs.writeFileSync(dest, source.replace(/__SW_VERSION__/g, version));
console.log(`[build-sw] wrote public/sw.js, version ${version}`);
