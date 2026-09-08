/**
 * APEX — Dead-Letter Queue (DLQ)
 * Captures permanently failed or unrecoverable jobs for forensic inspection and admin reprocessing.
 */

import type { ScanJob } from '../types';

export interface DeadLetterEntry {
  id: string;
  jobId: string;
  userId: string;
  attempts: number;
  lastError: string;
  errorType: '429' | '5xx' | 'TIMEOUT' | 'QUALITY' | 'SCHEMA' | 'INTERNAL';
  timestamp: string;
  pipelineVersion: string;
  originalPayload: ScanJob;
  reprocessed: boolean;
  reprocessedAt?: string;
}

export class DeadLetterQueue {
  private entries: Map<string, DeadLetterEntry> = new Map();

  public push(job: ScanJob, error: string, errorType?: any) {
    const entryId = `dlq_${Date.now()}_${job.id}`;
    const entry: DeadLetterEntry = {
      id: entryId,
      jobId: job.id,
      userId: job.userId,
      attempts: job.attempts,
      lastError: error || job.error || 'Unknown fatal processing error',
      errorType: errorType || job.lastErrorType || 'INTERNAL',
      timestamp: new Date().toISOString(),
      pipelineVersion: job.pipelineVersion,
      originalPayload: { ...job, status: 'dead_letter' },
      reprocessed: false
    };

    this.entries.set(entryId, entry);
  }

  public getEntries(): DeadLetterEntry[] {
    return Array.from(this.entries.values()).sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  public size(): number {
    return this.entries.size;
  }

  public clear() {
    this.entries.clear();
  }

  public markReprocessed(entryId: string) {
    const entry = this.entries.get(entryId);
    if (entry) {
      entry.reprocessed = true;
      entry.reprocessedAt = new Date().toISOString();
    }
  }
}

export const deadLetterQueue = new DeadLetterQueue();
