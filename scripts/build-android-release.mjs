#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('====================================================');
console.log('   APEX ANDROID RELEASE BUILD SCRIPT');
console.log('====================================================\n');

const projectRoot = process.cwd();
const androidDir = path.resolve(projectRoot, 'android');

// 1. Verify Android project exists
if (!fs.existsSync(androidDir)) {
  console.error('❌ Android project directory not found at', androidDir);
  process.exit(1);
}

// 2. Build web client & run bundle hygiene checks
console.log('📦 Step 1: Building production web bundle (VITE_ENABLE_ADMIN=false)...');
try {
  const buildEnv = { ...process.env, VITE_ENABLE_ADMIN: 'false' };
  execSync('npm run build', { stdio: 'inherit', cwd: projectRoot, env: buildEnv });
} catch (err) {
  console.error('❌ Web client production build failed.');
  process.exit(1);
}

// 3. Sync to Capacitor
console.log('\n🔄 Step 2: Syncing web bundle to Android native platform (npx cap sync android)...');
try {
  execSync('npx cap sync android', { stdio: 'inherit', cwd: projectRoot });
} catch (err) {
  console.error('❌ Capacitor sync failed.');
  process.exit(1);
}

// 3b. Run client bundle hygiene auditor
console.log('\n🛡️ Step 2b: Auditing client bundle hygiene (scripts/check-client-bundle.mjs)...');
try {
  execSync('node scripts/check-client-bundle.mjs', { stdio: 'inherit', cwd: projectRoot });
} catch (err) {
  console.error('❌ Client bundle security audit failed.');
  process.exit(1);
}

// 4. Check for signing credentials
let keystore = process.env.APEX_RELEASE_KEYSTORE;
if (keystore && !path.isAbsolute(keystore)) {
  keystore = path.resolve(projectRoot, keystore);
}
const storePass = process.env.APEX_RELEASE_STORE_PASSWORD;
const keyAlias = process.env.APEX_RELEASE_KEY_ALIAS;
const keyPass = process.env.APEX_RELEASE_KEY_PASSWORD;

const isConfiguredForSigning = Boolean(
  keystore && fs.existsSync(keystore) && storePass && keyAlias && keyPass
);

if (isConfiguredForSigning) {
  process.env.APEX_RELEASE_KEYSTORE = keystore;
  process.env.APEX_RELEASE_STORE_PASSWORD = storePass;
  process.env.APEX_RELEASE_KEY_ALIAS = keyAlias;
  process.env.APEX_RELEASE_KEY_PASSWORD = keyPass;
  console.log('\n🔑 Signing credentials detected from environment.');
  console.log(`   Keystore: ${keystore}`);
  console.log(`   Key Alias: ${keyAlias}`);
} else {
  console.log('\n⚠️  No complete signing credentials in environment variables.');
  console.log('   Required: APEX_RELEASE_KEYSTORE, APEX_RELEASE_STORE_PASSWORD, APEX_RELEASE_KEY_ALIAS, APEX_RELEASE_KEY_PASSWORD');
  console.log('   Building release artifacts using default/configured signing...\n');
}

// 5. Clean stale build artifacts to ensure fresh packaging of web assets
console.log('🧹 Step 3: Cleaning stale build outputs (gradlew clean)...');
const gradlewCmd = process.platform === 'win32' ? '.\\gradlew.bat' : './gradlew';
try {
  const oldApkPath = path.resolve(androidDir, 'app/build/outputs/apk/release/app-release.apk');
  if (fs.existsSync(oldApkPath)) fs.unlinkSync(oldApkPath);
  const oldAabPath = path.resolve(androidDir, 'app/build/outputs/bundle/release/app-release.aab');
  if (fs.existsSync(oldAabPath)) fs.unlinkSync(oldAabPath);
  execSync(`${gradlewCmd} clean`, { stdio: 'inherit', cwd: androidDir });
} catch (err) {
  console.warn('⚠️ Gradle clean notice:', err.message);
}

// 6. Build Release AAB (Android App Bundle for Google Play)
console.log('\n🔨 Step 4: Compiling Android App Bundle (bundleRelease)...');
try {
  execSync(`${gradlewCmd} bundleRelease`, { stdio: 'inherit', cwd: androidDir });
  const aabPath = path.resolve(androidDir, 'app/build/outputs/bundle/release/app-release.aab');
  if (fs.existsSync(aabPath)) {
    const stats = fs.statSync(aabPath);
    console.log(`✅ Release AAB generated: ${aabPath} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
  }
} catch (err) {
  console.error('❌ Gradle bundleRelease failed:', err.message);
  process.exit(1);
}

// 7. Build Release APK (for direct sideload testing)
console.log('\n🔨 Step 5: Compiling Release APK (assembleRelease)...');
let targetApk = null;
try {
  execSync(`${gradlewCmd} assembleRelease`, { stdio: 'inherit', cwd: androidDir });
  const apkPath = path.resolve(androidDir, 'app/build/outputs/apk/release/app-release.apk');
  const unsignedApkPath = path.resolve(androidDir, 'app/build/outputs/apk/release/app-release-unsigned.apk');
  targetApk = fs.existsSync(apkPath) ? apkPath : (fs.existsSync(unsignedApkPath) ? unsignedApkPath : null);

  if (targetApk) {
    const stats = fs.statSync(targetApk);
    const apkBuf = fs.readFileSync(targetApk);
    const crypto = await import('crypto');
    const apkSha256 = crypto.createHash('sha256').update(apkBuf).digest('hex');

    console.log(`✅ Release APK generated: ${targetApk} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
    console.log(`   SHA-256: ${apkSha256}`);
    console.log(`   Timestamp: ${stats.mtime.toLocaleString()}`);

    const desktopDir = path.resolve(process.env.USERPROFILE || process.env.HOME || '', 'Desktop');
    if (fs.existsSync(desktopDir)) {
      const desktopApk = path.resolve(desktopDir, 'Apex-Beta-v1.0.apk');
      if (fs.existsSync(desktopApk)) fs.unlinkSync(desktopApk);
      fs.copyFileSync(targetApk, desktopApk);
      console.log(`📱 Copied release APK to Desktop: ${desktopApk}`);
    }
  }
} catch (err) {
  console.error('❌ Gradle assembleRelease failed:', err.message);
  process.exit(1);
}

console.log('\n====================================================');
console.log('🎉 ANDROID RELEASE BUILD COMPLETED SUCCESSFULLY');
console.log('====================================================');
if (keystore && fs.existsSync(keystore)) {
  console.log('\nCommand to print signing SHA-1 for Google Cloud Android OAuth client:');
  console.log(`keytool -list -v -keystore "${keystore}" -alias "${keyAlias || 'apex-release'}"`);
} else {
  console.log('\nCommand to print signing SHA-1 once keystore is configured:');
  console.log('keytool -list -v -keystore <keystore-path> -alias <key-alias>');
}
console.log('Google Cloud OAuth Package Name: org.juliankaiser.apex\n');
