async function pollUntilLive() {
  const url = 'https://apex-spotter.vercel.app/api/analyze';
  console.log('[Poll] Monitoring Vercel deployment for v3.2.2-production-release...');
  const targetVersion = 'v3.2.2-production-release';
  const start = Date.now();
  const maxWaitMs = 180000; // 3 minutes

  while (Date.now() - start < maxWaitMs) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'origin': 'capacitor://localhost'
        },
        body: JSON.stringify({
          imageBase64: '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
          mimeType: 'image/jpeg',
          idempotencyKey: `poll_${Date.now()}`
        })
      });
      const data: any = await res.json().catch(() => ({}));
      const currentVersion = data.analysisVersion;
      console.log(`[${Math.round((Date.now() - start) / 1000)}s] Status: ${res.status}, analysisVersion: ${currentVersion}`);
      if (currentVersion === targetVersion) {
        console.log(`🎉 SUCCESS! Deployed version ${targetVersion} is LIVE!`);
        return true;
      }
    } catch (err: any) {
      console.log(`[Poll] Request error: ${err?.message}`);
    }
    await new Promise(r => setTimeout(r, 10000));
  }
  console.error('Timed out waiting for Vercel deployment.');
  return false;
}

pollUntilLive().catch(console.error);
