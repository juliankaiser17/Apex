#!/usr/bin/env node
/**
 * check-raw-hex.mjs
 * Mandated by Appendix A Section 3:
 * Enforces zero raw hex values in design system components and migrated screens.
 */
import fs from 'fs';
import path from 'path';

const TARGET_DIRS = process.argv.slice(2).length > 0 ? process.argv.slice(2) : ['src/components/ui'];

let violations = 0;

function scanDir(dir) {
  if (!fs.existsSync(dir)) return;
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, item.name);
    if (item.isDirectory()) {
      scanDir(full);
    } else if (/\.(tsx|ts|jsx|js|css)$/.test(item.name) && !item.name.includes('tokens.css')) {
      const lines = fs.readFileSync(full, 'utf8').split('\n');
      lines.forEach((line, idx) => {
        // Match raw hex codes #fff, #123456, etc., ignoring URL encoded # or comments if needed
        const matches = line.match(/#[0-9a-fA-F]{3,8}\b/g);
        if (matches) {
          // Allow exceptions if explicitly marked with /* hex-allowed */ or inside SVG namespaces
          const isAllowed = line.includes('/* hex-allowed */') || line.includes('xmlns=');
          if (!isAllowed) {
            console.error(`❌ [Hex Violation] ${full}:${idx + 1}: ${line.trim()}`);
            violations += matches.length;
          }
        }
      });
    }
  }
}

for (const target of TARGET_DIRS) {
  scanDir(target);
}

if (violations > 0) {
  console.error(`\n🚨 Failed: Found ${violations} raw hex values outside tokens.css in ${TARGET_DIRS.join(', ')}.`);
  process.exit(1);
} else {
  console.log(`\n✅ Hex check passed: 0 raw hex values found in ${TARGET_DIRS.join(', ')}.`);
  process.exit(0);
}
