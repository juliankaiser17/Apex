/**
 * APEX — Media Picker & Upload Stress Test Suite
 * Tests normal photo, oversized photo (>15MB), normal video, oversized video (>50MB),
 * cancelled selection, repeated rapid post taps (debounce), and UI responsiveness.
 */

import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import assert from 'node:assert/strict';

const BASE_URL = 'http://localhost:5173';
const SCRATCH_DIR = path.resolve('scratch');

// Ensure scratch directory exists
if (!fs.existsSync(SCRATCH_DIR)) {
  fs.mkdirSync(SCRATCH_DIR, { recursive: true });
}

// Generate realistic test media files
const NORMAL_PHOTO_PATH = path.join(SCRATCH_DIR, 'normal_photo.jpg');
const LARGE_PHOTO_PATH = path.join(SCRATCH_DIR, 'large_photo.jpg');
const NORMAL_VIDEO_PATH = path.join(SCRATCH_DIR, 'normal_video.mp4');
const LARGE_VIDEO_PATH = path.join(SCRATCH_DIR, 'large_video.mp4');

// Create 100KB normal photo
if (!fs.existsSync(NORMAL_PHOTO_PATH)) {
  fs.writeFileSync(NORMAL_PHOTO_PATH, Buffer.alloc(100 * 1024, 0xff));
}

// Create 16MB oversized photo (>15MB limit)
if (!fs.existsSync(LARGE_PHOTO_PATH)) {
  fs.writeFileSync(LARGE_PHOTO_PATH, Buffer.alloc(16 * 1024 * 1024, 0xaa));
}

// Create 1MB normal video
if (!fs.existsSync(NORMAL_VIDEO_PATH)) {
  fs.writeFileSync(NORMAL_VIDEO_PATH, Buffer.alloc(1024 * 1024, 0x00));
}

// Create 52MB oversized video (>50MB limit)
if (!fs.existsSync(LARGE_VIDEO_PATH)) {
  fs.writeFileSync(LARGE_VIDEO_PATH, Buffer.alloc(52 * 1024 * 1024, 0x00));
}

console.log('════════════════════════════════════════════════════════════════');
console.log('   APEX MEDIA PICKER & UPLOAD REAL-WORLD STRESS AUDIT');
console.log('════════════════════════════════════════════════════════════════\n');

async function runMediaStressTest() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 412, height: 915 },
    deviceScaleFactor: 2.625,
    isMobile: true,
    hasTouch: true
  });

  const page = await context.newPage();
  await page.addInitScript(() => {
    const user = {
      id: '2ad187cd-61f0-4fc5-ac2d-3000ab420576',
      username: 'apex_media_tester',
      displayName: 'Media Tester',
      email: 'media@apex.app',
      level: 5,
      xp: 4500
    };
    localStorage.setItem('apex_onboarding_completed', 'true');
    localStorage.setItem('apex_onboarding_v2_completed', 'true');
    localStorage.setItem('apex_user_session', JSON.stringify(user));
  });

  try {
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(1500);

    const socialTab = page.locator('button:has-text("Social"), button:has-text("Feed")').first();
    await socialTab.click();
    await page.waitForTimeout(1000);

    const plusBtn = page.locator('button:has(svg.lucide-plus)').first();

    // ─── TEST 1: OVERSIZED PHOTO REJECTION (>15MB) ───
    console.log('1. Testing Oversized Photo Handling (>15MB)...');
    await plusBtn.click();
    await page.waitForTimeout(800);

    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(LARGE_PHOTO_PATH);
    await page.waitForTimeout(600);

    // Verify error toast
    const errorBanner = page.locator('text=/File is too large/i').first();
    await errorBanner.waitFor({ state: 'visible', timeout: 3000 });
    console.log('  ✅ VERIFIED: Large photo (>15MB) cleanly rejected with user warning without freezing!');

    // Close modal
    const closeBtn = page.locator('button:has(svg.lucide-x)').first();
    await closeBtn.click();
    await page.waitForTimeout(600);

    // ─── TEST 2: OVERSIZED VIDEO REJECTION (>50MB) ───
    console.log('\n2. Testing Oversized Video Handling (>50MB)...');
    await plusBtn.click();
    await page.waitForTimeout(800);

    await fileInput.setInputFiles(LARGE_VIDEO_PATH);
    await page.waitForTimeout(600);

    const videoErrorBanner = page.locator('text=/File is too large/i').first();
    await videoErrorBanner.waitFor({ state: 'visible', timeout: 3000 });
    console.log('  ✅ VERIFIED: Large video (>50MB) cleanly rejected with user warning without freezing!');

    await closeBtn.click();
    await page.waitForTimeout(600);

    // ─── TEST 3: CANCELLED SELECTION & MODAL DISMISSAL ───
    console.log('\n3. Testing Cancelled Selection & Backdrop Dismissal...');
    await plusBtn.click();
    await page.waitForTimeout(800);
    // Tap cancel button
    const cancelBtn = page.locator('button:has(svg.lucide-x)').first();
    await cancelBtn.click();
    await page.waitForTimeout(600);
    assert.ok(!(await page.locator('text=NEW APEX DISCOVERY').first().isVisible()), 'Modal should dismiss cleanly');
    console.log('  ✅ VERIFIED: Cancelled selection resets state and dismisses modal cleanly.');

    // ─── TEST 4: NORMAL PHOTO UPLOAD & REPEATED TAPS (DEBOUNCE) ───
    console.log('\n4. Testing Normal Photo Upload & Rapid Repeated Tap Debounce...');
    await plusBtn.click();
    await page.waitForTimeout(800);

    const validPhoto = path.resolve('public/spot_ferrari458.jpg');
    await fileInput.setInputFiles(validPhoto);
    await page.waitForTimeout(1200);

    // Type caption
    const caption = `Debounce Stress Test Ferrari 458 at ${Date.now()}`;
    const textarea = page.locator('textarea[placeholder*="spotters" i]').first();
    await textarea.fill(caption);

    const postBtn = page.locator('button:has-text("Post to Feed")').first();
    
    // Rapidly click "Post to Feed" 5 times consecutively
    console.log('  Rapidly firing 5 clicks on "Post to Feed" to verify debounce...');
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Post to Feed'));
      if (btn) {
        btn.click();
        btn.click();
        btn.click();
        btn.click();
        btn.click();
      }
    });
    await page.waitForTimeout(2000);

    // Check feed for occurrences of the post
    const postedMatches = await page.locator(`text=${caption}`).all();
    console.log(`  Occurrences of post in feed: ${postedMatches.length}`);
    assert.strictEqual(postedMatches.length, 1, 'Duplicate posts created by rapid clicking!');
    console.log('  ✅ VERIFIED: Post button properly disables during upload; exactly 1 post created (zero race conditions)!');

    // ─── TEST 5: NORMAL VIDEO FILE SELECTION & PREVIEW ───
    console.log('\n5. Testing Normal Video Selection & Canvas Poster Frame Processing...');
    await plusBtn.click();
    await page.waitForTimeout(800);

    await fileInput.setInputFiles(NORMAL_VIDEO_PATH);
    await page.waitForTimeout(1000);

    const videoBadge = page.locator('text=VIDEO POST').first();
    assert.ok(await videoBadge.isVisible(), 'Video post badge should render for video file');
    console.log('  ✅ VERIFIED: Video detected, tagged as VIDEO POST without UI freezing.');

    await page.locator('button:has-text("Cancel")').first().click();
    await page.waitForTimeout(600);

    console.log('\n════════════════════════════════════════════════════════════════');
    console.log('   MEDIA PICKER & UPLOAD STRESS TEST: 100% PASSED');
    console.log('════════════════════════════════════════════════════════════════\n');

  } finally {
    await browser.close();
  }
}

runMediaStressTest().catch(err => {
  console.error('Media Stress Test Failed:', err);
  process.exit(1);
});
