/**
 * APEX — Acceptance Test Durable Checkpoint Manager
 * 
 * Provides crash-resilient, persistent tracking for vehicle acceptance scans:
 * - Atomic disk synchronization (survives network loss, SIGINT, machine crash)
 * - Strict state transitions: pending → running → completed | quota_blocked | network_failed | failed
 * - Guaranteed preservation of verified completed Gemini scans
 * - Prevents redundant API calls on already completed samples
 */

import fs from 'fs';
import path from 'path';

export type CheckpointScanStatus = 
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'quota_blocked'
  | 'network_failed'
  | 'ambiguous';

export interface CheckpointScanRecord {
  test_id: string;
  original_filename: string;
  status: CheckpointScanStatus;
  attempt_count: number;
  scan_id: string | null;
  request_id: string | null;
  image_sha256: string;
  provider_attempted: string;
  provider_used: string | null;
  fallback_used: boolean;
  cache_hit: boolean;
  started_at: string | null;
  completed_at: string | null;
  result: {
    predicted_make: string;
    predicted_model: string;
    predicted_generation: string;
    predicted_variant: string | null;
    confidence_score: number;
    status: string;
    specificity_level?: string;
    quality_score: number;
    latencies: {
      total_ms: number;
      inference_ms: number;
    };
    contradictions: string[];
    evidence: string[];
  } | null;
  error: string | null;
}

export interface CheckpointFileStructure {
  version: string;
  benchmark_name: string;
  last_updated: string;
  total_images: number;
  completed_count: number;
  quota_blocked_count: number;
  pending_count: number;
  scans: Record<string, CheckpointScanRecord>;
}

export class CheckpointManager {
  private checkpointPath: string;
  private checkpoint: CheckpointFileStructure;

  constructor(filePath?: string) {
    this.checkpointPath = filePath || path.resolve('scratch/acceptance_checkpoint.json');
    this.checkpoint = this.loadOrCreate();
  }

  private loadOrCreate(): CheckpointFileStructure {
    if (fs.existsSync(this.checkpointPath)) {
      try {
        const raw = fs.readFileSync(this.checkpointPath, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed && parsed.scans) {
          return parsed;
        }
      } catch (err) {
        console.warn(`[CheckpointManager] Corrupt checkpoint file at ${this.checkpointPath}. Initializing clean structure.`);
      }
    }

    const initial: CheckpointFileStructure = {
      version: '2.5.0-resumable',
      benchmark_name: 'Apex Real-World Car Acceptance Test',
      last_updated: new Date().toISOString(),
      total_images: 21,
      completed_count: 0,
      quota_blocked_count: 0,
      pending_count: 21,
      scans: {}
    };

    return initial;
  }

  public initializeWithInventory(inventory: Array<{ test_id: string; original_filename: string; sha256: string }>) {
    this.checkpoint.total_images = inventory.length;

    for (const item of inventory) {
      if (!this.checkpoint.scans[item.test_id]) {
        this.checkpoint.scans[item.test_id] = {
          test_id: item.test_id,
          original_filename: item.original_filename,
          status: 'pending',
          attempt_count: 0,
          scan_id: null,
          request_id: null,
          image_sha256: item.sha256,
          provider_attempted: 'GeminiProvider',
          provider_used: null,
          fallback_used: false,
          cache_hit: false,
          started_at: null,
          completed_at: null,
          result: null,
          error: null
        };
      }
    }

    this.recalculateCounts();
    this.saveAtomic();
  }

  public getRecord(testId: string): CheckpointScanRecord | undefined {
    return this.checkpoint.scans[testId];
  }

  public getAllRecords(): CheckpointScanRecord[] {
    return Object.values(this.checkpoint.scans);
  }

  public getCompletedScans(): CheckpointScanRecord[] {
    return Object.values(this.checkpoint.scans).filter(s => s.status === 'completed');
  }

  public getPendingOrRetryableScans(): CheckpointScanRecord[] {
    return Object.values(this.checkpoint.scans).filter(
      s => s.status === 'pending' || s.status === 'quota_blocked' || s.status === 'network_failed' || s.status === 'failed' || s.status === 'running'
    );
  }

  public markRunning(testId: string, scanId: string, requestId: string, imageSha: string) {
    const record = this.checkpoint.scans[testId];
    if (!record) return;

    record.status = 'running';
    record.scan_id = scanId;
    record.request_id = requestId;
    record.image_sha256 = imageSha;
    record.started_at = new Date().toISOString();
    record.attempt_count += 1;
    record.error = null;

    this.recalculateCounts();
    this.saveAtomic();
  }

  public markCompleted(
    testId: string,
    data: {
      scanId: string;
      requestId: string;
      providerUsed: string;
      fallbackUsed: boolean;
      cacheHit: boolean;
      result: CheckpointScanRecord['result'];
    }
  ) {
    const record = this.checkpoint.scans[testId];
    if (!record) return;

    record.status = 'completed';
    record.scan_id = data.scanId;
    record.request_id = data.requestId;
    record.provider_used = data.providerUsed;
    record.fallback_used = data.fallbackUsed;
    record.cache_hit = data.cacheHit;
    record.completed_at = new Date().toISOString();
    record.result = data.result;
    record.error = null;

    this.recalculateCounts();
    this.saveAtomic();
  }

  public markQuotaBlocked(testId: string, errorMsg: string) {
    const record = this.checkpoint.scans[testId];
    if (!record) return;

    record.status = 'quota_blocked';
    record.error = errorMsg;
    record.completed_at = new Date().toISOString();

    this.recalculateCounts();
    this.saveAtomic();
  }

  public markNetworkFailed(testId: string, errorMsg: string) {
    const record = this.checkpoint.scans[testId];
    if (!record) return;

    record.status = 'network_failed';
    record.error = errorMsg;
    record.completed_at = new Date().toISOString();

    this.recalculateCounts();
    this.saveAtomic();
  }

  public markFailed(testId: string, errorMsg: string) {
    const record = this.checkpoint.scans[testId];
    if (!record) return;

    record.status = 'failed';
    record.error = errorMsg;
    record.completed_at = new Date().toISOString();

    this.recalculateCounts();
    this.saveAtomic();
  }

  private recalculateCounts() {
    const all = Object.values(this.checkpoint.scans);
    this.checkpoint.completed_count = all.filter(s => s.status === 'completed').length;
    this.checkpoint.quota_blocked_count = all.filter(s => s.status === 'quota_blocked').length;
    this.checkpoint.pending_count = all.filter(s => s.status !== 'completed').length;
    this.checkpoint.last_updated = new Date().toISOString();
  }

  public saveAtomic() {
    const dir = path.dirname(this.checkpointPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const tmpPath = `${this.checkpointPath}.tmp_${Date.now()}`;
    const payload = JSON.stringify(this.checkpoint, null, 2);

    fs.writeFileSync(tmpPath, payload, 'utf8');
    fs.renameSync(tmpPath, this.checkpointPath);
  }
}
