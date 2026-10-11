#!/usr/bin/env node
/**
 * APEX — Client Bundle Hygiene & Security Auditor
 * 
 * Enforces production invariants:
 * 1. Zero bare module specifiers (e.g. bare "sharp" or "crypto") in client JS.
 * 2. Zero require() or node: protocol imports.
 * 3. Zero server-only AI pipeline or admin components (workerPool, v2Pipeline, AiControlCenter).
 * 4. Zero leaked server secrets (Gemini keys, Cloudflare tokens, Supabase service-role keys).
 */

import fs from 'fs';
import path from 'path';

const distDir = path.resolve(process.cwd(), 'dist/assets');

if (!fs.existsSync(distDir)) {
  console.error(`[check-client-bundle] Error: dist/assets directory not found at ${distDir}. Run build first.`);
  process.exit(1);
}

const jsFiles = fs.readdirSync(distDir)
  .filter(f => f.endsWith('.js'))
  .map(f => path.join(distDir, f));

if (jsFiles.length === 0) {
  console.error('[check-client-bundle] Error: No JS files found in dist/assets.');
  process.exit(1);
}

console.log(`[check-client-bundle] Auditing ${jsFiles.length} client bundle files...`);

const violations = [];

// Secret patterns to prevent bundling server credentials into client
const SECRET_PATTERNS = [
  { name: 'Gemini Private API Key', regex: /AQ\.Ab8RN6KqwfZq5jNcnA1zEC7BmCHprVUoIPPmA7MDaDUFqf9krg/ },
  { name: 'Google AI Key Prefix Pattern', regex: /AIzaSy[A-Za-z0-9_-]{33}/ },
  { name: 'Cloudflare Auth Token', regex: /cfut_[A-Za-z0-9_-]{30,}/ },
  { name: 'Supabase Service Role Key Indicator', regex: /service_role/i },
  { name: 'Generic Server Secret Assignment', regex: /(?:GEMINI_API_KEY|CLOUDFLARE_AUTH_TOKEN)\s*=/ }
];

// Server-only packages that must NEVER be resolved or referenced in client JS
const FORBIDDEN_SERVER_MODULES = [
  { name: 'sharp module import', regex: /(?:^|[;\n}])\s*import\s+[^;]*from\s*["']sharp["']/ },
  { name: '@img/sharp module import', regex: /(?:^|[;\n}])\s*import\s+[^;]*from\s*["']@img\/sharp/ },
  { name: 'node: protocol import', regex: /from\s*["']node:[^"']+["']/ },
  { name: 'Node.js crypto import', regex: /(?:^|[;\n}])\s*import\s+[^;]*from\s*["']crypto["']/ },
  { name: 'Node.js fs import', regex: /(?:^|[;\n}])\s*import\s+[^;]*from\s*["']fs["']/ },
  { name: 'Node.js path import', regex: /(?:^|[;\n}])\s*import\s+[^;]*from\s*["']path["']/ }
];

// Admin and Server pipeline components that must not ship in production client chunks
const FORBIDDEN_ADMIN_TOKENS = [
  { name: 'AiControlCenterModal Admin Component', regex: /\bAiControlCenterModal\b/ },
  { name: 'AI Engine workerPool', regex: /\bworkerPool\b/ },
  { name: 'AI Engine v2Pipeline', regex: /\bv2Pipeline\b/ }
];

// Bare module specifier in real ES module import statements
// (preceded by start of file, semicolon, newline, or closing brace, and not inside a quote)
const BARE_IMPORT_REGEX = /(?:^|[;\n}])\s*import\s*(?:(?:\{[^}]*\}|\*\s*as\s*\w+|\w+)\s*from\s*)?['"]([^'"]+)['"]/g;

// Unbundled CommonJS require calls
const REQUIRE_CALL_REGEX = /\brequire\s*\(\s*['"]([a-zA-Z0-9@][^'"]*)['"]\s*\)/g;

for (const filePath of jsFiles) {
  const fileName = path.basename(filePath);
  const content = fs.readFileSync(filePath, 'utf8');

  // 1. Check for server secrets
  for (const { name, regex } of SECRET_PATTERNS) {
    if (regex.test(content)) {
      violations.push({
        file: fileName,
        category: 'SECRET_LEAKAGE',
        description: `Found potential secret matching pattern "${name}"`
      });
    }
  }

  // 2. Check for forbidden server modules
  for (const { name, regex } of FORBIDDEN_SERVER_MODULES) {
    if (regex.test(content)) {
      violations.push({
        file: fileName,
        category: 'FORBIDDEN_SERVER_MODULE',
        description: `Found forbidden server module import: ${name}`
      });
    }
  }

  // 3. Check for admin/server pipeline tokens
  for (const { name, regex } of FORBIDDEN_ADMIN_TOKENS) {
    if (regex.test(content)) {
      violations.push({
        file: fileName,
        category: 'ADMIN_LEAKAGE',
        description: `Found admin or server token: ${name}`
      });
    }
  }

  // 4. Check for bare module specifiers in top-level imports
  let match;
  while ((match = BARE_IMPORT_REGEX.exec(content)) !== null) {
    const specifier = match[1];
    // Ignore relative imports and absolute URL imports
    if (!specifier.startsWith('.') && !specifier.startsWith('/') && !specifier.startsWith('http://') && !specifier.startsWith('https://')) {
      violations.push({
        file: fileName,
        category: 'BARE_IMPORT_SPECIFIER',
        description: `Bare ES module import specifier "${specifier}" cannot be resolved by Android WebView or browsers.`
      });
    }
  }

  // 5. Check for unbundled require() calls
  let reqMatch;
  while ((reqMatch = REQUIRE_CALL_REGEX.exec(content)) !== null) {
    const pkg = reqMatch[1];
    violations.push({
      file: fileName,
      category: 'COMMONJS_REQUIRE',
      description: `Unbundled require("${pkg}") call found in client bundle.`
    });
  }
}

if (violations.length > 0) {
  console.error('\n❌ CLIENT BUNDLE HYGIENE AUDIT FAILED:');
  for (const v of violations) {
    console.error(`  [${v.category}] ${v.file}: ${v.description}`);
  }
  process.exit(1);
}

console.log('✅ Client bundle hygiene audit PASSED! Zero leaks, zero bare specifiers, zero server modules.');
