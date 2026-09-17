/**
 * APEX — Durable Sliding Priority Job Queue
 * Implements 3 priority tiers (HIGH / NORMAL / LOW), fair per-user scheduling,
 * idempotency enforcement, and burst traffic absorption.
 */

import type { ScanJob, ScanJobStatus } from '../types';

export class JobQueue {
  private highQueue: ScanJob[] = [];
  private normalQueue: ScanJob[] = [];
  private lowQueue: ScanJob[] = [];

  private jobsById: Map<string, ScanJob> = new Map();
  private idempotencyIndex: Map<string, string> = new Map(); // idempotencyKey -> jobId
  private userActiveCount: Map<string, number> = new Map(); // userId -> active in-flight count

  private inFlightImageHashes: Map<string, string> = new Map(); // imageHash -> jobId

  private readonly maxQueueCapacity = 250000;
  private readonly maxPerUserConcurrent = 2;
  private readonly maxPerUserInFlight = 5;

  /**
   * Enqueue a new scan job with idempotency and in-flight image deduplication
   */
  public enqueue(job: ScanJob): { job: ScanJob; isDuplicate: boolean; queuePosition: number } {
    // 1. Idempotency Check (by idempotencyKey)
    if (job.idempotencyKey && this.idempotencyIndex.has(job.idempotencyKey)) {
      const existingJobId = this.idempotencyIndex.get(job.idempotencyKey)!;
      const existing = this.jobsById.get(existingJobId);
      if (existing) {
        return {
          job: existing,
          isDuplicate: true,
          queuePosition: this.getQueuePosition(existing.id)
        };
      }
    }

    // 2. In-Flight Exact Image Hash Deduplication
    if (job.imageHash && this.inFlightImageHashes.has(job.imageHash)) {
      const existingJobId = this.inFlightImageHashes.get(job.imageHash)!;
      const existing = this.jobsById.get(existingJobId);
      if (existing && (existing.status === 'queued' || existing.status === 'processing' || existing.status === 'completed')) {
        return {
          job: existing,
          isDuplicate: true,
          queuePosition: this.getQueuePosition(existing.id)
        };
      }
    }

    // 3. Capacity & Per-User Pending Scan Guard
    const userInFlight = this.userActiveCount.get(job.userId) || 0;
    if (userInFlight >= this.maxPerUserInFlight) {
      job.status = 'failed';
      job.error = 'User in-flight scan quota reached. Please wait for active scans to complete.';
      return { job, isDuplicate: false, queuePosition: -1 };
    }

    if (this.size() >= this.maxQueueCapacity) {
      job.status = 'failed';
      job.error = 'Queue capacity saturated during high-load traffic spike. Try again in 30 seconds.';
      return { job, isDuplicate: false, queuePosition: -1 };
    }

    // 4. Register Job
    this.jobsById.set(job.id, job);
    if (job.idempotencyKey) {
      this.idempotencyIndex.set(job.idempotencyKey, job.id);
    }
    if (job.imageHash) {
      this.inFlightImageHashes.set(job.imageHash, job.id);
    }

    // 5. Place into priority tier
    if (job.priority === 'HIGH') {
      this.highQueue.push(job);
    } else if (job.priority === 'NORMAL') {
      this.normalQueue.push(job);
    } else {
      this.lowQueue.push(job);
    }

    return {
      job,
      isDuplicate: false,
      queuePosition: this.getQueuePosition(job.id)
    };
  }

  /**
   * Dequeue next eligible job according to priority & fair user scheduling
   */
  public dequeue(): ScanJob | null {
    // Check HIGH queue first
    const highJob = this.popFairJob(this.highQueue);
    if (highJob) return highJob;

    // Check NORMAL queue second
    const normalJob = this.popFairJob(this.normalQueue);
    if (normalJob) return normalJob;

    // Check LOW queue third
    const lowJob = this.popFairJob(this.lowQueue);
    if (lowJob) return lowJob;

    return null;
  }

  private popFairJob(queue: ScanJob[]): ScanJob | null {
    for (let i = 0; i < queue.length; i++) {
      const candidate = queue[i];
      const userActive = this.userActiveCount.get(candidate.userId) || 0;

      if (userActive < this.maxPerUserConcurrent) {
        queue.splice(i, 1);
        candidate.status = 'processing';
        candidate.startedAt = Date.now();
        this.userActiveCount.set(candidate.userId, userActive + 1);
        return candidate;
      }
    }

    // Strict per-user concurrency: if all eligible candidates have active jobs >= maxPerUserConcurrent,
    // wait for an active worker to complete rather than overloading provider quotas.
    return null;
  }

  public completeJob(jobId: string, status: ScanJobStatus) {
    const job = this.jobsById.get(jobId);
    if (job) {
      job.status = status;
      job.completedAt = Date.now();
      const currentActive = this.userActiveCount.get(job.userId) || 1;
      this.userActiveCount.set(job.userId, Math.max(0, currentActive - 1));

      if (job.imageHash && this.inFlightImageHashes.get(job.imageHash) === jobId) {
        this.inFlightImageHashes.delete(job.imageHash);
      }
    }
  }

  public getInFlightCount(): number {
    return this.inFlightImageHashes.size;
  }

  public clear() {
    this.highQueue = [];
    this.normalQueue = [];
    this.lowQueue = [];
    this.jobsById.clear();
    this.idempotencyIndex.clear();
    this.inFlightImageHashes.clear();
    this.userActiveCount.clear();
  }

  public getJob(jobId: string): ScanJob | null {
    return this.jobsById.get(jobId) || null;
  }

  public size(): number {
    return this.highQueue.length + this.normalQueue.length + this.lowQueue.length;
  }

  public getDepth(): { high: number; normal: number; low: number; total: number } {
    return {
      high: this.highQueue.length,
      normal: this.normalQueue.length,
      low: this.lowQueue.length,
      total: this.size()
    };
  }

  public getQueuePosition(jobId: string): number {
    const highIdx = this.highQueue.findIndex((j) => j.id === jobId);
    if (highIdx !== -1) return highIdx + 1;

    const normalIdx = this.normalQueue.findIndex((j) => j.id === jobId);
    if (normalIdx !== -1) return this.highQueue.length + normalIdx + 1;

    const lowIdx = this.lowQueue.findIndex((j) => j.id === jobId);
    if (lowIdx !== -1) return this.highQueue.length + this.normalQueue.length + lowIdx + 1;

    return 0; // Already running or completed
  }
}

export const jobQueue = new JobQueue();
