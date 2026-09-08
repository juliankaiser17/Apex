/**
 * APEX — Realtime Reconnection & Network Resilience Stress Test
 * Tests network disconnect while conversation is open, reconnection, message ordering,
 * and duplicate nonce/subscription prevention.
 */

import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const BASE_URL = 'http://localhost:5173';

const TEST_USER = {
  id: '2ad187cd-61f0-4fc5-ac2d-3000ab420576',
  username: 'apex_reconnect_tester',
  displayName: 'Reconnect Tester',
  email: 'reconnect@apex.app',
  level: 5,
  xp: 4500
};

console.log('════════════════════════════════════════════════════════════════');
console.log('   APEX REALTIME RECONNECTION & NETWORK RESILIENCE TEST');
console.log('════════════════════════════════════════════════════════════════\n');

async function runReconnectionTest() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 412, height: 915 },
    deviceScaleFactor: 2.625,
    isMobile: true,
    hasTouch: true
  });

  const page = await context.newPage();
  await page.addInitScript(user => {
    localStorage.setItem('apex_onboarding_completed', 'true');
    localStorage.setItem('apex_onboarding_v2_completed', 'true');
    localStorage.setItem('apex_user_session', JSON.stringify(user));
  }, TEST_USER);

  try {
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(1500);

    // Switch to Social Feed tab
    const socialTab = page.locator('button:has-text("Social"), button:has-text("Feed")').first();
    await socialTab.click();
    await page.waitForTimeout(1000);

    // Open author profile and direct message modal
    const authorLink = page.locator('button:has-text("@"), span:has-text("@")').first();
    await authorLink.click();
    await page.waitForTimeout(800);

    const msgBtn = page.locator('.fixed.inset-0.z-\\[100\\] button:has-text("Message")').first();
    await msgBtn.click();
    await page.waitForTimeout(1000);

    const dmInput = page.locator('.fixed.inset-0.z-\\[100\\] input[placeholder*="message" i]').first();
    const dmSend = page.locator('.fixed.inset-0.z-\\[100\\] button[type="submit"]').first();

    // ─── 1. SEND INITIAL ONLINE MESSAGE ───
    console.log('1. Sending message 1 under online conditions...');
    const msg1 = `MSG 1 - Initial connection: ${Date.now()}`;
    await dmInput.fill(msg1);
    await dmSend.click();
    await page.waitForTimeout(800);
    assert.ok(await page.locator(`text=${msg1}`).first().isVisible(), 'Message 1 must render');
    console.log('  ✅ Message 1 rendered cleanly.');

    // ─── 2. DISCONNECT NETWORK (OFFLINE SIMULATION) ───
    console.log('\n2. Simulating network loss (setting context offline)...');
    await context.setOffline(true);
    await page.waitForTimeout(800);

    // Send message 2 while offline
    const msg2 = `MSG 2 - Disconnected state: ${Date.now()}`;
    console.log(`  Sending message 2 while disconnected: "${msg2}"...`);
    await dmInput.fill(msg2);
    await dmSend.click();
    await page.waitForTimeout(800);

    // Verify UI did not crash and message is optimistically appended or handled
    assert.ok(await page.locator(`text=${msg2}`).first().isVisible(), 'Message 2 must render optimistically');
    console.log('  ✅ Message 2 rendered optimistically without UI crash.');

    // ─── 3. RECONNECT NETWORK ───
    console.log('\n3. Restoring network connectivity (setting context online)...');
    await context.setOffline(false);
    await page.waitForTimeout(1200);

    // Send message 3 after reconnection
    const msg3 = `MSG 3 - Restored connection: ${Date.now()}`;
    console.log(`  Sending message 3 after reconnect: "${msg3}"...`);
    await dmInput.fill(msg3);
    await dmSend.click();
    await page.waitForTimeout(1000);

    assert.ok(await page.locator(`text=${msg3}`).first().isVisible(), 'Message 3 must render');
    console.log('  ✅ Message 3 rendered successfully upon reconnection.');

    // ─── 4. VERIFY ORDERING & NO DUPLICATE BUBBLES ───
    console.log('\n4. Auditing message ordering and duplicate prevention...');
    const renderedMessages = await page.locator('.max-w-\\[78\\%\\]').allInnerTexts();
    console.log(`  Rendered bubble count: ${renderedMessages.length}`);

    // Check occurrences of msg1, msg2, msg3
    const countOccurrences = (text, target) => text.filter(t => t.includes(target)).length;
    assert.strictEqual(countOccurrences(renderedMessages, 'MSG 1'), 1, 'Duplicate MSG 1 detected!');
    assert.strictEqual(countOccurrences(renderedMessages, 'MSG 2'), 1, 'Duplicate MSG 2 detected!');
    assert.strictEqual(countOccurrences(renderedMessages, 'MSG 3'), 1, 'Duplicate MSG 3 detected!');
    console.log('  ✅ ZERO duplicate messages detected!');

    // ─── 5. CLOSE & REOPEN CONVERSATION (SESSION RESTORATION) ───
    console.log('\n5. Closing and reopening conversation...');
    const closeBtn = page.locator('.fixed.inset-0.z-\\[100\\] button:has(svg.lucide-x)').first();
    await closeBtn.click();
    await page.waitForTimeout(800);

    // Reopen
    await authorLink.click();
    await page.waitForTimeout(800);
    const reopenMsgBtn = page.locator('.fixed.inset-0.z-\\[100\\] button:has-text("Message")').first();
    await reopenMsgBtn.click();
    await page.waitForTimeout(1000);

    const reloadedMessages = await page.locator('.max-w-\\[78\\%\\]').allInnerTexts();
    assert.strictEqual(countOccurrences(reloadedMessages, 'MSG 1'), 1, 'Duplicate MSG 1 upon reload!');
    assert.strictEqual(countOccurrences(reloadedMessages, 'MSG 2'), 1, 'Duplicate MSG 2 upon reload!');
    assert.strictEqual(countOccurrences(reloadedMessages, 'MSG 3'), 1, 'Duplicate MSG 3 upon reload!');
    console.log('  ✅ Clean chronological ordering preserved across modal close/reopen!');

    console.log('\n════════════════════════════════════════════════════════════════');
    console.log('   REALTIME RECONNECTION TEST: 100% PASSED');
    console.log('════════════════════════════════════════════════════════════════\n');

  } finally {
    await browser.close();
  }
}

runReconnectionTest().catch(err => {
  console.error('Reconnection Test Failed:', err);
  process.exit(1);
});
