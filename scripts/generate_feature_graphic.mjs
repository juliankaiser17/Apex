import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

async function createFeatureGraphic() {
  const canvasWidth = 1024;
  const canvasHeight = 500;

  console.log('1. Preparing App Icon...');
  const iconBuffer = await sharp('docs/store/app_icon_512.png')
    .resize(56, 56)
    .toBuffer();

  const iconMask = Buffer.from(`
    <svg width="56" height="56" viewBox="0 0 56 56" xmlns="http://www.w3.org/2000/svg">
      <rect width="56" height="56" rx="14" fill="#FFFFFF" />
    </svg>
  `);
  const roundedIcon = await sharp(iconBuffer)
    .composite([{ input: iconMask, blend: 'dest-in' }])
    .png()
    .toBuffer();

  console.log('2. Preparing Phone Screen (Scanner HUD)...');
  const screenW = 208;
  const screenH = 434;
  const phoneW = screenW + 12;
  const phoneH = screenH + 12;

  const scannerCropped = await sharp('docs/store/screenshots/2_scanner_locked_on_car.png')
    .extract({ left: 0, top: 110, width: 1082, height: 2270 })
    .resize(screenW, screenH, { fit: 'cover' })
    .toBuffer();

  const screenMask = Buffer.from(`
    <svg width="${screenW}" height="${screenH}" viewBox="0 0 ${screenW} ${screenH}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${screenW}" height="${screenH}" rx="24" fill="#FFFFFF" />
    </svg>
  `);
  const glassGlare = Buffer.from(`
    <svg width="${screenW}" height="${screenH}" viewBox="0 0 ${screenW} ${screenH}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="glare" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.10" />
          <stop offset="40%" stop-color="#FFFFFF" stop-opacity="0.03" />
          <stop offset="70%" stop-color="#FFFFFF" stop-opacity="0.0" />
        </linearGradient>
      </defs>
      <rect width="${screenW}" height="${screenH}" fill="url(#glare)" />
    </svg>
  `);

  const roundedScreen = await sharp(scannerCropped)
    .composite([
      { input: glassGlare, blend: 'over' },
      { input: screenMask, blend: 'dest-in' }
    ])
    .png()
    .toBuffer();

  // Premium titanium chassis
  const phoneFrame = Buffer.from(`
    <svg width="${phoneW}" height="${phoneH}" viewBox="0 0 ${phoneW} ${phoneH}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="phoneBorder" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#64748B" />
          <stop offset="30%" stop-color="#334155" />
          <stop offset="70%" stop-color="#0F172A" />
          <stop offset="100%" stop-color="#475569" />
        </linearGradient>
      </defs>
      <rect x="1.5" y="1.5" width="${phoneW - 3}" height="${phoneH - 3}" rx="28" fill="#0A0D12" stroke="url(#phoneBorder)" stroke-width="2.5" />
      <rect x="${phoneW / 2 - 24}" y="10" width="48" height="11" rx="5.5" fill="#000000" />
      <circle cx="${phoneW / 2 + 13}" cy="15.5" r="2" fill="#1E293B" />
    </svg>
  `);

  console.log('3. Preparing Hero Collectible Card...');
  const cardW = 275;
  const cardH = 316;
  const cardCropped = await sharp('docs/store/card_ferrari.png')
    .resize(cardW, cardH, { fit: 'fill' })
    .toBuffer();

  const cardMask = Buffer.from(`
    <svg width="${cardW}" height="${cardH}" viewBox="0 0 ${cardW} ${cardH}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${cardW}" height="${cardH}" rx="18" fill="#FFFFFF" />
    </svg>
  `);
  const roundedCard = await sharp(cardCropped)
    .composite([{ input: cardMask, blend: 'dest-in' }])
    .png()
    .toBuffer();

  // Metallic gold holographic rim
  const cardBorder = Buffer.from(`
    <svg width="${cardW}" height="${cardH}" viewBox="0 0 ${cardW} ${cardH}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="goldRim" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#FDE68A" />
          <stop offset="25%" stop-color="#F59E0B" />
          <stop offset="60%" stop-color="#D97706" />
          <stop offset="85%" stop-color="#FBBF24" />
          <stop offset="100%" stop-color="#92400E" />
        </linearGradient>
      </defs>
      <rect x="1.5" y="1.5" width="${cardW - 3}" height="${cardH - 3}" rx="18" fill="none" stroke="url(#goldRim)" stroke-width="2" />
    </svg>
  `);

  console.log('4. Generating Main Canvas...');
  const phoneX = 492;
  const phoneY = 27;

  const cardX = 708;
  const cardY = 92;

  const mainSvg = Buffer.from(`
    <svg width="${canvasWidth}" height="${canvasHeight}" viewBox="0 0 ${canvasWidth} ${canvasHeight}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <!-- Canvas Background -->
        <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#05070A" />
          <stop offset="40%" stop-color="#080C12" />
          <stop offset="100%" stop-color="#0F141D" />
        </linearGradient>

        <!-- Headline Gradient -->
        <linearGradient id="redAccent" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#FF2B36" />
          <stop offset="60%" stop-color="#E50914" />
          <stop offset="100%" stop-color="#B91C1C" />
        </linearGradient>

        <!-- Ambient Glows -->
        <radialGradient id="redBloom" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#E50914" stop-opacity="0.32" />
          <stop offset="100%" stop-color="#E50914" stop-opacity="0.0" />
        </radialGradient>

        <radialGradient id="goldBloom" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#F59E0B" stop-opacity="0.28" />
          <stop offset="100%" stop-color="#F59E0B" stop-opacity="0.0" />
        </radialGradient>

        <!-- Shadows -->
        <filter id="phoneShadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="-10" dy="18" stdDeviation="24" flood-color="#000000" flood-opacity="0.85" />
        </filter>
        <filter id="cardShadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="14" dy="22" stdDeviation="28" flood-color="#000000" flood-opacity="0.95" />
        </filter>

        <!-- Grid Pattern -->
        <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
          <path d="M 32 0 L 0 0 0 32" fill="none" stroke="rgba(255, 255, 255, 0.02)" stroke-width="1"/>
        </pattern>
      </defs>

      <!-- Background -->
      <rect width="${canvasWidth}" height="${canvasHeight}" fill="url(#bgGrad)" />
      <rect width="${canvasWidth}" height="${canvasHeight}" fill="url(#grid)" />

      <!-- Lighting Glows -->
      <circle cx="580" cy="240" r="260" fill="url(#redBloom)" />
      <circle cx="840" cy="250" r="260" fill="url(#goldBloom)" />

      <!-- Left Brand Header -->
      <g transform="translate(50, 46)">
        <rect x="-1" y="-1" width="58" height="58" rx="15" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="1.2" />
        <text x="70" y="28" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="28" font-weight="900" letter-spacing="2" fill="#FFFFFF">
          APEX
        </text>
        <text x="72" y="47" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="10.5" font-weight="800" letter-spacing="2.4" fill="#EF4444">
          SUPERCAR SPOTTER &amp; COLLECTOR
        </text>
      </g>

      <!-- Main Headline -->
      <g transform="translate(50, 160)">
        <text x="0" y="0" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="44" font-weight="900" letter-spacing="-0.5" fill="#FFFFFF">
          POINT. SCAN.
        </text>
        <text x="0" y="48" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="44" font-weight="900" letter-spacing="-0.5" fill="url(#redAccent)">
          COLLECT EXOTICS.
        </text>
      </g>

      <!-- Description -->
      <g transform="translate(50, 250)">
        <text x="0" y="0" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="14.5" font-weight="500" fill="#94A3B8">
          Turn real supercars spotted on streets into verified collector cards.
        </text>
        <text x="0" y="23" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="14.5" font-weight="400" fill="#64748B">
          Real-time neural recognition • Instant specs • Dynamic local rarity.
        </text>
      </g>

      <!-- 3 Feature Chips (Carefully bounded inside X: 50 to 470) -->
      <g transform="translate(50, 314)">
        <!-- Chip 1: AI Vision -->
        <g transform="translate(0, 0)">
          <rect x="0" y="0" width="128" height="34" rx="8" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.12)" stroke-width="1" />
          <circle cx="16" cy="17" r="4" fill="#10B981" />
          <text x="28" y="21" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="11" font-weight="700" letter-spacing="0.5" fill="#E2E8F0">
            AI CAMERA
          </text>
        </g>

        <!-- Chip 2: Local Rarity -->
        <g transform="translate(136, 0)">
          <rect x="0" y="0" width="138" height="34" rx="8" fill="rgba(245, 158, 11, 0.10)" stroke="rgba(245, 158, 11, 0.35)" stroke-width="1" />
          <circle cx="16" cy="17" r="4" fill="#F59E0B" />
          <text x="28" y="21" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="11" font-weight="700" letter-spacing="0.5" fill="#FCD34D">
            LOCAL RARITY
          </text>
        </g>

        <!-- Chip 3: Collector Garage -->
        <g transform="translate(282, 0)">
          <rect x="0" y="0" width="144" height="34" rx="8" fill="rgba(229, 9, 20, 0.10)" stroke="rgba(229, 9, 20, 0.35)" stroke-width="1" />
          <circle cx="16" cy="17" r="4" fill="#EF4444" />
          <text x="28" y="21" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="11" font-weight="700" letter-spacing="0.5" fill="#FCA5A5">
            5,000+ HP GARAGE
          </text>
        </g>
      </g>

      <!-- Bottom Status Bar -->
      <g transform="translate(50, 434)">
        <line x1="0" y1="0" x2="390" y2="0" stroke="rgba(255,255,255,0.08)" stroke-width="1" />
        <text x="0" y="22" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="10.5" font-weight="700" letter-spacing="1.5" fill="#64748B">
          VERIFIED SPECS
        </text>
        <circle cx="118" cy="18" r="2.5" fill="#334155" />
        <text x="130" y="22" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="10.5" font-weight="600" letter-spacing="1.2" fill="#475569">
          0-100 KM/H  •  HORSEPOWER  •  TOP SPEED
        </text>
      </g>

      <!-- Drop Shadows -->
      <rect x="${phoneX - 8}" y="${phoneY + 4}" width="${phoneW}" height="${phoneH}" rx="28" fill="#000000" filter="url(#phoneShadow)" />
      <rect x="${cardX - 4}" y="${cardY + 6}" width="${cardW}" height="${cardH}" rx="18" fill="#000000" filter="url(#cardShadow)" />
    </svg>
  `);

  console.log('5. Compositing Real Assets...');
  await sharp(mainSvg)
    .composite([
      // 1. App Icon
      { input: roundedIcon, top: 46, left: 50 },
      // 2. Phone Frame & Screen
      { input: phoneFrame, top: phoneY, left: phoneX },
      { input: roundedScreen, top: phoneY + 6, left: phoneX + 6 },
      // 3. Card & Border
      { input: roundedCard, top: cardY, left: cardX },
      { input: cardBorder, top: cardY, left: cardX },
    ])
    .jpeg({ quality: 96 })
    .toFile('docs/store/feature_graphic_1024x500.jpg');

  // Also overwrite the original script for maintainability
  fs.copyFileSync('scripts/generate_feature_graphic_v4.mjs', 'scripts/generate_feature_graphic.mjs');

  console.log('✅ Success! Overwrote docs/store/feature_graphic_1024x500.jpg');
}

createFeatureGraphic().catch(console.error);
