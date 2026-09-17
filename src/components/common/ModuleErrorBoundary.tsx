import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';

interface Props {
  moduleName: string;
  fallback?: ReactNode;
  onReset?: () => void;
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
}

export class ModuleErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    showDetails: false
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`[ModuleErrorBoundary:${this.props.moduleName}] Caught unhandled error:`, error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null, showDetails: false });
    this.props.onReset?.();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="w-full h-full min-h-[360px] flex items-center justify-center p-6 bg-black/90">
          <div className="w-full max-w-md bg-[#121212] border border-red-500/30 rounded-2xl p-6 text-center space-y-4 shadow-2xl shadow-red-950/20">
            <div className="w-14 h-14 rounded-2xl bg-red-950/40 border border-red-500/30 flex items-center justify-center mx-auto text-red-400">
              <AlertTriangle className="w-7 h-7" />
            </div>

            <div className="space-y-1">
              <span className="text-[10px] font-mono tracking-widest text-red-400 font-bold uppercase">
                {this.props.moduleName} Subsystem Isolated
              </span>
              <h3 className="font-display text-2xl font-bold text-white tracking-wide">
                MODULE RECOVERED
              </h3>
              <p className="text-xs text-white/60 leading-relaxed max-w-xs mx-auto">
                A localized rendering issue was caught and contained. Your session, discoveries, and garage data are safe.
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={this.handleReset}
                className="px-5 py-2.5 rounded-xl bg-[#E50914] hover:bg-[#DC2626] text-white font-bold text-xs tracking-wider flex items-center gap-2 shadow-lg shadow-red-950/50 active:scale-95 transition-all"
              >
                <RefreshCw className="w-3.5 h-3.5" /> RELOAD MODULE
              </button>
            </div>

            {/* Expandable Diagnostic for Dev Mode */}
            {import.meta.env.DEV && this.state.error && (
              <div className="pt-2 text-left">
                <button
                  onClick={() => this.setState(prev => ({ showDetails: !prev.showDetails }))}
                  className="text-[11px] text-white/40 hover:text-white/70 flex items-center gap-1 mx-auto"
                >
                  <span>Diagnostic Trace</span>
                  {this.state.showDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
                {this.state.showDetails && (
                  <div className="mt-2 p-3 rounded-lg bg-black/60 border border-white/10 font-mono text-[10px] text-red-300 max-h-40 overflow-y-auto space-y-1">
                    <p className="font-bold">{this.state.error.toString()}</p>
                    {this.state.errorInfo && (
                      <pre className="text-white/40 whitespace-pre-wrap">{this.state.errorInfo.componentStack}</pre>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
