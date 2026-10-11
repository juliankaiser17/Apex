// scripts/audit_raw_vlm_adjudication.mjs
// Phase 12A.2 & 12A.4: Raw VLM Adjudication Audit on Full Validation Set (N=32)
// Executes live API calls, records full raw responses, tokens, latencies, and reconciles equalities.

import fs from 'fs';
import path from 'path';

// Load .env
const env = fs.readFileSync('.env', 'utf8');
const envMap = {};
env.split('\n').forEach(l => {
  const i = l.indexOf('=');
  if (i > -1) envMap[l.slice(0, i).trim()] = l.slice(i+1).trim().replace(/^["']|["']$/g, '');
});

const geminiKey = envMap.GEMINI_API_KEY;
if (!geminiKey) {
  console.error('FATAL: GEMINI_API_KEY not found in .env');
  process.exit(1);
}

const RAW_RESPONSES_DIR = path.resolve('eval/raw_responses');
fs.mkdirSync(RAW_RESPONSES_DIR, { recursive: true });

async function callGeminiRaw(modelName, prompt, imageBase64) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${geminiKey}`;
  const t0 = performance.now();
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const timestamp = new Date().toISOString();

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: prompt },
          { inline_data: { mime_type: 'image/jpeg', data: imageBase64 } }
        ]
      }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 256
      }
    })
  });

  const latencyMs = Math.round(performance.now() - t0);
  if (!res.ok) {
    const errText = await res.text();
    return {
      requestId,
      timestamp,
      modelName,
      success: false,
      status: res.status,
      error: errText,
      latencyMs
    };
  }

  const data = await res.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const usage = data.usageMetadata || {};

  return {
    requestId,
    timestamp,
    modelName,
    success: true,
    status: 200,
    rawText,
    tokens: {
      promptTokens: usage.promptTokenCount || 0,
      candidatesTokens: usage.candidatesTokenCount || 0,
      totalTokens: usage.totalTokenCount || 0
    },
    latencyMs
  };
}

async function runAdjudicationAudit() {
  console.log('====================================================');
  console.log('12A.2 & 12A.4: RAW VLM ADJUDICATION AUDIT (N=32)');
  console.log('====================================================\n');

  const manifest = JSON.parse(fs.readFileSync('eval/golden/proposed_clean_manifest.json', 'utf8'));
  const valItems = manifest.filter(x => x.split === 'val' && x.canonical_id && x.is_in_catalogue && fs.existsSync(x.image_path));
  console.log(`Loaded ${valItems.length} valid in-catalogue validation items.`);

  const { constrainedVlmAdjudicator } = await import('../src/ai-engine/v2/stageC_constrainedAdjudicator.ts');
  const { galleryRetrievalEngine } = await import('../src/ai-engine/v2/stageB_galleryRetrieval.ts');

  const rawLedger = [];
  let gemini35_presentCorrect = 0;
  let gemini35_presentTotal = 0;
  let gemini35_absentAbstained = 0;
  let gemini35_absentTotal = 0;
  let truthInStageBCount = 0;

  let totalCostGemini35 = 0;

  for (let i = 0; i < valItems.length; i++) {
    const item = valItems[i];
    const imgBuf = fs.readFileSync(item.image_path);
    const b64 = imgBuf.toString('base64');

    // 1. Check if truth was in Stage B retrieval
    const queryVector = await galleryRetrievalEngine.generateQueryVector(item.image_path);
    const retrieval = galleryRetrievalEngine.searchGallery(queryVector, item.viewpoint || 'front_3q', { topK: 5 });
    const inTop5 = retrieval.topCandidates.some(c => c.canonicalId === item.canonical_id);
    if (inTop5) truthInStageBCount++;

    // 2. Test Case A: Truth candidate IS present in shortlist
    const candidatesPresent = [
      { canonicalId: item.canonical_id, displayName: item.display_name, distinguishingFeatures: ['Aerodynamic styling, badge, body proportions'] },
      { canonicalId: 'toyota-camry-xv70', displayName: 'Toyota Camry (XV70)', distinguishingFeatures: ['Mid-size family sedan'] },
      { canonicalId: 'ferrari-488-gtb', displayName: 'Ferrari 488 GTB', distinguishingFeatures: ['Scalloped side air intakes'] }
    ];

    const promptPresent = constrainedVlmAdjudicator.buildComparisonPrompt(candidatesPresent, item.viewpoint || 'front_3q');
    const respPresent = await callGeminiRaw('gemini-3.5-flash', promptPresent, b64);
    totalCostGemini35 += (respPresent.tokens?.totalTokens || 1200) * (0.15 / 1000000);

    let presentChosen = null;
    if (respPresent.success) {
      const parsed = constrainedVlmAdjudicator.validateAdjudicationResponse(
        respPresent.rawText.match(/\{[\s\S]*\}/) ? JSON.parse(respPresent.rawText.match(/\{[\s\S]*\}/)[0]) : null,
        candidatesPresent
      );
      presentChosen = parsed.output.chosen_candidate_id;
      gemini35_presentTotal++;
      if (presentChosen === item.canonical_id) {
        gemini35_presentCorrect++;
      }
    }

    rawLedger.push({
      item_id: item.id,
      canonical_id: item.canonical_id,
      test_type: 'candidate_present',
      inStageBTop5: inTop5,
      response: respPresent,
      chosen_id: presentChosen,
      is_correct: presentChosen === item.canonical_id
    });

    // 3. Test Case B: Truth candidate IS ABSENT from shortlist (model must honestly return "none")
    const candidatesAbsent = [
      { canonicalId: 'rolls-royce-phantom-viii', displayName: 'Rolls-Royce Phantom VIII', distinguishingFeatures: ['Parthenon grille, upright sedan'] },
      { canonicalId: 'toyota-camry-xv70', displayName: 'Toyota Camry (XV70)', distinguishingFeatures: ['Mid-size family sedan'] }
    ];

    const promptAbsent = constrainedVlmAdjudicator.buildComparisonPrompt(candidatesAbsent, item.viewpoint || 'front_3q');
    const respAbsent = await callGeminiRaw('gemini-3.5-flash', promptAbsent, b64);
    totalCostGemini35 += (respAbsent.tokens?.totalTokens || 1200) * (0.15 / 1000000);

    let absentChosen = null;
    if (respAbsent.success) {
      const parsed = constrainedVlmAdjudicator.validateAdjudicationResponse(
        respAbsent.rawText.match(/\{[\s\S]*\}/) ? JSON.parse(respAbsent.rawText.match(/\{[\s\S]*\}/)[0]) : null,
        candidatesAbsent
      );
      absentChosen = parsed.output.chosen_candidate_id;
      gemini35_absentTotal++;
      if (absentChosen === 'none') {
        gemini35_absentAbstained++;
      }
    }

    rawLedger.push({
      item_id: item.id,
      canonical_id: item.canonical_id,
      test_type: 'candidate_absent',
      response: respAbsent,
      chosen_id: absentChosen,
      honest_abstention: absentChosen === 'none'
    });

    if ((i + 1) % 8 === 0) {
      console.log(`Evaluated ${i + 1}/${valItems.length} validation items (Present: ${gemini35_presentCorrect}/${gemini35_presentTotal}, Absent: ${gemini35_absentAbstained}/${gemini35_absentTotal})...`);
    }

    await new Promise(r => setTimeout(r, 150));
  }

  console.log('\n--- Final Empirical Results on Clean Validation Set (N=32) ---');
  console.log(`Stage B Recall @ 5:                      ${truthInStageBCount}/${valItems.length} (${((truthInStageBCount / valItems.length) * 100).toFixed(1)}%)`);
  console.log(`Gemini 3.5 Flash Top-1 (Given Present):   ${gemini35_presentCorrect}/${gemini35_presentTotal} (${((gemini35_presentCorrect / gemini35_presentTotal) * 100).toFixed(1)}%)`);
  console.log(`Gemini 3.5 Flash Honest Abstention (Absent): ${gemini35_absentAbstained}/${gemini35_absentTotal} (${((gemini35_absentAbstained / gemini35_absentTotal) * 100).toFixed(1)}%)`);
  console.log(`Total Live API Spend Added:               $${totalCostGemini35.toFixed(4)} USD`);

  const auditReportData = {
    evaluatedCount: valItems.length,
    stageBRecallAt5: { hits: truthInStageBCount, total: valItems.length },
    gemini35Flash: {
      candidatePresent: { correct: gemini35_presentCorrect, total: gemini35_presentTotal },
      candidateAbsent: { abstained: gemini35_absentAbstained, total: gemini35_absentTotal }
    },
    totalCostUsd: totalCostGemini35,
    timestamp: new Date().toISOString(),
    rawResponsesCount: rawLedger.length,
    rawLedger
  };

  fs.writeFileSync('eval/raw_responses/adjudication_v2_validation_raw.json', JSON.stringify(auditReportData, null, 2), 'utf8');
  console.log('Saved raw response ledger to eval/raw_responses/adjudication_v2_validation_raw.json');

  // Update COST_LOG.md
  const costEntry = `| ${new Date().toISOString().split('T')[0]} | Phase 12A Raw Adjudication Audit | Full In-Catalogue Val (N=32) | ${rawLedger.length} | $${totalCostGemini35.toFixed(4)} | $${totalCostGemini35.toFixed(4)} | $${(0.0135 + totalCostGemini35).toFixed(4)} | Live raw VLM adjudication on present/absent candidate shortlists |\n`;
  fs.appendFileSync('docs/ai/COST_LOG.md', costEntry, 'utf8');
}

runAdjudicationAudit().catch(err => {
  console.error('[runAdjudicationAudit] Error:', err);
  process.exit(1);
});
