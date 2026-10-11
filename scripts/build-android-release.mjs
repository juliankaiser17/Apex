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
console.log('📦 Step 1: Building production web bundle & auditing client assets...');
try {
  execSync('npm run build', { stdio: 'inherit', cwd: projectRoot });
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

// 4. Check for signing credentials
const keystore = process.env.APEX_RELEASE_KEYSTORE;
const storePass = process.env.APEX_RELEASE_STORE_PASSWORD;
const keyAlias = process.env.APEX_RELEASE_KEY_ALIAS;
const keyPass = process.env.APEX_RELEASE_KEY_PASSWORD;

const isConfiguredForSigning = Boolean(
  keystore && fs.existsSync(keystore) && storePass && keyAlias && keyPass
);

if (isConfiguredForSigning) {
  console.log('\n🔑 Signing credentials detected from environment.');
  console.log(`   Keystore: ${keystore}`);
  console.log(`   Key Alias: ${keyAlias}`);
} else {
  console.log('\n⚠️  No complete signing credentials in environment variables.');
  console.log('   (APEX_RELEASE_KEYSTORE, APEX_RELEASE_STORE_PASSWORD, APEX_RELEASE_KEY_ALIAS, APEX_RELEASE_KEY_PASSWORD)');
  console.log('   Building unsigned release artifacts for inspection / sideload alignment.\n');
}

// 5. Build Release AAB (Android App Bundle for Google Play)
console.log('🔨 Step 3: Compiling Android App Bundle (bundleRelease)...');
const gradlewCmd = process.platform === 'win32' ? '.\\gradlew.bat' : './gradlew';

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

// 6. Build Release APK (for direct sideload testing)
console.log('\n🔨 Step 4: Compiling Release APK (assembleRelease)...');
try {
  execSync(`${gradlewCmd} assembleRelease`, { stdio: 'inherit', cwd: androidDir });
  const apkPath = path.resolve(androidDir, 'app/build/outputs/apk/release/app-release.apk');
  const unsignedApkPath = path.resolve(androidDir, 'app/build/outputs/apk/release/app-release-unsigned.apk');
  const targetApk = fs.existsSync(apkPath) ? apkPath : (fs.existsSync(unsignedApkPath) ? unsignedApkPath : null);

  if (targetApk) {
    const stats = fs.statSync(targetApk);
    console.log(`✅ Release APK generated: ${targetApk} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
  }
} catch (err) {
  console.error('❌ Gradle assembleRelease failed:', err.message);
  process.exit(1);
}

console.log('\n====================================================');
console.log('🎉 ANDROID RELEASE BUILD COMPLETED SUCCESSFULLY');
console.log('====================================================\n');
