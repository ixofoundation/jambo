#!/usr/bin/env node
/**
 * Copies pdfjs-dist's worker bundle into /public so the browser can load it
 * from the same origin. Run as part of postinstall — the destination is
 * gitignored because the source is regenerated on every install.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const source = path.join(root, 'node_modules', 'pdfjs-dist', 'build', 'pdf.worker.min.js');
const destDir = path.join(root, 'public');
const dest = path.join(destDir, 'pdf.worker.min.js');

if (!fs.existsSync(source)) {
  console.warn('[copy-pdf-worker] source missing, skipping:', source);
  process.exit(0);
}

fs.mkdirSync(destDir, { recursive: true });
fs.copyFileSync(source, dest);
console.log('[copy-pdf-worker] copied', path.relative(root, source), '→', path.relative(root, dest));
