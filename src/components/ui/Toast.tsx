import React, { createContext, useContext, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertCircle, Info } from 'lucide-react';

export type ToastType = 'info' | 'success' | 'error';

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return ctx;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => {
      // Limit to at most 2 stacked toasts
      const trimmed = prev.length >= 2 ? prev.slice(prev.length - 1) : prev;
      return [...trimmed, { id, message, type }];
    });

    // Auto-dismiss after 3000ms
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      {/* Toast Render Anchor: Above Floating Bottom Nav (bottom-24) */}
      <div className="fixed bottom-24 inset-x-4 z-50 flex flex-col items-center pointer-events-none space-y-2 max-w-sm mx-auto">
        <AnimatePresence>
          {toasts.map((toast) => {
            const icon =
              toast.type === 'success' ? (
                <CheckCircle2 size={16} className="text-[var(--color-ok)] shrink-0" />
              ) : toast.type === 'error' ? (
                <AlertCircle size={16} className="text-[var(--color-danger)] shrink-0" />
              ) : (
                <Info size={16} className="text-[var(--color-text-2)] shrink-0" />
              );

            return (
              <motion.div
                key={toast.id}
                initial={{ opacity: 0, y: 16, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="w-full pointer-events-auto flex items-center gap-2.5 px-4 py-3 rounded-[var(--radius-panel)] bg-[var(--color-panel-2)]/95 border border-[var(--color-line)] shadow-[0_8px_24px_rgba(0,0,0,0.6)] backdrop-blur-md"
              >
                {icon}
                <span className="text-secondary font-medium text-[var(--color-text)] truncate">
                  {toast.message}
                </span>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};
