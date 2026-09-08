import { runAllIntegrationTests } from '../src/ai-engine/__tests__/engineIntegration.test';

async function main() {
  console.log('Running Apex AI Engine Integration & Failure Simulator Tests...');
  const res = await runAllIntegrationTests();
  console.log('\n--- TEST RESULTS ---');
  res.results.forEach((r) => console.log(r));
  console.log('--------------------');
  if (res.passed) {
    console.log('ALL INTEGRATION & RESILIENCE TESTS PASSED.');
    process.exit(0);
  } else {
    console.error('SOME TESTS FAILED.');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error running tests:', err);
  process.exit(1);
});
