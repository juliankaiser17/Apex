import fs from 'fs';

function wilsonScoreInterval(successes: number, total: number, confidence = 0.95): [number, number] {
  if (total === 0) return [0, 0];
  const z = 1.95996; // 95% confidence
  const p = successes / total;
  const denominator = 1 + (z * z) / total;
  const centreAdjustedProbability = p + (z * z) / (2 * total);
  const adjustedStandardDeviation = Math.sqrt((p * (1 - p) + (z * z) / (4 * total)) / total);

  const lowerBound = (centreAdjustedProbability - z * adjustedStandardDeviation) / denominator;
  const upperBound = (centreAdjustedProbability + z * adjustedStandardDeviation) / denominator;

  return [
    Math.max(0, Number(lowerBound.toFixed(4))),
    Math.min(1, Number(upperBound.toFixed(4)))
  ];
}

interface PredRecord {
  sampleId: string;
  population: 'in_catalogue' | 'out_of_catalogue' | 'non_vehicle';
  model: string;
  trueMake: string | null;
  trueModel: string | null;
  trueVariant: string | null;
  predMake: string | null;
  predModel: string | null;
  predVariant: string | null;
  predCanonicalId: string | null;
  predStatus: string;
  predConfidence: number;
  isAnswered: boolean;
  isMakeMatch: boolean;
  isModelMatch: boolean;
  isGenerationMatch: boolean;
  isVariantMatch: boolean;
  isWrongConfident: boolean;
  isNeedsMoreViews: boolean;
  isCorrectRejection: boolean;
  isFalseAccept: boolean;
  latencyMs: number;
  costUsd: number;
}

function evaluatePolicy(policyName: string, predictions: PredRecord[]) {
  const inc = predictions.filter(p => p.population === 'in_catalogue');
  const out = predictions.filter(p => p.population !== 'in_catalogue');

  const N_inc = inc.length;
  const N_out = out.length;

  const answered = inc.filter(p => p.isAnswered);
  const answerRate = answered.length / N_inc;
  const answerRateCi = wilsonScoreInterval(answered.length, N_inc);

  const modelMatches = answered.filter(p => p.isModelMatch);
  const modelAcc = answered.length ? modelMatches.length / answered.length : 0;
  const modelAccCi = wilsonScoreInterval(modelMatches.length, answered.length);

  const makeMatches = answered.filter(p => p.isMakeMatch);
  const makeAcc = answered.length ? makeMatches.length / answered.length : 0;
  const makeAccCi = wilsonScoreInterval(makeMatches.length, answered.length);

  // Variant accuracy: among answered items that have a true variant and model matched
  const answeredWithTrueVar = answered.filter(p => Boolean(p.trueVariant));
  const variantMatches = answeredWithTrueVar.filter(p => p.isVariantMatch);
  const variantAcc = answeredWithTrueVar.length ? variantMatches.length / answeredWithTrueVar.length : 0;
  const variantAccCi = wilsonScoreInterval(variantMatches.length, answeredWithTrueVar.length);

  // 1. Wrong-but-confident at MODEL level:
  // Model answered, predConfidence >= 0.80, but isModelMatch is false
  const wrongModelConfident = inc.filter(p => p.isAnswered && p.predConfidence >= 0.80 && !p.isModelMatch);
  const wrongModelConfidentRate = wrongModelConfident.length / N_inc;
  const wrongModelConfidentCi = wilsonScoreInterval(wrongModelConfident.length, N_inc);

  // 2. Wrong-but-confident at VARIANT level:
  // Variant asserted (predVariant truthy), predConfidence >= 0.80, but isVariantMatch is false
  const assertedVariant = inc.filter(p => p.isAnswered && Boolean(p.predVariant) && Boolean(p.trueVariant));
  const wrongVariantConfident = assertedVariant.filter(p => p.predConfidence >= 0.80 && !p.isVariantMatch);
  const wrongVariantConfidentRate = assertedVariant.length ? wrongVariantConfident.length / assertedVariant.length : 0;
  const wrongVariantConfidentRateOverall = wrongVariantConfident.length / N_inc;
  const wrongVariantConfidentCi = wilsonScoreInterval(wrongVariantConfident.length, N_inc);

  // 3. Wrong-but-confident at the FINEST LEVEL asserted by the app:
  // If variant asserted: is variant wrong? If only model family asserted: is model wrong?
  const wrongFinestConfident = inc.filter(p => {
    if (!p.isAnswered || p.predConfidence < 0.80) return false;
    if (p.predVariant && p.trueVariant) {
      return !p.isVariantMatch;
    }
    return !p.isModelMatch;
  });
  const wrongFinestConfidentRate = wrongFinestConfident.length / N_inc;
  const wrongFinestConfidentCi = wilsonScoreInterval(wrongFinestConfident.length, N_inc);

  // Out of catalogue:
  const correctRejections = out.filter(p => p.isCorrectRejection);
  const correctRejectionRate = correctRejections.length / N_out;
  const correctRejectionCi = wilsonScoreInterval(correctRejections.length, N_out);

  const falseAccepts = out.filter(p => p.isFalseAccept);
  const falseAcceptRate = falseAccepts.length / N_out;
  const falseAcceptCi = wilsonScoreInterval(falseAccepts.length, N_out);

  return {
    policyName,
    inCatalogue: {
      N: N_inc,
      answeredCount: answered.length,
      answerRate: { rate: answerRate, count: answered.length, ci95: answerRateCi },
      makeAccuracy: { rate: makeAcc, count: makeMatches.length, ci95: makeAccCi },
      modelAccuracy: { rate: modelAcc, count: modelMatches.length, ci95: modelAccCi },
      variantAccuracy: { rate: variantAcc, count: variantMatches.length, N_var: answeredWithTrueVar.length, ci95: variantAccCi },
      wrongModelConfident: { rate: wrongModelConfidentRate, count: wrongModelConfident.length, ci95: wrongModelConfidentCi },
      wrongVariantConfident: { rate: wrongVariantConfidentRateOverall, count: wrongVariantConfident.length, ci95: wrongVariantConfidentCi },
      wrongFinestConfident: { rate: wrongFinestConfidentRate, count: wrongFinestConfident.length, ci95: wrongFinestConfidentCi }
    },
    outOfCatalogue: {
      N: N_out,
      correctRejectionRate: { rate: correctRejectionRate, count: correctRejections.length, ci95: correctRejectionCi },
      falseAcceptRate: { rate: falseAcceptRate, count: falseAccepts.length, upper95: falseAcceptCi[1] }
    }
  };
}

function main() {
  const rawPreds: PredRecord[] = JSON.parse(fs.readFileSync('eval/beta_val_predictions.json', 'utf8'));

  const p31Map = new Map<string, PredRecord>();
  const p35Map = new Map<string, PredRecord>();

  for (const p of rawPreds) {
    if (p.model === 'gemini-3.1-flash-lite') p31Map.set(p.sampleId, p);
    if (p.model === 'gemini-3.5-flash-lite') p35Map.set(p.sampleId, p);
  }

  // Build combined policy: 3.5-flash-lite first; if abstained -> 3.1-flash-lite
  const combinedPreds: PredRecord[] = [];
  const sampleIds = Array.from(p35Map.keys());

  let escalatedCount = 0;
  for (const id of sampleIds) {
    const r35 = p35Map.get(id)!;
    const r31 = p31Map.get(id)!;

    // Policy condition: 3.5-flash-lite answers if identified or identified_model
    if (r35.isAnswered) {
      combinedPreds.push({
        ...r35,
        model: 'combined (3.5-first -> 3.1 fallback)'
      });
    } else {
      escalatedCount++;
      // Fallback to 3.1-flash-lite
      combinedPreds.push({
        ...r31,
        model: 'combined (3.5-first -> 3.1 fallback)'
      });
    }
  }

  const eval31 = evaluatePolicy('gemini-3.1-flash-lite', Array.from(p31Map.values()));
  const eval35 = evaluatePolicy('gemini-3.5-flash-lite', Array.from(p35Map.values()));
  const evalCombined = evaluatePolicy('combined-policy (3.5-first -> 3.1 fallback) [SELECTED ON VALIDATION DATA]', combinedPreds);

  console.log('========================================================================');
  console.log('OFFLINE EVALUATION OF COMBINED POLICY ON VALIDATION DATA (N=245)');
  console.log('========================================================================\n');

  console.log(`Total Samples: ${sampleIds.length}`);
  console.log(`Cases where 3.5 answered directly: ${sampleIds.length - escalatedCount}`);
  console.log(`Cases where 3.5 abstained and 3.1 was invoked: ${escalatedCount} (${((escalatedCount / sampleIds.length) * 100).toFixed(1)}%)\n`);

  const printReport = (report: any) => {
    console.log(`--- [${report.policyName}] ---`);
    console.log(`  In-Catalogue (N=${report.inCatalogue.N}):`);
    console.log(`    Answer Rate: ${(report.inCatalogue.answerRate.rate * 100).toFixed(1)}% (${report.inCatalogue.answerRate.count}/${report.inCatalogue.N}) [95% CI: ${(report.inCatalogue.answerRate.ci95[0]*100).toFixed(1)}% - ${(report.inCatalogue.answerRate.ci95[1]*100).toFixed(1)}%]`);
    console.log(`    Model Accuracy (Answered): ${(report.inCatalogue.modelAccuracy.rate * 100).toFixed(1)}% (${report.inCatalogue.modelAccuracy.count}/${report.inCatalogue.answeredCount}) [95% CI: ${(report.inCatalogue.modelAccuracy.ci95[0]*100).toFixed(1)}% - ${(report.inCatalogue.modelAccuracy.ci95[1]*100).toFixed(1)}%]`);
    console.log(`    Variant Accuracy (Answered): ${(report.inCatalogue.variantAccuracy.rate * 100).toFixed(1)}% (${report.inCatalogue.variantAccuracy.count}/${report.inCatalogue.variantAccuracy.N_var}) [95% CI: ${(report.inCatalogue.variantAccuracy.ci95[0]*100).toFixed(1)}% - ${(report.inCatalogue.variantAccuracy.ci95[1]*100).toFixed(1)}%]`);
    console.log(`    Wrong-but-Confident (Model level): ${(report.inCatalogue.wrongModelConfident.rate * 100).toFixed(1)}% (${report.inCatalogue.wrongModelConfident.count}/${report.inCatalogue.N}) [95% CI: ${(report.inCatalogue.wrongModelConfident.ci95[0]*100).toFixed(1)}% - ${(report.inCatalogue.wrongModelConfident.ci95[1]*100).toFixed(1)}%]`);
    console.log(`    Wrong-but-Confident (Variant level): ${(report.inCatalogue.wrongVariantConfident.rate * 100).toFixed(1)}% (${report.inCatalogue.wrongVariantConfident.count}/${report.inCatalogue.N}) [95% CI: ${(report.inCatalogue.wrongVariantConfident.ci95[0]*100).toFixed(1)}% - ${(report.inCatalogue.wrongVariantConfident.ci95[1]*100).toFixed(1)}%]`);
    console.log(`    Wrong-but-Confident (Finest level asserted): ${(report.inCatalogue.wrongFinestConfident.rate * 100).toFixed(1)}% (${report.inCatalogue.wrongFinestConfident.count}/${report.inCatalogue.N}) [95% CI: ${(report.inCatalogue.wrongFinestConfident.ci95[0]*100).toFixed(1)}% - ${(report.inCatalogue.wrongFinestConfident.ci95[1]*100).toFixed(1)}%]`);
    console.log(`  Out-of-Catalogue (N=${report.outOfCatalogue.N}):`);
    console.log(`    Correct Rejection: ${(report.outOfCatalogue.correctRejectionRate.rate * 100).toFixed(1)}% (${report.outOfCatalogue.correctRejectionRate.count}/${report.outOfCatalogue.N})`);
    console.log(`    False Accept: ${(report.outOfCatalogue.falseAcceptRate.rate * 100).toFixed(1)}% (${report.outOfCatalogue.falseAcceptRate.count}/${report.outOfCatalogue.N}) [Wilson 95% Upper Bound: ${(report.outOfCatalogue.falseAcceptRate.upper95 * 100).toFixed(1)}%]`);
    console.log();
  };

  printReport(eval31);
  printReport(eval35);
  printReport(evalCombined);

  fs.writeFileSync('eval/combined_policy_metrics.json', JSON.stringify({
    eval31,
    eval35,
    evalCombined,
    timestamp: new Date().toISOString()
  }, null, 2));
}

main();
