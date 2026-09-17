import * as fs from 'fs';
import * as path from 'path';

const dirsToScan = ['src', 'public', 'android', 'dist', 'api'];

// Patterns that MUST NOT appear in client-side code
const forbiddenPatterns = [
  { name: 'Gemini API Key Prefix', regex: /AIzaSy[A-Za-z0-9_-]{33}/g },
  { name: 'Google Vertex/GCP Service Key Prefix', regex: /AQ\.[A-Za-z0-9_-]{40,}/g },
  { name: 'Cloudflare Auth Token', regex: /cfut_[A-Za-z0-9_-]+/g },
  { name: 'Cloudflare Hardcoded Account ID', regex: /6677bd3f67f39c36257de53aafbdb3de/g },
  { name: 'Vercel Secret / Token Prefix', regex: /(?:x-admin-key|admin_key)\s*[:=]\s*['"][^'"]+['"]/gi },
  { name: 'Supabase Service Role JWT', regex: /eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, checkRole: true },
  { name: 'Hardcoded Bearer Secret', regex: /['"]Bearer\s+(?:apex_|sk_|sec_)[A-Za-z0-9_-]+['"]/gi },
  { name: 'Private Key PEM header', regex: /-----BEGIN (?:RSA )?PRIVATE KEY-----/g }
];

function getAllFiles(dirPath: string, arrayOfFiles: string[] = []): string[] {
  if (!fs.existsSync(dirPath)) return arrayOfFiles;
  const files = fs.readdirSync(dirPath);

  for (const file of files) {
    const fullPath = path.join(dirPath, file);
    // Ignore build intermediate artifacts, git, gradle caches, node_modules
    if (file === 'node_modules' || file === '.git' || file === 'build' || file === '.gradle') {
      continue;
    }
    if (fs.statSync(fullPath).isDirectory()) {
      getAllFiles(fullPath, arrayOfFiles);
    } else {
      const ext = path.extname(fullPath).toLowerCase();
      // Scan code, config, xml, assets, js, json, html
      if (['.ts', '.tsx', '.js', '.jsx', '.json', '.xml', '.html', '.css', '.gradle'].includes(ext)) {
        arrayOfFiles.push(fullPath);
      }
    }
  }

  return arrayOfFiles;
}

let violations = 0;
let totalScanned = 0;

console.log('========================================================================');
console.log('APEX — PRE-LAUNCH COMPREHENSIVE STATIC SECURITY SCAN');
console.log('========================================================================\n');

for (const dir of dirsToScan) {
  const files = getAllFiles(dir);
  console.log(`Scanning directory [${dir}]: ${files.length} relevant files found.`);

  for (const file of files) {
    totalScanned++;
    const content = fs.readFileSync(file, 'utf8');

    for (const pat of forbiddenPatterns) {
      const matches = content.match(pat.regex);
      if (matches) {
        if (pat.checkRole) {
          // Verify if it's service_role JWT
          for (const m of matches) {
            try {
              const payloadBase64 = m.split('.')[1];
              const decoded = JSON.parse(Buffer.from(payloadBase64, 'base64').toString('utf8'));
              if (decoded.role === 'service_role') {
                console.error(`  [VIOLATION] ${pat.name} found in: ${file}`);
                violations++;
              }
            } catch (e) {}
          }
        } else {
          // Check false positives in sample strings or android build tools
          if (file.includes('google-services.json') || file.includes('strings.xml')) {
            // Android Google OAuth Client ID is public identifier
            continue;
          }
          console.error(`  [VIOLATION] ${pat.name} matched in: ${file}`);
          violations++;
        }
      }
    }
  }
}

console.log(`\n========================================================================`);
console.log(`STATIC SECURITY SCAN RESULTS:`);
console.log(`Total files scanned: ${totalScanned}`);
console.log(`Violations found: ${violations}`);
console.log(`Status: ${violations === 0 ? 'PASSED (100% CLEAN - ZERO SERVER SECRETS)' : 'FAILED'}`);
console.log(`========================================================================`);

if (violations > 0) {
  process.exit(1);
}
