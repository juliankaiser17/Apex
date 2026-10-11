/**
 * Vendor-Neutral Crash and Error Reporting Interface for Apex
 *
 * Implements a privacy-preserving, zero-dependency logging ring buffer.
 * Provides a clean adapter contract for pluggable vendors (Sentry / Firebase Crashlytics)
 * once selected under Gate G9.
 */

export interface CrashReport {
  id: string;
  timestamp: string;
  message: string;
  stack?: string;
  componentStack?: string;
  context?: Record<string, any>;
  breadcrumbs: Breadcrumb[];
  environment: string;
  appVersion: string;
}

export interface Breadcrumb {
  timestamp: string;
  category: string;
  message: string;
  data?: Record<string, any>;
}

export interface ICrashReportingVendor {
  name: string;
  init(): void;
  captureException(error: Error, context?: Record<string, any>): void;
  addBreadcrumb(breadcrumb: Breadcrumb): void;
  setUser(userId: string | null): void;
}

const MAX_BREADCRUMBS = 25;
const MAX_LOCAL_CRASHES = 10;
const STORAGE_KEY = 'apex_local_crash_reports';

class CrashReporterService {
  private breadcrumbs: Breadcrumb[] = [];
  private activeVendor: ICrashReportingVendor | null = null;
  private currentUserId: string | null = null;
  private isInitialized = false;

  public init(vendor?: ICrashReportingVendor) {
    if (this.isInitialized) return;
    this.isInitialized = true;

    if (vendor) {
      this.activeVendor = vendor;
      try {
        this.activeVendor.init();
      } catch (err) {
        console.warn('[CrashReporter] Vendor initialization error:', err);
      }
    }

    // Global uncaught error listener
    if (typeof window !== 'undefined') {
      window.addEventListener('error', (event) => {
        if (event.error) {
          this.recordError(event.error, {
            type: 'uncaught_window_error',
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno
          });
        }
      });

      window.addEventListener('unhandledrejection', (event) => {
        const reason = event.reason;
        const err = reason instanceof Error ? reason : new Error(String(reason));
        this.recordError(err, { type: 'unhandled_promise_rejection' });
      });
    }

    this.recordBreadcrumb('lifecycle', 'CrashReporter initialized', { vendor: this.activeVendor?.name || 'local-only' });
  }

  public recordBreadcrumb(category: string, message: string, data?: Record<string, any>) {
    const crumb: Breadcrumb = {
      timestamp: new Date().toISOString(),
      category,
      message,
      data: this.sanitizeContext(data)
    };

    this.breadcrumbs.push(crumb);
    if (this.breadcrumbs.length > MAX_BREADCRUMBS) {
      this.breadcrumbs.shift();
    }

    if (this.activeVendor) {
      try {
        this.activeVendor.addBreadcrumb(crumb);
      } catch (_) {}
    }
  }

  public recordError(error: Error, context?: Record<string, any>, componentStack?: string) {
    const report: CrashReport = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `crash_${Date.now()}`,
      timestamp: new Date().toISOString(),
      message: error?.message || 'Unknown application error',
      stack: error?.stack,
      componentStack,
      context: {
        ...this.sanitizeContext(context),
        userId: this.currentUserId || 'anonymous'
      },
      breadcrumbs: [...this.breadcrumbs],
      environment: import.meta.env.MODE || 'production',
      appVersion: '1.0.1'
    };

    console.error('[Apex CrashReporter] Recorded error:', report.message, report);

    // Save locally for diagnostic export
    this.saveReportLocally(report);

    // Delegate to active vendor if configured
    if (this.activeVendor) {
      try {
        this.activeVendor.captureException(error, {
          ...report.context,
          crashId: report.id,
          componentStack
        });
      } catch (vendorErr) {
        console.warn('[CrashReporter] Vendor failed to record exception:', vendorErr);
      }
    }
  }

  public setUserContext(userId: string | null) {
    this.currentUserId = userId;
    if (this.activeVendor) {
      try {
        this.activeVendor.setUser(userId);
      } catch (_) {}
    }
  }

  public getRecentCrashReports(): CrashReport[] {
    try {
      if (typeof localStorage === 'undefined') return [];
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (_) {
      return [];
    }
  }

  public clearLocalCrashReports() {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch (_) {}
  }

  private saveReportLocally(report: CrashReport) {
    try {
      if (typeof localStorage === 'undefined') return;
      const existing = this.getRecentCrashReports();
      existing.unshift(report);
      if (existing.length > MAX_LOCAL_CRASHES) {
        existing.pop();
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
    } catch (_) {}
  }

  private sanitizeContext(ctx?: Record<string, any>): Record<string, any> | undefined {
    if (!ctx) return undefined;
    const sanitized: Record<string, any> = {};
    const sensitiveKeys = ['token', 'key', 'password', 'secret', 'authorization', 'credential', 'cookie', 'session'];

    for (const [k, v] of Object.entries(ctx)) {
      const lower = k.toLowerCase();
      if (sensitiveKeys.some(s => lower.includes(s))) {
        sanitized[k] = '[REDACTED]';
      } else if (typeof v === 'object' && v !== null) {
        sanitized[k] = this.sanitizeContext(v);
      } else {
        sanitized[k] = v;
      }
    }
    return sanitized;
  }
}

export const crashReporter = new CrashReporterService();
