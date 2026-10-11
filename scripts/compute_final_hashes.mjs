import fs from 'fs';
import crypto from 'crypto';

const files = [
  'eval/golden/manifest.json',
  'eval/golden/manifest_v2.json',
  'eval/registry_evidence/hardened_spotcheck_report.json',
  'src/ai-engine/canonical/tier1Registry.json',
  'scratch/xp_simulation_results.json',
  'docs/store/LISTING.md',
  'docs/store/PRIVACY_POLICY_DRAFT.md',
  'docs/store/DATA_SAFETY_WORKSHEET.md',
  'docs/store/ACCOUNT_DELETION_PAGE.md',
  'public/account-deletion.html',
  'docs/store/UGC_GAP_ANALYSIS.md',
  'docs/store/RELEASE_CHECKLIST.md',
  'docs/store/DATA_FLOW_AUDIT.md',
  'docs/store/ASSET_SPECIFICATIONS.md',
  'docs/store/screenshots/1_legendary_card_reveal.png',
  'docs/store/screenshots/2_scanner_locked_on_car.png',
  'docs/store/screenshots/3_one_car_two_cities_rarity.png',
  'docs/store/screenshots/4_hunt_alert_active.png',
  'docs/store/screenshots/5_populated_garage.png',
  'docs/store/screenshots/6_location_privacy_sheet.png',
  'docs/proposals/auth_oauth_callback_timeout.md',
  'docs/proposals/crash_reporting_vendor.md',
  'docs/proposals/map_tile_provider.md',
  'docs/proposals/moderation_report_and_block_backend.md',
  'docs/proposals/quest_garage_server_sync.md',
  'docs/proposals/xp_progression_rebalancing.md',
  'docs/program/TRACK_F_FUNCTIONAL_AUDIT_REPORT.md',
  'docs/ai/PHASE14_RELEASE_RESCUE_REPORT.md',
  'docs/program/RUNBOOK.md',
  'docs/program/ANDROID_RELEASE_SIGNING.md'
];

if (fs.existsSync('dist/assets')) {
  for (const f of fs.readdirSync('dist/assets')) {
    if (f.startsWith('index-')) {
      files.push('dist/assets/' + f);
    }
  }
}

for (const f of files) {
  if (fs.existsSync(f)) {
    const data = fs.readFileSync(f);
    const hash = crypto.createHash('sha256').update(data).digest('hex');
    console.log(`${f} | ${data.length} bytes | ${hash}`);
  } else {
    console.log(`${f} | NOT FOUND`);
  }
}
