#!/usr/bin/env node
/**
 * Post-build script to fix manifest.json
 * Removes CSS auto-injection from content_scripts that vite-plugin-web-extension incorrectly adds
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const manifestPath = path.join(__dirname, '../dist/manifest.json');

// Read manifest
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

// Remove CSS from content_scripts (content scripts should not inject sidepanel CSS)
if (manifest.content_scripts) {
  manifest.content_scripts.forEach(script => {
    if (script.css) {
      console.log(`Removing CSS injection from content_scripts: ${script.css.join(', ')}`);
      delete script.css;
    }
  });
}

// Write back
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
console.log('✓ Manifest fixed: removed CSS auto-injection from content_scripts');
