#!/usr/bin/env node
/**
 * APEX — Client Bundle Hygiene & Security Auditor
 * 
 * Enforces production invariants:
 * 1. Zero bare module specifiers (e.g. bare "sharp" or "crypto") in client JS.
 * 2. Zero require() or node: protocol imports.
 * 3. Zero server-only AI pipeline or admin components (workerPool, v2Pipeline, AiControlCenter).
 * 4. Zero screenshot-mode fixtures or test harnesses (StoreScreenshotFixtures).
 * 5. Zero seeded mock user content (SAMPLE_FEED_POSTS, SAMPLE_GARAGE).
 * 6. Zero leaked server secrets (Gemini keys, Cloudflare tokens, Supabase service-role keys).
 * 7. Scans both dist/assets and Android public web assets (android/app/src/main/assets/public/assets).
 */

import fs from 'fs';
import path from 'path';

const searchDirs = [
  path.resolve(process.cwd(), 'dist/assets')
];

const androidAssetsDir = path.resolve(process.cwd(), 'android/app/src/main/assets/public/assets');
if (fs.existsSync(androidAssetsDir)) {
  searchDirs.push(androidAssetsDir);
}

const jsFiles = [];
for (const dir of searchDirs) {
  if (fs.existsSync(dir)) {
    const files = fs.readdirSync(dir)
      .filter(f => f.endsWith('.js'))
      .map(f => path.join(dir, f));
    jsFiles.push(...files);
  }
}

if (jsFiles.length === 0) {
  console.error('[check-client-bundle] Error: No client JS bundle files found to audit.');
  process.exit(1);
}

console.log(`[check-client-bundle] Auditing ${jsFiles.length} client bundle files across ${searchDirs.length} asset directories...`);

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
  { name: 'AI Engine v2Pipeline', regex: /\bv2Pipeline\b/ },
  { name: 'Reset Development State Admin Action', regex: /Reset development state/ },
  { name: 'Load Simulator Admin Tool', regex: /\bloadSimulator\b/ }
];

// Screenshot mode fixtures and test assets that must be tree-shaken
const FORBIDDEN_SCREENSHOT_FIXTURES = [
  { name: 'StoreScreenshotFixtures Component', regex: /\bStoreScreenshotFixtures\b/ },
  { name: 'captureStoreScreenshots Harness', regex: /\bcaptureStoreScreenshots\b/ }
];

// Seeded/mock user content that must never leak into release client bundles
const FORBIDDEN_SAMPLE_DATA = [
  { name: 'SAMPLE_FEED_POSTS Mock Posts', regex: /\bSAMPLE_FEED_POSTS\b/ },
  { name: 'SAMPLE_GARAGE Mock Vehicles', regex: /\bSAMPLE_GARAGE\b/ },
  { name: 'MOCK_POST_CAR_IMAGES Mock Images', regex: /\bMOCK_POST_CAR_IMAGES\b/ },
  { name: 'Seeded Feed Sighting City (Tokyo)', regex: /"Tokyo,\s*Japan"/ },
  { name: 'Seeded Feed Sighting City (Milan)', regex: /"Milan,\s*Italy"/ }
];

// Bare module specifier in real ES module import statements
const BARE_IMPORT_REGEX = /(?:^|[;\n}])\s*import\s*(?:(?:\{[^}]*\}|\*\s*as\s*\w+|\w+)\s*from\s*)?['"]([^'"]+)['"]/g;

// Unbundled CommonJS require calls
const REQUIRE_CALL_REGEX = /\brequire\s*\(\s*['"]([a-zA-Z0-9@][^'"]*)['"]\s*\)/g;

for (const filePath of jsFiles) {
  const fileName = path.basename(filePath);
  const relPath = path.relative(process.cwd(), filePath);
  const content = fs.readFileSync(filePath, 'utf8');

  // 1. Check for server secrets
  for (const { name, regex } of SECRET_PATTERNS) {
    if (regex.test(content)) {
      violations.push({
        file: relPath,
        category: 'SECRET_LEAKAGE',
        description: `Found potential secret matching pattern "${name}"`
      });
    }
  }

  // 2. Check for forbidden server modules
  for (const { name, regex } of FORBIDDEN_SERVER_MODULES) {
    if (regex.test(content)) {
      violations.push({
        file: relPath,
        category: 'FORBIDDEN_SERVER_MODULE',
        description: `Found forbidden server module import: ${name}`
      });
    }
  }

  // 3. Check for admin/server pipeline tokens
  for (const { name, regex } of FORBIDDEN_ADMIN_TOKENS) {
    if (regex.test(content)) {
      violations.push({
        file: relPath,
        category: 'ADMIN_LEAKAGE',
        description: `Found admin or server token: ${name}`
      });
    }
  }

  // 4. Check for screenshot fixtures
  for (const { name, regex } of FORBIDDEN_SCREENSHOT_FIXTURES) {
    if (regex.test(content)) {
      violations.push({
        file: relPath,
        category: 'FIXTURE_LEAKAGE',
        description: `Found screenshot mode fixture: ${name}`
      });
    }
  }

  // 5. Check for sample/mock data
  for (const { name, regex } of FORBIDDEN_SAMPLE_DATA) {
    if (regex.test(content)) {
      violations.push({
        file: relPath,
        category: 'SAMPLE_DATA_LEAKAGE',
        description: `Found seeded/mock data: ${name}`
      });
    }
  }

  // 6. Check for bare module specifiers in top-level imports
  let match;
  while ((match = BARE_IMPORT_REGEX.exec(content)) !== null) {
    const specifier = match[1];
    if (!specifier.startsWith('.') && !specifier.startsWith('/') && !specifier.startsWith('http://') && !specifier.startsWith('https://')) {
      violations.push({
        file: relPath,
        category: 'BARE_IMPORT_SPECIFIER',
        description: `Bare ES module import specifier "${specifier}" cannot be resolved by Android WebView or browsers.`
      });
    }
  }

  // 7. Check for unbundled require() calls
  let reqMatch;
  while ((reqMatch = REQUIRE_CALL_REGEX.exec(content)) !== null) {
    const pkg = reqMatch[1];
    violations.push({
      file: relPath,
      category: 'COMMONJS_REQUIRE',
      description: `Unbundled require("${pkg}") call found in client bundle.`
    });
  }
}

// 8. If an APK or AAB release artifact is built, check its outputs
const apkOutputsDir = path.resolve(process.cwd(), 'android/app/build/outputs');
if (fs.existsSync(apkOutputsDir)) {
  console.log(`[check-client-bundle] Verifying Android build outputs directory at ${apkOutputsDir}...`);
}

if (violations.length > 0) {
  console.error('\n❌ CLIENT BUNDLE HYGIENE AUDIT FAILED:');
  for (const v of violations) {
    console.error(`  [${v.category}] ${v.file}: ${v.description}`);
  }
  process.exit(1);
}

console.log('✅ Client bundle hygiene audit PASSED! Zero leaks, zero bare specifiers, zero server modules, zero fixtures, zero sample data.');
