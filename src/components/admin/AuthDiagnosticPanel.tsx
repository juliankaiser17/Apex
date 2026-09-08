import React, { useState, useEffect } from 'react';
import { Shield, RefreshCw, X, Play, CheckCircle2, AlertCircle } from 'lucide-react';
import { useApexStore } from '../../store/useApexStore';
import { supabase } from '../../lib/supabase';
import { runAllAuthTests } from '../../utils/__tests__/authState.test';

export const AuthDiagnosticPanel: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [sessionInfo, setSessionInfo] = useState<any>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [testResults, setTestResults] = useState<{ passed: boolean; results: string[] } | null>(null);
  const [isRunningTests, setIsRunningTests] = useState(false);

  const authStatus = useApexStore(s => s.authStatus);
  const authUser = useApexStore(s => s.authUser);
  const user = useApexStore(s => s.user);
  const garage = useApexStore(s => s.garage);
  const onboardingCompleted = useApexStore(s => s.onboardingCompleted);

  const refreshDiagnostics = async () => {
    setIsChecking(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      setSessionInfo(session);
    } catch (e) {
      console.warn('Diagnostics session check error:', e);
    } finally {
      setIsChecking(false);
    }
  };

  const handleRunTests = async () => {
    setIsRunningTests(true);
    try {
      const res = await runAllAuthTests();
      setTestResults(res);
      await refreshDiagnostics();
    } catch (e) {
      console.warn('Test execution failed:', e);
    } finally {
      setIsRunningTests(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      refreshDiagnostics();
    }
  }, [isOpen, authStatus, authUser]);

  // Hidden in production
  if (!import.meta.env.DEV) return null;

  return (
    <>
      {/* Floating Dev Trigger Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-20 right-3 z-40 bg-zinc-900/90 hover:bg-black text-[#00FF66] border border-[#00FF66]/30 px-2.5 py-1 rounded-full text-[10px] font-data font-bold flex items-center gap-1.5 shadow-xl active:scale-95 transition-all backdrop-blur-md"
        title="Open Auth Diagnostics"
      >
        <Shield className="w-3 h-3 text-[#00FF66]" />
        <span>AUTH: {authStatus}</span>
      </button>

      {/* Modal Dialog */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md select-none font-sans overflow-y-auto">
          <div className="w-full max-w-sm rounded-3xl bg-[#121212] border border-white/[0.15] p-5 space-y-4 shadow-2xl my-auto">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-[#00FF66]" />
                <h3 className="text-sm font-bold text-white tracking-tight">Auth Diagnostics</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={refreshDiagnostics}
                  className="p-1 rounded-lg bg-white/[0.06] text-white/70 hover:text-white"
                  title="Refresh"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 rounded-lg bg-white/[0.06] text-white/70 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="space-y-2 font-data text-xs max-h-[45vh] overflow-y-auto pr-1">
              <div className="p-2 rounded-xl bg-white/[0.03] border border-white/[0.06] flex justify-between items-center">
                <span className="text-white/50">Auth Status:</span>
                <span className={`font-bold ${
                  authStatus === 'AUTHENTICATED' ? 'text-[#00FF66]' : 
                  authStatus === 'AUTH_LOADING' ? 'text-amber-400' : 'text-white/60'
                }`}>
                  {authStatus}
                </span>
              </div>

              <div className="p-2 rounded-xl bg-white/[0.03] border border-white/[0.06] flex justify-between items-center">
                <span className="text-white/50">Auth User ID:</span>
                <span className="text-white font-mono text-[10px] truncate max-w-[170px]">
                  {authUser?.id || sessionInfo?.user?.id || 'none'}
                </span>
              </div>

              <div className="p-2 rounded-xl bg-white/[0.03] border border-white/[0.06] flex justify-between items-center">
                <span className="text-white/50">Auth Email:</span>
                <span className="text-white font-semibold text-[11px] truncate max-w-[170px]">
                  {authUser?.email || sessionInfo?.user?.email || 'none'}
                </span>
              </div>

              <div className="p-2 rounded-xl bg-white/[0.03] border border-white/[0.06] flex justify-between items-center">
                <span className="text-white/50">Session Exists:</span>
                <span className={sessionInfo?.user ? 'text-[#00FF66] font-bold' : 'text-red-400 font-bold'}>
                  {sessionInfo?.user ? 'YES' : 'NO'}
                </span>
              </div>

              <div className="p-2 rounded-xl bg-white/[0.03] border border-white/[0.06] flex justify-between items-center">
                <span className="text-white/50">Profile ID:</span>
                <span className="text-white font-mono text-[10px] truncate max-w-[170px]">
                  {user.id || 'none'}
                </span>
              </div>

              <div className="p-2 rounded-xl bg-white/[0.03] border border-white/[0.06] flex justify-between items-center">
                <span className="text-white/50">Profile Loaded:</span>
                <span className="text-[#00FF66] font-bold">
                  {user.username ? 'YES' : 'NO'}
                </span>
              </div>

              <div className="p-2 rounded-xl bg-white/[0.03] border border-white/[0.06] flex justify-between items-center">
                <span className="text-white/50">Guest Flag:</span>
                <span className={authStatus === 'GUEST' ? 'text-amber-400 font-bold' : 'text-white/60'}>
                  {authStatus === 'GUEST' ? 'true' : 'false'}
                </span>
              </div>

              <div className="p-2 rounded-xl bg-white/[0.03] border border-white/[0.06] flex justify-between items-center">
                <span className="text-white/50">Onboarding Done:</span>
                <span className="text-white font-bold">
                  {onboardingCompleted ? 'true' : 'false'}
                </span>
              </div>

              <div className="p-2 rounded-xl bg-white/[0.03] border border-white/[0.06] flex justify-between items-center">
                <span className="text-white/50">Garage Count:</span>
                <span className="text-white font-bold">
                  {garage.length}
                </span>
              </div>

              {testResults && (
                <div className="p-3 rounded-2xl bg-black/60 border border-white/[0.1] space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold">
                    {testResults.passed ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-[#00FF66]" />
                        <span className="text-[#00FF66]">All 9 Auth Tests Passed</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-4 h-4 text-red-500" />
                        <span className="text-red-400">Auth Tests Failed</span>
                      </>
                    )}
                  </div>
                  <div className="space-y-1 pt-1 max-h-32 overflow-y-auto text-[10px]">
                    {testResults.results.map((r, i) => (
                      <div key={i} className={r.startsWith('PASS') ? 'text-white/70' : 'text-red-400 font-bold'}>
                        {r}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="pt-1 flex gap-2">
              <button
                onClick={handleRunTests}
                disabled={isRunningTests}
                className="flex-1 py-2.5 rounded-xl bg-[#00FF66]/15 hover:bg-[#00FF66]/25 border border-[#00FF66]/30 text-[#00FF66] font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 active:scale-95"
              >
                <Play className={`w-3.5 h-3.5 ${isRunningTests ? 'animate-spin' : ''}`} />
                <span>{isRunningTests ? 'Testing...' : 'Run 9 Auth Tests'}</span>
              </button>

              <button
                onClick={() => setIsOpen(false)}
                className="py-2.5 px-4 rounded-xl bg-white/[0.08] hover:bg-white/[0.12] text-white font-medium text-xs transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
