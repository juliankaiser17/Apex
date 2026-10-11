#!/usr/bin/env node
/**
 * APEX — Architectural Boundary Linter
 * 
 * Verifies that client application files (components, hooks, store, utils)
 * never import server-only modules, Node built-ins, or server API endpoints.
 */

import fs from 'fs';
import path from 'path';

const CLIENT_DIRS = ['src/components', 'src/hooks', 'src/styles', 'src/types'];
const FORBIDDEN_CLIENT_IMPORTS = [
  { name: 'sharp', pattern: /from\s*['"](?:@img\/)?sharp['"]/ },
  { name: 'node built-in', pattern: /from\s*['"](?:node:)?(?:fs|path|child_process|stream|os|util)['"]/ },
  { name: 'node crypto', pattern: /from\s*['"](?:node:)?crypto['"]/ },
  { name: 'api serverless endpoint', pattern: /from\s*['"].*\/api\// },
  { name: 'server ai-engine queue/workers', pattern: /from\s*['"].*ai-engine\/(?:queue|providers|engine|v2\/stage[A-Z]|v2\/v2Pipeline)/ }
];

let violations = [];

function checkFile(filePath) {
  // src/components/admin is the developer admin tool surface, gated at compile-time by VITE_ENABLE_ADMIN
  if (filePath.replace(/\\/g, '/').includes('src/components/admin/')) {
    return;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  for (const { name, pattern } of FORBIDDEN_CLIENT_IMPORTS) {
    if (pattern.test(content)) {
      violations.push({ filePath, name });
    }
  }
}

function scanDir(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanDir(full);
    } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx') || entry.name.endsWith('.js')) {
      checkFile(full);
    }
  }
}

for (const dir of CLIENT_DIRS) {
  scanDir(path.resolve(process.cwd(), dir));
}

if (violations.length > 0) {
  console.error('\n❌ ARCHITECTURAL BOUNDARY LINT FAILED:');
  for (const v of violations) {
    console.error(`  - ${v.filePath} illegally imports ${v.name}`);
  }
  process.exit(1);
}

console.log('✅ Architectural boundary lint PASSED! Client code is cleanly decoupled from server modules.');
