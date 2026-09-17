/**
 * APEX — Distributed Tracing Context & Development Request Observability
 * 
 * Provides end-to-end request tracing for scan lifecycle isolation auditing:
 * image identity/hash, request ID, candidate set, prompt contents, references,
 * model response, classifier output, and final canonical result.
 */

export interface TraceSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  startTime: number;
  endTime?: number;
  durationMs?: number;
  attributes: Record<string, any>;
}

export interface DevScanTrace {
  scan_id: string;
  request_id: string;
  timestamp: string;
  image_hash: string;
  image_size_bytes: number;
  provider_model: string;
  provider?: string;
  model?: string;
  latency_ms: number;
  latency?: number;
  status?: string;
  cache_hit: boolean;
  cache_key: string;
  retry_count?: number;
  error_code?: string | null;
  fallback_used: boolean;
  abstention_reason: string | null;
  candidate_set: string[];
  retrieved_references: string[];
  prompt_summary: string;
  raw_model_response: any;
  classifier_output: any;
  final_result: any;
}

export class Tracer {
  private spans: TraceSpan[] = [];
  private devTraces: DevScanTrace[] = [];

  public createTraceId(): string {
    return `trc_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;
  }

  public createScanId(): string {
    return `scan_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
  }

  public startSpan(traceId: string, name: string, attributes: Record<string, any> = {}): TraceSpan {
    const span: TraceSpan = {
      traceId,
      spanId: `spn_${Math.random().toString(36).substring(2, 9)}`,
      name,
      startTime: Date.now(),
      attributes
    };
    this.spans.push(span);
    return span;
  }

  public endSpan(span: TraceSpan, extraAttributes: Record<string, any> = {}) {
    span.endTime = Date.now();
    span.durationMs = span.endTime - span.startTime;
    span.attributes = { ...span.attributes, ...extraAttributes };
  }

  public getTraceSpans(traceId: string): TraceSpan[] {
    return this.spans.filter((s) => s.traceId === traceId);
  }

  // ── Development Request Tracing Instrumentation ──
  public recordScanTrace(trace: DevScanTrace) {
    this.devTraces.push(trace);
    if (this.devTraces.length > 50) {
      this.devTraces.shift();
    }
    this.logTraceSummary(trace);
  }

  public getLastTrace(): DevScanTrace | null {
    return this.devTraces[this.devTraces.length - 1] || null;
  }

  public getAllTraces(): DevScanTrace[] {
    return [...this.devTraces];
  }

  public clearTraces() {
    this.devTraces = [];
    this.spans = [];
  }

  public logTraceSummary(t: DevScanTrace) {
    console.log(`\n── [APEX SCAN TRACE: ${t.scan_id}] ────────────────────────────`);
    console.log(`  Request ID:        ${t.request_id}`);
    console.log(`  Timestamp:         ${t.timestamp}`);
    console.log(`  Image Hash:        ${t.image_hash} (${t.image_size_bytes} bytes)`);
    console.log(`  Provider/Model:    ${t.provider_model} (${t.latency_ms}ms)`);
    console.log(`  Cache Hit:         ${t.cache_hit} (key: ${t.cache_key})`);
    console.log(`  Fallback Used:     ${t.fallback_used}`);
    console.log(`  Candidate Set:     [${t.candidate_set.join(', ')}]`);
    console.log(`  Retrieved Refs:    [${t.retrieved_references.join(', ')}]`);
    console.log(`  Classifier Status: ${t.classifier_output?.status || 'N/A'}`);
    console.log(`  Abstention:        ${t.abstention_reason || 'None (Identified)'}`);
    console.log(`  Final Result:      ${t.final_result?.make || 'None'} ${t.final_result?.model || 'None'} ${t.final_result?.trim || '(base)'}`);
    console.log(`─────────────────────────────────────────────────────────────\n`);
  }
}

export const tracer = new Tracer();
