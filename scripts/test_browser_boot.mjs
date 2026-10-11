#!/usr/bin/env node
import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';

console.log('--- APEX BROWSER SMOKE TEST (HEADLESS PREVIEW BOOT) ---');

const distDir = path.resolve(process.cwd(), 'dist');
if (!fs.existsSync(distDir)) {
  console.error('❌ dist/ directory not found. Please run `npm run build` first.');
  process.exit(1);
}

// 1. Start lightweight static web server for dist/
const server = http.createServer((req, res) => {
  let filePath = path.join(distDir, req.url.split('?')[0]);
  if (req.url === '/' || req.url === '') {
    filePath = path.join(distDir, 'index.html');
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath);
    const contentTypes = {
      '.html': 'text/html',
      '.js': 'application/javascript',
      '.css': 'text/css',
      '.png': 'image/png',
      '.svg': 'image/svg+xml',
      '.json': 'application/json'
    };
    res.writeHead(200, { 'Content-Type': contentTypes[ext] || 'application/octet-stream' });
    res.end(fs.readFileSync(filePath));
  } else {
    // SPA fallback
    const indexPath = path.join(distDir, 'index.html');
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(fs.readFileSync(indexPath));
  }
});

const PORT = 4180;
server.listen(PORT, async () => {
  let browser;
  try {
    console.log(`🌐 Static server listening on http://localhost:${PORT}`);
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    const consoleErrors = [];
    const pageErrors = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    page.on('pageerror', err => pageErrors.push(err.message));

    console.log(`🚀 Navigating to http://localhost:${PORT}...`);
    await page.goto(`http://localhost:${PORT}`, { waitUntil: 'networkidle', timeout: 15000 });

    // Allow React bootloader and auth preload to resolve
    await page.waitForTimeout(2500);

    const rootContent = await page.innerHTML('#root');
    const fallbackVisible = await page.evaluate(() => {
      const el = document.getElementById('apex-boot-fallback');
      return el && window.getComputedStyle(el).display !== 'none';
    });

    console.log(`\nDiagnostics:`);
    console.log(`- Page Errors: ${pageErrors.length}`);
    console.log(`- Console Errors: ${consoleErrors.length}`);
    console.log(`- Root HTML Length: ${rootContent.length}`);
    console.log(`- Boot Fallback Screen Visible: ${fallbackVisible}`);

    if (pageErrors.length > 0) {
      console.error('❌ FATAL: Unhandled page errors detected:', pageErrors);
      process.exit(1);
    }

    if (consoleErrors.length > 0) {
      console.error('❌ FATAL: Console errors detected:', consoleErrors);
      process.exit(1);
    }

    if (fallbackVisible) {
      console.error('❌ FATAL: Boot fallback error screen was triggered.');
      process.exit(1);
    }

    if (!rootContent || rootContent.length < 50) {
      console.error('❌ FATAL: #root container is empty or failed to mount.');
      process.exit(1);
    }

    console.log('\n✅ BROWSER BOOT SMOKE TEST PASSED: React mounted cleanly with 0 console errors.\n');
    await browser.close();
    server.close();
    process.exit(0);
  } catch (err) {
    console.error('❌ Browser smoke test exception:', err.message);
    if (browser) await browser.close();
    server.close();
    process.exit(1);
  }
});
