import React from 'react';
import ReactDOM from 'react-dom/client';
import 'leaflet/dist/leaflet.css';
import App from './App.tsx';
import './index.css';
import { preloadAuthStorage } from './lib/capacitorStorage';
import { useApexStore } from './store/useApexStore';
import { crashReporter } from './services/crashReporter';

crashReporter.init();

if (typeof window !== 'undefined') {
  (window as any).useApexStore = useApexStore;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class RootErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[RootErrorBoundary] Caught uncaught application fault:', error, errorInfo);
    crashReporter.recordError(error, { type: 'react_root_error_boundary' }, errorInfo.componentStack || undefined);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (_) {}
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 bg-[#080808] text-[#F0EBE3] flex flex-col items-center justify-center p-6 text-center z-[999999] font-sans select-none">
          <div className="max-w-md w-full bg-[#121216] border border-red-500/40 rounded-2xl p-7 shadow-2xl">
            <div className="w-12 h-12 bg-red-500/15 border border-red-500/30 rounded-full flex items-center justify-center mx-auto mb-4 text-[#E50914] font-black text-xl">
              !
            </div>
            <h1 className="text-xl font-black tracking-wider uppercase text-white mb-2">
              System Fault Detected
            </h1>
            <p className="text-sm text-[#F0EBE3]/70 mb-4 leading-relaxed">
              An unexpected component error occurred. The application has been paused to protect your local session.
            </p>
            {this.state.error && (
              <div className="bg-[#09090b] border border-white/10 rounded-lg p-3 text-xs font-mono text-red-400 text-left overflow-x-auto max-h-32 mb-6">
                {this.state.error.message || String(this.state.error)}
              </div>
            )}
            <div className="flex flex-col gap-2.5">
              <button
                onClick={this.handleReload}
                className="w-full bg-[#E50914] text-white font-bold py-3 px-4 rounded-xl text-xs tracking-wider uppercase cursor-pointer hover:bg-red-700 active:scale-98 transition-all"
              >
                Reload Application
              </button>
              <button
                onClick={this.handleReset}
                className="w-full bg-white/5 border border-white/10 text-[#F0EBE3] font-medium py-2.5 px-4 rounded-xl text-xs cursor-pointer hover:bg-white/10 active:scale-98 transition-all"
              >
                Clear Cache & Restart
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const AppBootloader: React.FC = () => {
  const [isStorageReady, setIsStorageReady] = React.useState(false);
  const [isTakingLonger, setIsTakingLonger] = React.useState(false);
  const [retryCount, setRetryCount] = React.useState(0);

  React.useEffect(() => {
    let isCancelled = false;
    const longerTimer = setTimeout(() => {
      if (!isCancelled) setIsTakingLonger(true);
    }, 4500);

    preloadAuthStorage()
      .catch((err) => {
        console.warn('[APEX Boot] Native storage preload warning:', err);
      })
      .finally(() => {
        clearTimeout(longerTimer);
        if (!isCancelled) {
          setIsStorageReady(true);
        }
      });

    return () => {
      isCancelled = true;
      clearTimeout(longerTimer);
    };
  }, [retryCount]);

  if (!isStorageReady) {
    return (
      <div className="fixed inset-0 bg-[#080808] text-[#F0EBE3] flex flex-col items-center justify-center p-6 text-center z-[99999] select-none font-sans">
        <div className="relative w-16 h-16 mb-5 flex items-center justify-center">
          <div className="absolute inset-0 border-2 border-red-500/20 border-t-[#E50914] rounded-full animate-spin" />
          <div className="w-3.5 h-3.5 bg-[#E50914] rounded-full shadow-[0_0_12px_#E50914]" />
        </div>
        <div className="text-xl font-black tracking-widest text-white uppercase mb-2">APEX</div>
        <div className="text-[11px] font-semibold tracking-widest text-white/50 uppercase">
          {isTakingLonger ? 'Restoring Secure Session...' : 'Starting Engine...'}
        </div>
        {isTakingLonger && (
          <div className="mt-6 max-w-xs flex flex-col items-center gap-3">
            <p className="text-xs text-white/60 leading-relaxed">
              Storage initialization is taking longer than usual on this device.
            </p>
            <button
              onClick={() => setRetryCount((c) => c + 1)}
              className="px-4 py-2 bg-white/10 hover:bg-white/15 border border-white/20 rounded-xl text-xs font-semibold uppercase tracking-wider text-white active:scale-95 transition-all cursor-pointer"
            >
              Retry Preload
            </button>
          </div>
        )}
      </div>
    );
  }

  return <App />;
};

function mountApplication() {
  const rootEl = document.getElementById('root');
  if (!rootEl) {
    console.error('[APEX Boot] Root container not found in DOM');
    return;
  }

  // Signal pre-React watchdog that React has taken over
  rootEl.setAttribute('data-mounted', 'true');
  if (typeof (window as any).__APEX_BOOT_READY__ === 'function') {
    (window as any).__APEX_BOOT_READY__();
  }

  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <RootErrorBoundary>
        <AppBootloader />
      </RootErrorBoundary>
    </React.StrictMode>,
  );
}

// Mount React immediately at frame 0 — AppBootloader holds splash until
// native Preferences are loaded, ensuring user sessions are never lost.
mountApplication();
