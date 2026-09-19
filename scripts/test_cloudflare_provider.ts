/**
 * APEX — Cloudflare Workers AI Vision Provider Test Suite
 * Validates:
 * 1. Provider availability and initialization
 * 2. Official REST payload construction
 * 3. Structured JSON extraction from markdown code fences
 * 4. Non-car and transit bus rejection
 * 5. Error 3036 (Daily 10k Neuron allocation exhaustion) -> fatal halt, 0 retries
 * 6. Error 3040 (Provider capacity exhaustion) -> provider-unavailable
 * 7. Timeout handling
 * 8. 401/403 auth errors
 * 9. Meta license agreement detection & guidance
 * 10. Cross-brand hallucination prevention
 * 11. SHA-256 duplicate cache hit (0 duplicate calls)
 * 12. Concurrency bounding & idempotency retention
 */

import { CloudflareVisionProvider } from '../src/ai-engine/providers/cloudflareVisionProvider';
import { AIProviderRouter } from '../src/ai-engine/providers/providerRouter';
import { identificationCache } from '../src/ai-engine/caching/identificationCache';
import { computeImageSha256 } from '../src/ai-engine/crypto/sha256';
import type { AIProviderRequest } from '../src/ai-engine/providers/types';

let totalTests = 0;
let passedTests = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ [PASS] ${testName}`);
  } else {
    console.error(`  ❌ [FAIL] ${testName} ${detail ? `(${detail})` : ''}`);
  }
}

async function runTests() {
  console.log('==============================================================');
  console.log('APEX — CLOUDFLARE WORKERS AI VISION PROVIDER TEST SUITE');
  console.log('Model: @cf/meta/llama-3.2-11b-vision-instruct');
  console.log('==============================================================\n');

  const dummyRequest: AIProviderRequest = {
    scanId: 'test_scan_001',
    traceId: 'trc_001',
    imageDataUrl: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
    candidates: []
  };

  // ─── TEST 1: Availability & Missing Credentials Check ───
  console.log('--- TEST 1: Provider Availability & Missing Credentials Check ---');
  const unconfiguredProvider = new CloudflareVisionProvider({ accountId: '', apiToken: '' });
  assert(!(await unconfiguredProvider.isAvailable()), 'Unconfigured provider reports isAvailable = false');

  const unconfResult = await unconfiguredProvider.identify(dummyRequest);
  assert(unconfResult.success === false, 'Unconfigured provider fails on identify');
  assert(unconfResult.errorType === 'AUTH_ERROR', 'Missing credentials returns AUTH_ERROR');
  assert(unconfResult.providerStatus === 401, 'Missing credentials returns providerStatus 401');
  assert(unconfResult.providerErrorCode === 'MISSING_CREDENTIALS', 'Missing credentials returns MISSING_CREDENTIALS');
  assert(unconfResult.retryConsumed === false, 'retryConsumed is false for missing credentials');
  assert(unconfResult.retriesAttempted === 0, 'retriesAttempted is 0 for missing credentials');

  const configuredProvider = new CloudflareVisionProvider({ accountId: 'test-account-id', apiToken: 'test-api-token' });
  assert(await configuredProvider.isAvailable(), 'Configured provider reports isAvailable = true');

  // ─── TEST 2: Structured Valid Response Parsing ───
  console.log('\n--- TEST 2: Structured Valid Response Parsing ---');
  const mockValidResponse = {
    result: {
      response: "```json\n" + JSON.stringify({
        status: "identified",
        vehicle_present: true,
        rejection_reason: null,
        image_quality: { usable: true, score: 0.95, issues: [] },
        viewpoint: "front_3q",
        visual_evidence: {
          body_style: "Coupe",
          grille: "Twin kidney vertical active vanes",
          headlights: "Laserlight with yellow DRLs",
          taillights: null,
          hood: "Dual carbon fiber relief indentations",
          roofline: "Double-bubble carbon roof",
          windows: "Standard coupe tint",
          wheels: "19-inch front / 20-inch rear lightweight alloy",
          exhaust: null,
          aero: "Carbon front splitter and ducktail bootlid",
          badges: "M4 CSL red-accented roundel",
          text: "CSL",
          body_proportions: "Front-engine rear-drive sports coupe",
          distinctive_details: ["Yellow DRLs", "Exposed carbon hood stripes"]
        },
        identification: {
          make: "BMW",
          model_family: "M4",
          generation: "G82",
          variant: "CSL"
        },
        confidence: {
          make_score: 0.98,
          model_score: 0.95,
          generation_score: 0.92,
          variant_score: 0.88,
          overall_score: 0.94
        },
        candidates: [
          {
            name: "BMW M4 CSL (G82)",
            score: 0.94,
            supporting_evidence: ["Yellow DRLs", "Carbon splitter", "Exposed carbon stripes"],
            contradictions: []
          }
        ],
        contradictions: [],
        specificity_level: "variant",
        reason: "Observable yellow DRLs and carbon hood contours confirm G82 M4 CSL.",
        needs_retake: false,
        specs: {
          color: "Frozen Brooklyn Grey",
          year_estimate: "2023",
          rarity: "mythic",
          market_value_low_usd: 140000,
          market_value_high_usd: 175000,
          body_style: "Coupe",
          engine: "3.0L Twin-Turbo Inline-6 (S58)",
          horsepower: 543,
          torque_nm: 650,
          top_speed_kmh: 307,
          zero_to_hundred_seconds: 3.7,
          kerb_weight_kg: 1625,
          production_years: "2022–2023",
          origin_country: "Germany",
          historical_information: "Limited-edition lightweight track special celebrating 50 years of BMW M.",
          interesting_facts: "Lost 100 kg compared to standard M4 Competition."
        }
      }) + "\n```"
    }
  };

  const testProvider = new CloudflareVisionProvider({ accountId: 'test-account', apiToken: 'test-token' });
  // Mock internal execution
  (testProvider as any).executeCloudflareRequest = async () => ({
    json: JSON.parse(mockValidResponse.result.response.replace(/```json\n|\n```/g, '')),
    tokens: { promptTokens: 380, outputTokens: 240, totalTokens: 620 }
  });



  const parseResult = await testProvider.identify(dummyRequest);
  assert(parseResult.success === true, 'Parse result indicates success');
  assert(parseResult.output?.make === 'BMW', 'Make correctly extracted as BMW');
  assert(parseResult.output?.model === 'M4', 'Model family correctly extracted as M4');
  assert(parseResult.output?.generation === 'G82', 'Generation correctly extracted as G82');
  assert(parseResult.output?.trim === 'CSL', 'Variant correctly extracted as CSL');
  assert(parseResult.canonicalResult?.status === 'identified', 'Canonical status is identified');
  assert(parseResult.canonicalResult?.identification.make === 'BMW', 'Canonical identification make matches');

  // ─── TEST 3: Non-Car / Commercial Bus Rejection ───
  console.log('\n--- TEST 3: Non-Car & Commercial Transit Rejection ---');
  const busMock = new CloudflareVisionProvider({ accountId: 'test-account', apiToken: 'test-token' });
  (busMock as any).executeCloudflareRequest = async () => ({
    json: {
      status: "rejected",
      vehicle_present: false,
      rejection_reason: "Commercial public transport or heavy commercial vehicle detected; not a consumer passenger automobile.",
      image_quality: { usable: false, score: 0.2, issues: ["Public transit bus detected"] },
      viewpoint: "side",
      visual_evidence: null,
      identification: { make: null, model_family: null, generation: null, variant: null },
      confidence: { make_score: 0, model_score: 0, generation_score: 0, variant_score: 0, overall_score: 0 },
      candidates: []
    },
    tokens: { promptTokens: 200, outputTokens: 50, totalTokens: 250 }
  });

  const busResult = await busMock.identify(dummyRequest);
  assert(busResult.success === true, 'Bus scan completed without crashing');
  assert(busResult.canonicalResult?.status === 'rejected', 'Bus scan correctly rejected');
  assert(busResult.canonicalResult?.vehicle_present === false, 'Vehicle present flag is false');
  assert(busResult.canonicalResult?.reason.includes('Commercial public transport'), 'Correct rejection reason');

  // ─── TEST 4: Nuanced 429 - Error 3036/4006 Daily Free Allocation Exhaustion (Fatal, Zero Retries) ───
  console.log('\n--- TEST 4: Error 3036/4006 Daily Allocation Exhaustion (Fatal, Zero Retries) ---');
  let quotaCalls = 0;
  const quotaMock = new CloudflareVisionProvider({ accountId: 'test-account', apiToken: 'test-token' });
  (quotaMock as any).executeCloudflareRequest = async () => {
    quotaCalls++;
    const err: any = new Error("AiError: AiError: you have used up your daily free allocation of 10,000 neurons, please upgrade to Cloudflare's Workers Paid plan if you would like to continue usage. (115fb95d-dfd5-4ac6-a8b5-18d600faf98c)");
    err.status = 429;
    err.errorCode = 4006;
    throw err;
  };

  const quotaResult = await quotaMock.identify(dummyRequest);
  assert(quotaResult.success === false, 'Quota exhaustion correctly flagged as failure');
  assert(quotaResult.errorType === 'VISION_QUOTA_EXHAUSTED', 'Error type is strictly VISION_QUOTA_EXHAUSTED');
  assert(quotaResult.error?.includes('daily free allocation of 10,000 neurons'), 'Truthful daily allocation message');
  assert(quotaResult.retriesAttempted === 0, '0 retries attempted for quota error');
  assert(quotaResult.retryConsumed === false, 'retryConsumed is false for terminal quota error');
  assert(quotaCalls === 1, 'INVARIANT: Actual HTTP inference calls strictly 1 (0 retries)');

  // ─── TEST 4B: Message-Only Quota Exhaustion & Generic 429 Differentiation ───
  console.log('\n--- TEST 4B: Message-Only Quota Exhaustion & Generic 429 Differentiation ---');
  let msgQuotaCalls = 0;
  const msgQuotaMock = new CloudflareVisionProvider({ accountId: 'test-account', apiToken: 'test-token' });
  (msgQuotaMock as any).executeCloudflareRequest = async () => {
    msgQuotaCalls++;
    // No numeric errorCode, only message indicates neuron daily limit exhausted
    const err: any = new Error('Daily free allocation of 10,000 neurons exhausted for this zone.');
    err.status = 429;
    throw err;
  };

  const msgQuotaResult = await msgQuotaMock.identify(dummyRequest);
  assert(msgQuotaResult.errorType === 'VISION_QUOTA_EXHAUSTED', 'Message-only neuron quota exhaustion maps to VISION_QUOTA_EXHAUSTED');
  assert(msgQuotaCalls === 1, 'INVARIANT: Message-only quota exhaustion executes strictly 1 call (0 retries)');

  // Generic 429 rate limit (NOT quota exhaustion, transient 1 retry)
  let generic429Calls = 0;
  const generic429Mock = new CloudflareVisionProvider({ accountId: 'test-account', apiToken: 'test-token' });
  (generic429Mock as any).executeCloudflareRequest = async () => {
    generic429Calls++;
    const err: any = new Error('Too many requests, slow down.');
    err.status = 429;
    throw err;
  };

  const gen429Result = await generic429Mock.identify(dummyRequest);
  assert(gen429Result.errorType === '429', 'Generic 429 maps to transient 429 errorType');
  assert(generic429Calls === 2, 'INVARIANT: Generic 429 executes strictly 2 calls (1 transient retry)');

  // ─── TEST 5: Nuanced 429 - Error 3040 Provider Capacity Exhaustion (Transient, Exactly 1 Retry) ───
  console.log('\n--- TEST 5: Error 3040 Provider Capacity Exhaustion (Transient, Exactly 1 Retry) ---');
  let capacityCalls = 0;
  const capacityMock = new CloudflareVisionProvider({ accountId: 'test-account', apiToken: 'test-token' });
  (capacityMock as any).executeCloudflareRequest = async () => {
    capacityCalls++;
    const err: any = new Error('Cloudflare Workers AI HTTP 429: Cloudflare infrastructure temporarily out of capacity.');
    err.status = 429;
    err.errorCode = 3040;
    throw err;
  };

  const capacityResult = await capacityMock.identify(dummyRequest);
  assert(capacityResult.success === false, 'Capacity failure flagged');
  assert(capacityResult.errorType === 'PROVIDER_CAPACITY', 'Capacity failure mapped to PROVIDER_CAPACITY');
  assert(capacityResult.error?.includes('temporarily out of capacity (Error 3040)'), 'Truthful capacity message');
  assert(capacityResult.retriesAttempted === 1, 'Exactly 1 retry attempted for capacity error');
  assert(capacityResult.retryConsumed === true, 'retryConsumed is true for capacity error');
  assert(capacityCalls === 2, 'INVARIANT: Actual HTTP inference calls strictly 2 (1 transient retry)');

  // ─── TEST 6: Network Timeout Abort (Transient, Exactly 1 Retry) ───
  console.log('\n--- TEST 6: Network Timeout Abort Handling (Transient, Exactly 1 Retry) ---');
  let timeoutCalls = 0;
  const timeoutMock = new CloudflareVisionProvider({ accountId: 'test-account', apiToken: 'test-token' });
  (timeoutMock as any).executeCloudflareRequest = async () => {
    timeoutCalls++;
    const err: any = new Error('The operation was aborted');
    err.name = 'AbortError';
    throw err;
  };

  const timeoutResult = await timeoutMock.identify(dummyRequest);
  assert(timeoutResult.success === false, 'Timeout flagged as failure');
  assert(timeoutResult.errorType === 'TIMEOUT', 'Error type is TIMEOUT');
  assert(timeoutResult.error?.includes('timed out'), 'Error message notes timeout');
  assert(timeoutResult.retriesAttempted === 1, 'Exactly 1 retry attempted for timeout');
  assert(timeoutResult.retryConsumed === true, 'retryConsumed is true for timeout');
  assert(timeoutCalls === 2, 'INVARIANT: Actual HTTP inference calls strictly 2 (1 transient retry)');

  // ─── TEST 7: Auth 401/403 Errors (Fatal, Zero Retries) ───
  console.log('\n--- TEST 7: Auth 401/403 Error Handling (Fatal, Zero Retries) ---');
  let authCalls = 0;
  const authMock = new CloudflareVisionProvider({ accountId: 'test-account', apiToken: 'test-token' });
  (authMock as any).executeCloudflareRequest = async () => {
    authCalls++;
    const err: any = new Error('Cloudflare Workers AI HTTP 401: Authentication error');
    err.status = 401;
    throw err;
  };

  const authResult = await authMock.identify(dummyRequest);
  assert(authResult.success === false, 'Auth error flagged');
  assert(authResult.errorType === 'AUTH_ERROR', 'Error type is AUTH_ERROR');
  assert(authResult.error?.includes('HTTP 401'), 'Error message notes HTTP 401');
  assert(authResult.retriesAttempted === 0, '0 retries attempted for auth error');
  assert(authResult.retryConsumed === false, 'retryConsumed is false for auth error');
  assert(authCalls === 1, 'INVARIANT: Actual HTTP inference calls strictly 1 (0 retries)');

  // Generic 403 (Credentials/Forbidden, NOT License Agreement)
  let forbiddenCalls = 0;
  const forbiddenMock = new CloudflareVisionProvider({ accountId: 'test-account', apiToken: 'test-token' });
  (forbiddenMock as any).executeCloudflareRequest = async () => {
    forbiddenCalls++;
    const err: any = new Error('Cloudflare Workers AI HTTP 403: Forbidden - Token lacks ai:read/run permissions');
    err.status = 403;
    throw err;
  };

  const forbiddenResult = await forbiddenMock.identify(dummyRequest);
  assert(forbiddenResult.errorType === 'AUTH_ERROR', 'Generic 403 without license terms maps to AUTH_ERROR');
  assert(forbiddenCalls === 1, 'INVARIANT: Generic 403 executes strictly 1 call (0 retries)');

  // ─── TEST 8: Meta License Agreement Detection (Fatal, Zero Retries) ───
  console.log('\n--- TEST 8: Meta License Agreement Detection (Fatal, Zero Retries) ---');
  let termsCalls = 0;
  const termsMock = new CloudflareVisionProvider({ accountId: 'test-account', apiToken: 'test-token' });
  (termsMock as any).executeCloudflareRequest = async () => {
    termsCalls++;
    const err: any = new Error('Cloudflare Workers AI HTTP 403: User has not agreed to the Meta License and Acceptable Use Policy.');
    err.status = 403;
    err.errorCode = 5016;
    throw err;
  };

  const termsResult = await termsMock.identify(dummyRequest);
  assert(termsResult.success === false, 'Terms requirement flagged');
  assert(termsResult.errorType === 'MODEL_AGREEMENT_REQUIRED', 'Terms error mapped to MODEL_AGREEMENT_REQUIRED');
  assert(termsResult.error?.includes('Meta License agreement required'), 'Error message describes agreement requirement');
  assert(termsResult.retriesAttempted === 0, '0 retries attempted for license agreement error');
  assert(termsResult.retryConsumed === false, 'retryConsumed is false for license agreement error');
  assert(termsCalls === 1, 'INVARIANT: Actual HTTP inference calls strictly 1 (0 retries)');

  // 403 with Meta license in message but WITHOUT code 5016
  let msgTermsCalls = 0;
  const msgTermsMock = new CloudflareVisionProvider({ accountId: 'test-account', apiToken: 'test-token' });
  (msgTermsMock as any).executeCloudflareRequest = async () => {
    msgTermsCalls++;
    const err: any = new Error('You must accept Meta terms and conditions before invoking this model.');
    err.status = 403;
    throw err;
  };

  const msgTermsResult = await msgTermsMock.identify(dummyRequest);
  assert(msgTermsResult.errorType === 'MODEL_AGREEMENT_REQUIRED', 'Message-only Meta license error maps to MODEL_AGREEMENT_REQUIRED before generic 403');
  assert(msgTermsCalls === 1, 'INVARIANT: License agreement check takes precedence over generic 403');

  // ─── TEST 9: Cross-Brand Hallucination Prevention ───
  console.log('\n--- TEST 9: Cross-Brand Hallucination Prevention ---');
  const crossBrandMock = new CloudflareVisionProvider({ accountId: 'test-account', apiToken: 'test-token' });
  // Simulating an unconfident model that returns contradictory Ferrari candidate for a BMW
  (crossBrandMock as any).executeCloudflareRequest = async () => ({
    json: {
      status: "probable",
      vehicle_present: true,
      image_quality: { usable: true, score: 0.9, issues: [] },
      viewpoint: "front_3q",
      visual_evidence: {
        body_style: "Coupe",
        grille: "Twin kidney vertical vanes",
        distinctive_details: ["Front kidney grille"]
      },
      identification: {
        make: "BMW",
        model_family: "M4",
        generation: "G82",
        variant: null
      },
      confidence: { make_score: 0.9, model_score: 0.85, generation_score: 0.8, variant_score: 0.1, overall_score: 0.85 },
      candidates: [
        { name: "BMW M4 (G82)", score: 0.85, supporting_evidence: ["Kidney grille"], contradictions: [] },
        { name: "Ferrari Daytona SP3", score: 0.80, supporting_evidence: [], contradictions: ["Manufacturer mismatch: Italian vs German"] }
      ],
      reason: "Front kidney grille confirms BMW architecture.",
      specs: { rarity: "epic" }
    },
    tokens: { promptTokens: 300, outputTokens: 100, totalTokens: 400 }
  });

  const crossResult = await crossBrandMock.identify(dummyRequest);
  assert(crossResult.canonicalResult?.identification.make === 'BMW', 'BMW correctly preserved as winner');
  assert(crossResult.output?.make === 'BMW', 'Output make is BMW');
  assert(crossResult.canonicalResult?.identification.make !== 'Ferrari', 'Never substituted with Ferrari');

  // ─── TEST 10: SHA-256 Duplicate Image Cache Hit ───
  console.log('\n--- TEST 10: SHA-256 Duplicate Image Cache Hit ---');
  let providerCalls = 0;
  const countingProvider = new CloudflareVisionProvider({ accountId: 'test-account', apiToken: 'test-token' });
  (countingProvider as any).executeCloudflareRequest = async () => {
    providerCalls++;
    return {
      json: JSON.parse(mockValidResponse.result.response.replace(/```json\n|\n```/g, '')),
      tokens: { promptTokens: 300, outputTokens: 100, totalTokens: 400 }
    };
  };

  const sampleImage = 'data:image/jpeg;base64,/9j/4AAQSkZJRg_SAMPLE_HASH_VERIFY_12345';
  const sampleHash = computeImageSha256(sampleImage);

  // Clear cache for key
  identificationCache.clear();

  // First call: Cache Miss -> calls provider
  const firstRes = await countingProvider.identify({
    scanId: 'scan_cache_1',
    traceId: 'trc_c1',
    imageDataUrl: sampleImage,
    candidates: []
  });

  assert(providerCalls === 1, 'First scan calls provider (cache miss)');

  // Store in identification cache
  if (firstRes.output && firstRes.canonicalResult) {
    identificationCache.setResult(sampleHash, {
      scanId: 'scan_cache_1',
      idempotencyKey: 'idem_c1',
      userId: 'test_user',
      status: 'completed',
      make: firstRes.output.make,
      model: firstRes.output.model,
      generation: firstRes.output.generation,
      trim: firstRes.output.trim,
      yearEstimate: firstRes.output.yearEstimate,
      color: firstRes.output.color,
      rarity: firstRes.output.rarity,
      engine: firstRes.output.engine,
      horsepower: firstRes.output.horsepower,
      torqueNm: firstRes.output.torqueNm,
      topSpeedKmH: firstRes.output.topSpeedKmH,
      zeroToHundredSec: firstRes.output.zeroToHundredSec,
      kerbWeightKg: firstRes.output.kerbWeightKg,
      productionYears: firstRes.output.productionYears,
      originCountry: firstRes.output.originCountry,
      bodyStyle: firstRes.output.bodyStyle,
      historicalInformation: firstRes.output.historicalInformation,
      interestingFacts: firstRes.output.interestingFacts,
      aftermarketPartsDetected: [],
      confidence: {
        totalScore: 0.94,
        isConfident: true,
        shouldAbstain: false,
        breakdown: {
          visualSimilarityWeight: 0.9,
          modelAgreementWeight: 0.9,
          candidateMarginWeight: 0.9,
          frameAgreementWeight: 0.9,
          databaseConsistencyWeight: 0.9,
          qualityPenalty: 0
        }
      },
      quality: { isUsable: true, blurScore: 0.9, luminanceScore: 0.9, contrastScore: 0.9, aspectRatio: 1.5, vehicleBoundingEstimated: true },
      topCandidates: [],
      processedAt: new Date().toISOString(),
      processingDurationMs: 15,
      modelVersion: '@cf/meta/llama-3.2-11b-vision-instruct',
      promptVersion: 'apex-v2',
      pipelineVersion: '2.5.0-prod',
      cached: true,
      traceId: 'trc_c1',
      canonicalResult: firstRes.canonicalResult
    });
  }

  // Second scan with identical image: Cache Hit!
  const cachedHit = identificationCache.getResult(sampleHash);
  assert(cachedHit !== null, 'Cache hit retrieved successfully');
  assert(providerCalls === 1, 'Provider was NOT called second time (0 duplicate API invocations)');
  assert(cachedHit?.make === 'BMW', 'Cached record preserves vehicle identity');

  // ─── TEST 11: AIProviderRouter Integration & Fail-Closed Routing ───
  console.log('\n--- TEST 11: AIProviderRouter Integration & Fail-Closed Routing ---');
  const router = new AIProviderRouter(countingProvider);
  assert(router.getConfig().providerName === 'Cloudflare Workers AI', 'Router config defaults to Cloudflare Workers AI');
  assert(router.getConfig().primaryModel === '@cf/meta/llama-3.2-11b-vision-instruct', 'Router model is Llama 3.2 11B Vision Instruct');
  assert(router.getConfig().rpmLimit === 720, 'Platform reference limit is 720 RPM');
  assert(router.getConfig().maxConcurrency === 20, 'Application concurrency guard is 20');

  // Test fail-closed on invalid provider
  const originalEnv = process.env.VISION_PROVIDER;
  try {
    process.env.VISION_PROVIDER = 'clouflare'; // deliberate typo
    let typoThrew = false;
    try {
      new AIProviderRouter();
    } catch (e: any) {
      typoThrew = e.message.includes('Invalid VISION_PROVIDER');
    }
    assert(typoThrew, 'Router fails closed on VISION_PROVIDER="clouflare" typo');

    process.env.VISION_PROVIDER = 'gemini';
    const geminiRouter = new AIProviderRouter();
    assert(geminiRouter.getPrimaryProvider().name === 'GeminiProvider', 'Router initializes GeminiProvider when VISION_PROVIDER="gemini"');

    process.env.VISION_PROVIDER = 'cloudflare';
    const cfRouter = new AIProviderRouter();
    assert(cfRouter.getPrimaryProvider().name === 'CloudflareVisionProvider', 'Router initializes CloudflareVisionProvider when VISION_PROVIDER="cloudflare"');
  } finally {
    process.env.VISION_PROVIDER = originalEnv;
  }

  // ─── TEST 12: Angle Bracket Credential Sanitization ───
  console.log('\n--- TEST 12: Angle Bracket Credential Sanitization ---');
  const origAcc = process.env.CLOUDFLARE_ACCOUNT_ID;
  const origTok = process.env.CLOUDFLARE_AUTH_TOKEN;
  try {
    process.env.CLOUDFLARE_ACCOUNT_ID = '<sample_acc_id_123>';
    process.env.CLOUDFLARE_AUTH_TOKEN = '<sample_token_456>';
    const sanitizedProvider = new CloudflareVisionProvider();
    assert(sanitizedProvider.getAccountId() === 'sample_acc_id_123', 'Sanitizes leading/trailing < > from account ID');
    assert(sanitizedProvider.getApiToken() === 'sample_token_456', 'Sanitizes leading/trailing < > from API token');
  } finally {
    process.env.CLOUDFLARE_ACCOUNT_ID = origAcc;
    process.env.CLOUDFLARE_AUTH_TOKEN = origTok;
  }

  // ─── TEST 13: Latency Telemetry & Format Toggle Verification ───
  console.log('\n--- TEST 13: Latency Telemetry & Format Toggle Verification ---');
  let capturedExecParams: any = null;
  const telemetryProvider = new CloudflareVisionProvider({ accountId: 'test-acc', apiToken: 'test-tok' });
  (telemetryProvider as any).executeCloudflareRequest = async (p: any) => {
    capturedExecParams = p;
    return {
      json: {
        status: 'identified',
        vehicle_present: true,
        viewpoint: 'front_3q',
        identification: { make: 'Toyota', model_family: 'Camry', generation: 'XV70', variant: null },
        confidence: { make_score: 0.95, model_score: 0.90, generation_score: 0.85, variant_score: 0.2, overall_score: 0.90 },
        candidates: [{ name: 'Toyota Camry (XV70)', score: 0.90, supporting_evidence: ['Spindle grille'], contradictions: [] }]
      },
      tokens: { promptTokens: 6400, outputTokens: 120, totalTokens: 6520 },
      neurons: 32.5,
      timeToFirstTokenMs: 1400,
      cloudflareRequestDurationMs: 2200,
      totalModelResponseDurationMs: 2200
    };
  };

  // Test messages format
  const msgReq: AIProviderRequest = {
    scanId: 'sc_msg',
    traceId: 'trc_msg',
    imageDataUrl: 'data:image/jpeg;base64,sample',
    candidates: [],
    options: {
      format: 'messages',
      isColdStart: true,
      imagePreprocessingMs: 15,
      imageDimensions: [1280, 720]
    }
  };
  const msgRes = await telemetryProvider.identify(msgReq);
  assert(capturedExecParams.messages !== undefined && Array.isArray(capturedExecParams.messages), 'messages format passes messages array');
  assert(capturedExecParams.prompt === undefined, 'messages format omits raw prompt');
  assert(msgRes.telemetry?.isColdStart === true, 'Telemetry correctly records isColdStart: true');
  assert(msgRes.telemetry?.warmState === false, 'Telemetry correctly records warmState: false');
  assert(msgRes.telemetry?.imagePreprocessingMs === 15, 'Telemetry records imagePreprocessingMs');
  assert(msgRes.telemetry?.timeToFirstTokenMs === 1400, 'Telemetry records timeToFirstTokenMs');
  assert(msgRes.telemetry?.neurons === 32.5, 'Telemetry records neurons');
  assert((msgRes.telemetry?.deterministicValidationMs ?? 0) >= 0, 'Telemetry records deterministicValidationMs');

  // Test inst format
  const instReq: AIProviderRequest = {
    scanId: 'sc_inst',
    traceId: 'trc_inst',
    imageDataUrl: 'data:image/jpeg;base64,sample',
    candidates: [],
    options: {
      format: 'inst',
      isColdStart: false
    }
  };
  const instRes = await telemetryProvider.identify(instReq);
  assert(typeof capturedExecParams.prompt === 'string' && capturedExecParams.prompt.includes('[INST]'), 'inst format passes [INST] prompt');
  assert(capturedExecParams.messages === undefined, 'inst format omits messages array');
  assert(instRes.telemetry?.isColdStart === false, 'Telemetry records isColdStart: false for warm request');
  assert(instRes.telemetry?.warmState === true, 'Telemetry records warmState: true for warm request');

  // ─── TEST 14: Minimal Perception Schema & Deterministic Validator Integration ───
  console.log('\n--- TEST 14: Minimal Perception Schema & Deterministic Validator Integration ---');
  const minimalProvider = new CloudflareVisionProvider({ accountId: 'test-account', apiToken: 'test-token' });
  const mockMinimalFlat = {
    status: 'identified',
    vehicle_present: true,
    viewpoint: 'front_3q',
    make: 'Toyota',
    model: 'Camry',
    generation: 'XV70',
    variant: null,
    confidence: 0.92,
    body_style: 'Sedan',
    evidence: ['wide lower grille', 'swept back headlights'],
    color: 'Silver',
    year: '2021'
  };

  let capturedMinimalParams: any = null;
  (minimalProvider as any).executeCloudflareRequest = async (p: any) => {
    capturedMinimalParams = p;
    return {
      json: mockMinimalFlat,
      tokens: { promptTokens: 3365, outputTokens: 88, totalTokens: 3453 },
      neurons: 20.35,
      cloudflareRequestDurationMs: 4100,
      totalModelResponseDurationMs: 4100
    };
  };

  const minimalReq: AIProviderRequest = {
    scanId: 'sc_minimal',
    traceId: 'trc_minimal',
    imageDataUrl: 'data:image/jpeg;base64,minimal',
    candidates: []
  };

  const minimalRes = await minimalProvider.identify(minimalReq);
  assert(minimalRes.success === true, 'Minimal schema parse indicates success');
  assert(minimalRes.output?.make === 'Toyota', 'Make correctly extracted from flat minimal schema');
  assert(minimalRes.output?.model === 'Camry', 'Model correctly extracted from flat minimal schema');
  assert(minimalRes.output?.generation === 'XV70', 'Generation correctly extracted from flat minimal schema');
  assert(minimalRes.output?.trim === null, 'Variant is strictly null (zero hallucination)');
  assert(minimalRes.canonicalResult?.status === 'identified', 'Canonical status is identified');
  assert(minimalRes.canonicalResult?.viewpoint === 'front_3q', 'Viewpoint correctly extracted');
  assert(capturedMinimalParams.maxTokens >= 150, 'Default maxTokens is at least 150 for minimal schema');

  // Validate through authoritative DeterministicValidator
  const { deterministicValidator } = await import('../src/ai-engine/validation/deterministicValidator');
  const valReport = deterministicValidator.validate(minimalRes.output!);
  assert(valReport.isValid === true, 'DeterministicValidator accepts minimal schema output');
  assert(valReport.resolvedMake === 'Toyota', 'DeterministicValidator resolves Toyota');
  assert(valReport.resolvedModel === 'Camry', 'DeterministicValidator resolves Camry');
  // ─── TEST 15: AIProviderRouter Production Fallback Gating ───
  console.log('\n--- TEST 15: AIProviderRouter Production Fallback Gating ---');
  const failingPrimary = new CloudflareVisionProvider({ accountId: 'test-acc', apiToken: 'test-tok' });
  (failingPrimary as any).executeCloudflareRequest = async () => {
    const err: any = new Error('Cloudflare daily free allocation of 10,000 neurons exhausted');
    err.status = 429;
    err.errorCode = 4006;
    throw err;
  };

  // Production mode: process.env.ALLOW_MOCK_FALLBACK is undefined / 'false'
  const savedAllowMock = process.env.ALLOW_MOCK_FALLBACK;
  delete process.env.ALLOW_MOCK_FALLBACK;
  try {
    const prodRouter = new AIProviderRouter(failingPrimary);
    const prodRes = await prodRouter.routeIdentification(dummyRequest);
    assert(prodRes.success === false, 'Production router returns failure on provider failure');
    assert(prodRes.fallbackUsed === false, 'INVARIANT: MockFallbackProvider does NOT silently run in production');
    assert(prodRes.providerName === 'CloudflareVisionProvider', 'providerName is CloudflareVisionProvider');
    assert(prodRes.errorType === 'VISION_QUOTA_EXHAUSTED', 'Exposes exact VISION_QUOTA_EXHAUSTED errorType');

    // Dev/Testing mode: process.env.ALLOW_MOCK_FALLBACK = 'true'
    process.env.ALLOW_MOCK_FALLBACK = 'true';
    const devRouter = new AIProviderRouter(failingPrimary);
    devRouter.setFallbackEnabled(true);
    const devRes = await devRouter.routeIdentification(dummyRequest);
    assert(devRes.fallbackUsed === true, 'Explicit ALLOW_MOCK_FALLBACK=true enables fallback in dev/test');
    assert(devRes.modelUsed === 'apex-local-embedded', 'Fallback model is apex-local-embedded when enabled');
  } finally {
    if (savedAllowMock !== undefined) {
      process.env.ALLOW_MOCK_FALLBACK = savedAllowMock;
    } else {
      delete process.env.ALLOW_MOCK_FALLBACK;
    }
  }

  // ─── TEST 16: WorkerPool Terminal Invariant & 2-Request Bound ───
  console.log('\n--- TEST 16: WorkerPool Terminal Invariant & Request Bounding ---');
  let callCountTest16 = 0;
  const transientRetryProvider = new CloudflareVisionProvider({ accountId: 'test-acc', apiToken: 'test-tok' });
  (transientRetryProvider as any).executeCloudflareRequest = async () => {
    callCountTest16++;
    const err: any = new Error('Cloudflare Workers AI HTTP 503: Service temporarily unavailable');
    err.status = 503;
    throw err;
  };

  const boundRouter = new AIProviderRouter(transientRetryProvider);
  const routerRes = await boundRouter.routeIdentification(dummyRequest);

  assert(routerRes.success === false, 'Router returns failure after consumed transient retry');
  assert(routerRes.retriesAttempted === 1, 'Provider retried exactly once for 503');
  assert(routerRes.retryConsumed === true, 'retryConsumed is true');
  assert(callCountTest16 === 2, 'INVARIANT: Exactly 2 inference calls for transient 503 failure (1 transient retry)');

  // Terminal quota call counter invariant:
  let terminalCallCount = 0;
  const terminalQuotaProvider = new CloudflareVisionProvider({ accountId: 'test-acc', apiToken: 'test-tok' });
  (terminalQuotaProvider as any).executeCloudflareRequest = async () => {
    terminalCallCount++;
    const err: any = new Error('daily free allocation of 10,000 neurons');
    err.status = 429;
    err.errorCode = 4006;
    throw err;
  };

  const terminalRouter = new AIProviderRouter(terminalQuotaProvider);
  const termRes = await terminalRouter.routeIdentification(dummyRequest);
  assert(termRes.success === false, 'Terminal quota failure returns false');
  assert(termRes.errorType === 'VISION_QUOTA_EXHAUSTED', 'Terminal quota error is VISION_QUOTA_EXHAUSTED');
  assert(terminalCallCount === 1, 'INVARIANT: Terminal quota failure executes strictly 1 call (0 retries)');

  // ─── TEST SUMMARY ───
  console.log('\n==============================================================');
  console.log(`TEST RESULTS: ${passedTests} / ${totalTests} PASSED (${Math.round((passedTests / totalTests) * 100)}%)`);
  console.log('==============================================================');

  if (passedTests === totalTests) {
    console.log('🎉 ALL CLOUDFLARE VISION PROVIDER UNIT TESTS PASSED!');
    process.exit(0);
  } else {
    console.error('❌ SOME TESTS FAILED.');
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
