#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const track = process.argv[2] || 'R';
const frozenFile = path.resolve(process.cwd(), `scripts/frozen-paths.${track}.txt`);

if (!fs.existsSync(frozenFile)) {
  console.error(`Frozen paths file not found: ${frozenFile}`);
  process.exit(1);
}

const patterns = fs.readFileSync(frozenFile, 'utf8')
  .split('\n')
  .map(l => l.trim())
  .filter(l => l && !l.startsWith('#'))
  .map(p => new RegExp(p));

let changedFiles = [];
try {
  // Diff against merge-base with ai/identification or master
  let baseBranch = 'ai/identification';
  try {
    execSync(`git rev-parse --verify ${baseBranch}`, { stdio: 'ignore' });
  } catch {
    baseBranch = 'master';
  }

  let baseCommit = '';
  try {
    baseCommit = execSync(`git merge-base HEAD ${baseBranch}`, { encoding: 'utf8' }).trim();
  } catch {
    baseCommit = 'HEAD~1';
  }

  const diffOutput = execSync(`git diff --name-only ${baseCommit}...HEAD`, { encoding: 'utf8' });
  const workingDiff = execSync(`git diff --name-only`, { encoding: 'utf8' });
  const stagedDiff = execSync(`git diff --name-only --cached`, { encoding: 'utf8' });

  const all = new Set([
    ...diffOutput.split('\n'),
    ...workingDiff.split('\n'),
    ...stagedDiff.split('\n')
  ].map(f => f.trim().replace(/\\/g, '/')).filter(Boolean));

  changedFiles = Array.from(all);
} catch (err) {
  console.warn('Could not compute git diff, checking status instead:', err.message);
  const statusOutput = execSync('git status --porcelain', { encoding: 'utf8' });
  changedFiles = statusOutput.split('\n')
    .map(line => line.slice(3).trim().replace(/\\/g, '/'))
    .filter(Boolean);
}

const violations = [];
for (const file of changedFiles) {
  for (const regex of patterns) {
    if (regex.test(file)) {
      violations.push({ file, regex: regex.toString() });
      break;
    }
  }
}

if (violations.length > 0) {
  console.error(`\n❌ FROZEN PATH VIOLATIONS DETECTED (Track ${track}):`);
  for (const v of violations) {
    console.error(`  - ${v.file} (matched ${v.regex})`);
  }
  console.error('\nThis track is NOT permitted to modify frozen paths under Operating Rule 7.');
  process.exit(1);
}

console.log(`\n✅ Track ${track} frozen paths check passed. 0 violations.`);
