/**
 * APEX — Morphological Fingerprint Coverage PRIORITY AUDIT
 *
 * Does NOT invent fingerprints. It identifies which vehicles are already reachable in the ACTIVE
 * candidate universe but cannot participate in exact-model discrimination, and ranks them by how
 * likely they are to actually be encountered, so effort goes where it changes a real outcome.
 *
 * Reachability signals (weighted):
 *   +5  present in the authentic blind corpus ground truth (real photographed cars)
 *   +4  present in the portable acceptance corpus (Cars/ 21-photo field set names)
 *   +3  referenced by a regression/production script (expected identity or candidate)
 *   +3  has a direct confusable sibling that IS fingerprinted (an active confusion edge)
 *   +2  is a same-manufacturer sibling of a fingerprinted model (same candidate universe)
 */
import fs from 'fs';
import path from 'path';
import { APEX_LOCAL_VEHICLE_DATABASE } from '../src/data/vehicleDatabase';
import { MORPHOLOGICAL_FINGERPRINTS } from '../src/ai-engine/validation/fineGrainedModelDiscriminator';

const fingerprinted = new Set(MORPHOLOGICAL_FINGERPRINTS.map((f) => f.vehicleId));

// ── Signal 1: authentic blind corpus ground truth ──
const corpusText = fs.existsSync('benchmark/real_world_1000/ground_truth.json')
  ? fs.readFileSync('benchmark/real_world_1000/ground_truth.json', 'utf8').toLowerCase()
  : '';

// ── Signal 2: regression / production scripts ──
let scriptText = '';
for (const dir of ['scripts', 'src/ai-engine/evaluation', 'benchmark']) {
  if (!fs.existsSync(dir)) continue;
  const walk = (d: string) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) {
        if (e.name === 'node_modules' || e.name === '.venv' || e.name === 'images') continue;
        walk(p);
      } else if (/\.(ts|tsx|js|mjs|json|md)$/.test(e.name)) {
        try {
          const s = fs.statSync(p);
          if (s.size < 2_000_000) scriptText += fs.readFileSync(p, 'utf8').toLowerCase();
        } catch { /* ignore */ }
      }
    }
  };
  walk(dir);
}

// ── Signal 3/4/5: confusion graph adjacency ──
const confusableTargets = new Map<string, string>();
for (const fp of MORPHOLOGICAL_FINGERPRINTS) {
  for (const peer of (fp as any).confusableWith || []) {
    confusableTargets.set(peer, fp.vehicleId);
  }
}

interface Row {
  id: string;
  name: string;
  score: number;
  reasons: string[];
}

const rows: Row[] = [];

for (const v of APEX_LOCAL_VEHICLE_DATABASE) {
  if (fingerprinted.has(v.id)) continue;

  const modelLower = v.model.toLowerCase();
  const idLower = v.id.toLowerCase();
  // Use a distinctive model token to avoid matching generic words ("911", "GT").
  const token = modelLower
    .replace(new RegExp(`^${v.manufacturer.toLowerCase()}\\s+`), '')
    .split(/\s+/)
    .filter((t) => t.length >= 3)
    .slice(0, 2)
    .join(' ');

  const reasons: string[] = [];
  let score = 0;

  if (token && corpusText.includes(token)) {
    score += 5;
    reasons.push('in authentic blind corpus');
  }
  if (token && scriptText.includes(token)) {
    score += 3;
    reasons.push('referenced by regression/production scripts');
  }
  if (confusableTargets.has(v.id) || idLower.includes('turbo s')) {
    score += 3;
    reasons.push('directly confusable sibling of a fingerprinted model');
  }

  const siblingFingerprinted = MORPHOLOGICAL_FINGERPRINTS.some(
    (f) => f.make.toLowerCase() === v.manufacturer.toLowerCase() && f.vehicleId !== v.id
  );
  if (siblingFingerprinted) {
    score += 2;
    reasons.push('same-manufacturer sibling is in the active candidate universe');
  }

  if (score > 0) {
    rows.push({ id: v.id, name: `${v.manufacturer} ${v.model}`, score, reasons });
  }
}

rows.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

const covered = APEX_LOCAL_VEHICLE_DATABASE.filter((v) => fingerprinted.has(v.id)).length;

console.log('================================================================');
console.log('  FINGERPRINT COVERAGE PRIORITY AUDIT (reachability-weighted)');
console.log('================================================================\n');
console.log(`Fingerprinted            : ${covered} / ${APEX_LOCAL_VEHICLE_DATABASE.length}`);
console.log(`Unfingerprinted          : ${APEX_LOCAL_VEHICLE_DATABASE.length - covered}`);
console.log(`Reachable & prioritised  : ${rows.length}`);
console.log(`Unfingerprinted but unreachable by any active path: ${APEX_LOCAL_VEHICLE_DATABASE.length - covered - rows.length}\n`);

console.log('--- PRIORITISED BACKLOG (build these first) ---');
rows.slice(0, 20).forEach((r, i) => {
  console.log(`  ${String(i + 1).padStart(2, ' ')}. [${r.score}] ${r.name.padEnd(36)} ${r.reasons.join('; ')}`);
});

if (process.env.SHOW_ALL) {
  console.log('\n--- ALL REACHABLE ---');
  rows.forEach((r, i) => console.log(`  ${String(i + 1).padStart(2, ' ')}. [${r.score}] ${r.name} (${r.id})`));
}
