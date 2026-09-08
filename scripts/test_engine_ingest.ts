import { apexEngine } from '../src/ai-engine/engine';
import fs from 'fs';

async function testIngest() {
  const buf = fs.readFileSync('Cars/WhatsApp Image 2026-09-08 at 06.51.31.jpeg');
  const dataUrl = 'data:image/jpeg;base64,' + buf.toString('base64');
  console.log('Ingesting REAL_001 through apexEngine.ingestScan...');
  const res = await apexEngine.ingestScan({
    imageDataUrl: dataUrl,
    userId: 'test_user',
    fileName: 'REAL_001.jpeg',
    priority: 'HIGH'
  });
  console.log('Ingestion Response:', { scanId: res.scanId, status: res.status, queuePosition: res.queuePosition });
  
  // Poll until complete
  for (let i = 0; i < 40; i++) {
    await new Promise(r => setTimeout(r, 1000));
    const status = apexEngine.getScanStatus(res.scanId);
    console.log(`  [${i + 1}s] Status: ${status.status}`);
    if (status.status === 'completed' || status.status === 'needs_review' || status.status === 'abstained' || status.status === 'failed') {
      console.log('Finished with status:', status.status);
      console.log('Make:', status.result?.make, 'Model:', status.result?.model, 'ModelVersion:', status.result?.modelVersion);
      process.exit(0);
    }
  }
}

testIngest().catch(e => {
  console.error(e);
  process.exit(1);
});
