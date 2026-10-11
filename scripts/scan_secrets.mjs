#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

console.log('--- REPOSITORY & BUNDLE SECRET SCANNER ---');

const projectRoot = process.cwd();
const ignoreDirs = new Set(['.git', 'node_modules', '.tmp', '.cache', '.venv', 'venv', '__pycache__']);
const ignoreFiles = new Set(['package-lock.json', 'security_report.json']);

const SECRET_PATTERNS = [
  { name: 'Gemini API Key', regex: /AIzaSy[A-Za-z0-9_-]{33}/g },
  { name: 'Supabase Service Role Key', regex: /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*service_role[A-Za-z0-9_-]*/g },
  { name: 'Private Key Block', regex: /-----BEGIN (?:RSA|EC|OPENSSH|PGP|PRIVATE) KEY/g },
  { name: 'AWS Access Key ID', regex: /(?:A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}/g },
  { name: 'GitHub Personal Access Token', regex: /gh[pousr]_[A-Za-z0-9_]{36,255}/g },
  { name: 'Generic Password/Secret in Code', regex: /(?:api[_-]?secret|jwt[_-]?secret|private[_-]?key)\s*[:=]\s*["'][A-Za-z0-9@#$%^&*()_+=-]{16,}["']/gi }
];

const findings = [];

function scanDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!ignoreDirs.has(entry.name)) {
        scanDir(path.join(dir, entry.name));
      }
    } else if (entry.isFile()) {
      if (ignoreFiles.has(entry.name) || entry.name.endsWith('.png') || entry.name.endsWith('.jpg') || entry.name.endsWith('.webp')) {
        continue;
      }

      const filePath = path.join(dir, entry.name);
      const relPath = path.relative(projectRoot, filePath).replace(/\\/g, '/');

      // Skip local .env files from repo-leak audit (they are local-only and untracked)
      if (relPath === '.env' || relPath === '.env.local') {
        continue;
      }

      try {
        const content = fs.readFileSync(filePath, 'utf8');
        for (const pattern of SECRET_PATTERNS) {
          const matches = content.match(pattern.regex);
          if (matches) {
            findings.push({
              file: relPath,
              pattern: pattern.name,
              matchCount: matches.length
            });
          }
        }
      } catch (_) {
        // Skip binary or unreadable files
      }
    }
  }
}

scanDir(projectRoot);

console.log(`Scanned repository. Total findings: ${findings.length}`);
if (findings.length > 0) {
  console.error('\n⚠️ POTENTIAL SECRETS DETECTED:');
  for (const f of findings) {
    console.error(`  - ${f.file}: ${f.pattern} (${f.matchCount} occurrences)`);
  }
  process.exit(1);
} else {
  console.log('✅ SECRET SCAN PASSED: Zero leaked production secrets found in codebase or assets.');
  process.exit(0);
}
