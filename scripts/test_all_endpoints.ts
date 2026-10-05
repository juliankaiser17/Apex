async function testAllEndpoints() {
  const endpoints = [
    '../api/analyze.js',
    '../api/verifyIntegrity.js',
    '../api/account/delete.js',
    '../api/admin/ai-control.js',
    '../api/missions/claim.js',
    '../api/scans/correct.js',
    '../api/scans/ingest.js',
    '../api/scans/status.js'
  ];

  for (const ep of endpoints) {
    try {
      await import(ep);
      console.log(`[PASS] Loaded: ${ep}`);
    } catch (err) {
      console.error(`[FAIL] Error loading ${ep}:`, err);
    }
  }
}

testAllEndpoints();
