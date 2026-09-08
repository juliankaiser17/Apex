import { runAllAuthTests } from './authState.test';

declare const process: any;

async function main() {
  console.log('--- Starting Apex Auth State Verification Suite ---');
  const res = await runAllAuthTests();
  res.results.forEach(r => console.log(r));
  console.log('----------------------------------------------------');
  if (res.passed) {
    console.log('ALL AUTH & ONBOARDING & STREAK TESTS PASSED SUCCESSFULLY!');
    process.exit(0);
  } else {
    console.error('TEST FAILURES DETECTED!');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
