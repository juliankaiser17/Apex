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

function scanPath(targetPath) {
  if (!fs.existsSync(targetPath)) return;
  const stat = fs.statSync(targetPath);
  if (stat.isFile()) {
    checkFile(targetPath);
    return;
  }
  for (const item of fs.readdirSync(targetPath, { withFileTypes: true })) {
    const full = path.join(targetPath, item.name);
    if (item.isDirectory()) {
      scanPath(full);
    } else {
      checkFile(full);
    }
  }
}

function checkFile(full) {
  if (!/\.(tsx|ts|jsx|js|css)$/.test(full) || full.includes('tokens.css')) return;
  const lines = fs.readFileSync(full, 'utf8').split('\n');
  lines.forEach((line, idx) => {
    const matches = line.match(/#[0-9a-fA-F]{3,8}\b/g);
    if (matches) {
      const isAllowed = line.includes('/* hex-allowed */') || line.includes('xmlns=');
      if (!isAllowed) {
        console.error(`❌ [Hex Violation] ${full}:${idx + 1}: ${line.trim()}`);
        violations += matches.length;
      }
    }
  });
}

for (const target of TARGET_DIRS) {
  scanPath(target);
}

if (violations > 0) {
  console.error(`\n🚨 Failed: Found ${violations} raw hex values outside tokens.css in ${TARGET_DIRS.join(', ')}.`);
  process.exit(1);
} else {
  console.log(`\n✅ Hex check passed: 0 raw hex values found in ${TARGET_DIRS.join(', ')}.`);
  process.exit(0);
}
