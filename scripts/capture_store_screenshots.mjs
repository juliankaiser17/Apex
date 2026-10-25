#!/usr/bin/env node
/**
 * capture_store_screenshots.mjs
 * Mandated by APEX Master Program Track U Phase 10 / Track S S6:
 * Captures the 6 Google Play Store listing screenshots in the mandated funnel order
 * using dev-only screenshot fixture mode (0 backend calls, local fixtures).
 */

import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { createServer } from 'vite';

const ROOT_DIR = process.cwd();
const OUT_DIRS = [
  path.join(ROOT_DIR, 'docs', 'ui-redesign', 'after'),
  path.join(ROOT_DIR, 'docs', 'store', 'screenshots')
];

// Ensure target directories exist
OUT_DIRS.forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const SCREENSHOT_CONFIGS = [
  {
    shot: 1,
    id: 'shot_1_legendary_reveal',
    title: 'Legendary Card Reveal (Ferrari 458 Spider)',
    filename: '1_legendary_card_reveal.png'
  },
  {
    shot: 2,
    id: 'shot_2_scanner_lock',
    title: 'Scanner Locked on Vehicle (Rangefinder HUD & Aperture)',
    filename: '2_scanner_locked_on_car.png'
  },
  {
    shot: 3,
    id: 'shot_3_local_rarity_two_cities',
    title: 'One Car in Two Cities Showing Dynamic Rarity Multiplier',
    filename: '3_one_car_two_cities_rarity.png'
  },
  {
    shot: 4,
    id: 'shot_4_hunt_alert',
    title: 'Active Sector Radar Hunt Alert (McLaren 650S Spider)',
    filename: '4_hunt_alert_active.png'
  },
  {
    shot: 5,
    id: 'shot_5_populated_garage',
    title: 'Populated Collector Garage (Redesigned Masonry Grid)',
    filename: '5_populated_garage.png'
  },
  {
    shot: 6,
    id: 'shot_6_privacy_sheet',
    title: 'Location Privacy Radius Sheet (Exact vs 1km vs Ghost)',
    filename: '6_location_privacy_sheet.png'
  }
];

async function captureAllShots() {
  console.log('════════════════════════════════════════════════════════════════');
  console.log('   APEX STORE ASSET CAPTURE: PLAY STORE SCREENSHOT FUNNEL');
  console.log('════════════════════════════════════════════════════════════════\n');

  // 1. Spin up programmatic Vite dev server on dedicated port 5199
  console.log('Starting Vite server in fixture mode...');
  const server = await createServer({
    configFile: path.join(ROOT_DIR, 'vite.config.ts'),
    server: { port: 5199 }
  });
  await server.listen();
  const port = server.config.server.port || 5199;
  const baseUrl = `http://localhost:${port}`;
  console.log(`Vite server listening at ${baseUrl}`);

  // 2. Launch headless Chromium in high-DPI Android emulation mode
  console.log('Launching Playwright Chromium (Samsung Galaxy S24 Ultra spec: 1080x2340 equivalent)...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 412, height: 915 },
    deviceScaleFactor: 2.625, // Produces crisp 1081x2401 high-res PNG for Google Play Store
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-S928B Build/UP1A.231005.007) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
  });

  const page = await context.newPage();

  // 3. Sequentially capture each of the 6 funnel screenshots
  for (const item of SCREENSHOT_CONFIGS) {
    const targetUrl = `${baseUrl}/?fixture=screenshot&shot=${item.shot}`;
    console.log(`\nCapturing Shot ${item.shot}/6: ${item.title}...`);
    console.log(`  Navigating to ${targetUrl}`);

    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    // Wait for fonts & motion settles
    await page.waitForTimeout(2000);

    // Save to both docs/ui-redesign/after/ and docs/store/screenshots/
    for (const outDir of OUT_DIRS) {
      const destPath = path.join(outDir, item.filename);
      await page.screenshot({ path: destPath });
      console.log(`  ✅ Saved: ${path.relative(ROOT_DIR, destPath)}`);
    }
  }

  await browser.close();
  await server.close();

  console.log('\n════════════════════════════════════════════════════════════════');
  console.log('🎉 ALL 6 PLAY STORE SCREENSHOTS SUCCESSFULLY CAPTURED!');
  console.log('════════════════════════════════════════════════════════════════\n');
}

captureAllShots().catch(err => {
  console.error('Fatal error during screenshot capture:', err);
  process.exit(1);
});
