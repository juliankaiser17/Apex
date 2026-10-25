import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const srcImage = 'C:/Users/DELL/.gemini/antigravity-ide/brain/a6ec2a65-a50e-45e3-80e6-327ca1d077f3/hypercar_studio_hero_1792947321086.jpg';

async function createFeatureGraphic() {
  const width = 1024;
  const height = 500;

  // 1. Resize and crop the base car image to 1024x500, positioning right to highlight car
  const baseBuffer = await sharp(srcImage)
    .resize(width, height, { fit: 'cover', position: 'right' })
    .toBuffer();

  // 2. High-precision SVG Overlay with dark left gradient, clean vector typography, and authentic badges
  const svgOverlay = Buffer.from(`
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="leftDark" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#080A0E" stop-opacity="0.96" />
          <stop offset="38%" stop-color="#080A0E" stop-opacity="0.85" />
          <stop offset="65%" stop-color="#080A0E" stop-opacity="0.30" />
          <stop offset="85%" stop-color="#080A0E" stop-opacity="0.0" />
        </linearGradient>
        <linearGradient id="bottomFade" x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stop-color="#080A0E" stop-opacity="0.70" />
          <stop offset="25%" stop-color="#080A0E" stop-opacity="0.0" />
        </linearGradient>
        <linearGradient id="accentGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#FF1E27" />
          <stop offset="100%" stop-color="#B30006" />
        </linearGradient>
      </defs>

      <!-- Gradient Overlays for legibility -->
      <rect width="${width}" height="${height}" fill="url(#leftDark)" />
      <rect width="${width}" height="${height}" fill="url(#bottomFade)" />

      <!-- Red accent indicator line -->
      <rect x="54" y="92" width="4" height="38" rx="2" fill="url(#accentGrad)" />

      <!-- Top Category -->
      <text x="68" y="106" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif" font-size="12" font-weight="700" letter-spacing="3" fill="#E50914">
        AI VEHICLE IDENTIFICATION
      </text>

      <!-- Main Headline: APEX -->
      <text x="54" y="174" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif" font-size="62" font-weight="900" letter-spacing="-1" fill="#FFFFFF">
        APEX
      </text>

      <!-- Subtitle: SUPERCAR SPOTTER -->
      <text x="56" y="212" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif" font-size="20" font-weight="800" letter-spacing="4" fill="#E50914">
        SUPERCAR SPOTTER
      </text>

      <!-- Value Props -->
      <text x="56" y="254" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif" font-size="14" font-weight="400" fill="#9CA3AF">
        Point your camera. Recognize supercars instantly.
      </text>
      <text x="56" y="276" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif" font-size="14" font-weight="400" fill="#9CA3AF">
        Build your collector garage and hunt rare sightings.
      </text>

      <!-- Feature Badges -->
      <g transform="translate(56, 318)">
        <!-- Badge 1: Neural Vision -->
        <rect x="0" y="0" width="134" height="30" rx="6" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.14)" stroke-width="1" />
        <text x="14" y="19" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif" font-size="11" font-weight="700" letter-spacing="0.5" fill="#F3F4F6">
          NEURAL VISION
        </text>

        <!-- Badge 2: Local Rarity -->
        <rect x="144" y="0" width="130" height="30" rx="6" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.14)" stroke-width="1" />
        <text x="158" y="19" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif" font-size="11" font-weight="700" letter-spacing="0.5" fill="#F3F4F6">
          LOCAL RARITY
        </text>

        <!-- Badge 3: Radar Hunts -->
        <rect x="284" y="0" width="128" height="30" rx="6" fill="rgba(229,9,20,0.12)" stroke="#E50914" stroke-width="1" />
        <text x="298" y="19" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif" font-size="11" font-weight="700" letter-spacing="0.5" fill="#FF4D55">
          RADAR HUNTS
        </text>
      </g>

      <!-- Authenticity Specs Line at bottom left -->
      <g transform="translate(56, 420)">
        <rect x="0" y="0" width="90" height="22" rx="4" fill="rgba(245, 158, 11, 0.15)" stroke="#F59E0B" stroke-width="1" />
        <text x="10" y="15" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif" font-size="10" font-weight="800" letter-spacing="1.5" fill="#FBBF24">
          LEGENDARY
        </text>
        <text x="102" y="16" font-family="Courier, monospace" font-size="12" font-weight="600" letter-spacing="1" fill="#6B7280">
          950 HP  //  V12 HYBRID  //  350 KM/H
        </text>
      </g>
    </svg>
  `);

  await sharp(baseBuffer)
    .composite([{ input: svgOverlay, top: 0, left: 0 }])
    .jpeg({ quality: 96 })
    .toFile('docs/store/feature_graphic_1024x500.jpg');

  console.log('✅ Generated clean human-crafted feature graphic at docs/store/feature_graphic_1024x500.jpg');
}

createFeatureGraphic().catch(err => {
  console.error(err);
  process.exit(1);
});
