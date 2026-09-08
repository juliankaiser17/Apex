/**
 * APEX — Capacity Planning & Load Test Simulation Model
 * Computes queue absorption, required worker fleet scaling, token burn rates,
 * and cost forecasting for traffic surges up to 1,000,000 users.
 */

export interface CapacityPlanModel {
  simulatedUserCount: number;
  expectedScansPerMinute: number;
  averageTokensPerScan: number;
  averageProcessingTimeMs: number;
  requiredWorkerInstances: number;
  estimatedQueueDrainTimeSeconds: number;
  estimatedDailyTokenConsumption: number;
  estimatedDailyCloudCostUsd: number;
  bottleneckAnalysis: string;
  recommendedProvisioning: {
    cloudRunMinInstances: number;
    cloudRunMaxInstances: number;
    geminiTpmProvisioning: number;
    redisQueueBandwidthMb: number;
  };
}

export class CapacityPlanner {
  public calculateCapacityPlan(simulatedUsers: number): CapacityPlanModel {
    // 1M users with 5% concurrency = 50,000 active scanners
    const scanRatePerUserPerHour = 2.4; // 2.4 scans per active user / hr
    const scansPerMinute = Math.ceil((simulatedUsers * scanRatePerUserPerHour) / 60);

    const avgTokensPerScan = 850;
    const avgProcessingTimeMs = 650; // 0.65s

    // Throughput per worker instance = 60s / 0.65s = ~92 scans/min/worker
    const scansPerWorkerPerMinute = 60 / (avgProcessingTimeMs / 1000);
    const requiredWorkers = Math.max(2, Math.ceil(scansPerMinute / scansPerWorkerPerMinute));

    const totalDailyScans = scansPerMinute * 60 * 12; // 12h peak window
    const dailyTokens = totalDailyScans * avgTokensPerScan;
    const costPerMillionTokens = 0.35; // Gemini Flash blend
    const estimatedDailyCost = Number(((dailyTokens / 1_000_000) * costPerMillionTokens).toFixed(2));

    const drainTime = Number((scansPerMinute / (requiredWorkers * scansPerWorkerPerMinute) * 60).toFixed(1));

    let bottleneck = 'All subsystems healthy and balanced.';
    if (simulatedUsers >= 500000) {
      bottleneck = 'Downstream AI Provider TPM / Concurrency limit is primary throttle. Queue absorbs burst gracefully.';
    } else if (simulatedUsers >= 100000) {
      bottleneck = 'Autoscaling Cloud Run worker pool actively scaling to match queue depth.';
    }

    return {
      simulatedUserCount: simulatedUsers,
      expectedScansPerMinute: scansPerMinute,
      averageTokensPerScan: avgTokensPerScan,
      averageProcessingTimeMs: avgProcessingTimeMs,
      requiredWorkerInstances: requiredWorkers,
      estimatedQueueDrainTimeSeconds: drainTime,
      estimatedDailyTokenConsumption: dailyTokens,
      estimatedDailyCloudCostUsd: estimatedDailyCost,
      bottleneckAnalysis: bottleneck,
      recommendedProvisioning: {
        cloudRunMinInstances: Math.max(2, Math.ceil(requiredWorkers * 0.2)),
        cloudRunMaxInstances: Math.max(10, Math.ceil(requiredWorkers * 1.5)),
        geminiTpmProvisioning: Math.ceil((scansPerMinute * avgTokensPerScan) * 1.2),
        redisQueueBandwidthMb: Math.ceil((scansPerMinute * 0.15))
      }
    };
  }
}

export const capacityPlanner = new CapacityPlanner();
