import { chromium } from 'playwright';

async function main() {
  console.log('=== PHASE 1: APEX BASELINE BENCHMARK ===');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 412, height: 915 }, // Galaxy A54 5G resolution
    userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-A546B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
  });
  const page = await context.newPage();

  // Ensure onboarding is marked completed so Home screen and HeaderBar render
  await page.addInitScript(() => {
    const existing = localStorage.getItem('apex-hunter-storage');
    let stateObj = {};
    if (existing) {
      try { stateObj = JSON.parse(existing); } catch (e) {}
    }
    stateObj.state = stateObj.state || {};
    stateObj.state.user = stateObj.state.user || {};
    stateObj.state.user.onboardingCompleted = true;
    localStorage.setItem('apex-hunter-storage', JSON.stringify(stateObj));
  });

  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // If Auth screen is displayed, click "Or explore as Guest Spotter →"
  const guestBtn = await page.$('button:has-text("Guest Spotter")');
  if (guestBtn) {
    console.log('Entering as Guest Spotter...');
    await guestBtn.click();
    await page.waitForTimeout(1500);
  }

  // Check state and complete onboarding
  await page.evaluate(() => {
    window.useApexStore?.setState({ onboardingCompleted: true });
  });
  await page.waitForTimeout(500);

  const state = await page.evaluate(() => {
    const s = window.useApexStore?.getState();
    return {
      authStatus: s?.authStatus,
      onboardingCompleted: s?.onboardingCompleted,
      activeTab: s?.activeTab,
      buttons: Array.from(document.querySelectorAll('button')).map(b => b.title || b.textContent?.trim()).filter(Boolean).slice(0, 10)
    };
  });
  console.log('Current state & visible buttons:', state);

  // Directly open settings via store to measure rendering and layout
  console.log('\n--- 1. Testing Settings Modal Opening ---');
  const t0 = Date.now();
  await page.evaluate(() => {
    window.useApexStore?.getState().setSettingsModalOpen(true);
  });
  await page.waitForSelector('.bg-\\[\\#121212\\]', { timeout: 3000 });
  const t1 = Date.now();
  console.log(`Settings opened in ${t1 - t0}ms`);

  const settingsLayout = await page.evaluate(() => {
    const modal = document.querySelector('.max-w-md.max-h-\\[90vh\\]');
    const backdrop = document.querySelector('.bg-black\\/85');
    const fullScreen = document.querySelector('.fixed.inset-0.bg-\\[\\#0c0c0c\\]');
    return {
      hasFloatingCardModal: !!modal,
      hasBackdrop: !!backdrop,
      isFullScreenPage: !!fullScreen,
      viewport: { w: window.innerWidth, h: window.innerHeight }
    };
  });
  console.log('Settings Layout Baseline:', settingsLayout);

  // Close settings
  const closeBtn = await page.$('button[aria-label="Close settings"]');
  if (closeBtn) await closeBtn.click();
  await page.waitForTimeout(300);

  // 2. Daily Streak Baseline
  console.log('\n--- 2. Testing Daily Streak State & Presentation Bug ---');
  // Set streakDays = 1, streakLastAt = yesterday in store
  await page.evaluate(() => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const store = window.useApexStore?.getState();
    if (store) {
      store.updateUserProfile({
        streakDays: 1,
        streakLastAt: yesterday.toISOString()
      });
      store.setStreakModalOpen(true);
    }
  });
  await page.waitForTimeout(600);

  const streakUI = await page.evaluate(() => {
    const claimBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Claim') || b.textContent?.includes('Streak'));
    const canvas = document.querySelector('canvas.fixed.inset-0');
    return {
      buttonText: claimBtn?.textContent?.trim() || 'NOT_FOUND',
      canvasPresent: !!canvas
    };
  });
  console.log('Daily Streak UI Baseline (Observed button text & canvas):', streakUI);

  await browser.close();
  console.log('\n=== BASELINE AUDIT COMPLETE ===');
}

main().catch(err => {
  console.error('Baseline run error:', err);
  process.exit(1);
});
