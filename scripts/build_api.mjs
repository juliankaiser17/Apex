import { build } from 'esbuild';

const targets = [
  { in: 'src/api/analyze.ts', out: 'api/analyze.js' },
  { in: 'src/api/verifyIntegrity.ts', out: 'api/verifyIntegrity.js' },
  { in: 'src/api/account/delete.ts', out: 'api/account/delete.js' },
  { in: 'src/api/missions/claim.ts', out: 'api/missions/claim.js' }
];

async function run() {
  await Promise.all(
    targets.map(t =>
      build({
        entryPoints: [t.in],
        outfile: t.out,
        bundle: true,
        platform: 'node',
        format: 'esm',
        packages: 'external'
      })
    )
  );
  console.log('[build:api] All API endpoints bundled successfully.');
}

run().catch(err => {
  console.error('[build:api] Error bundling API endpoints:', err);
  process.exit(1);
});
