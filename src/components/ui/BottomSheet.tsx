import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

export interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export const BottomSheet: React.FC<BottomSheetProps> = ({
  isOpen,
  onClose,
  title,
  children,
  className = '',
}) => {
  // Prevent background scrolling while open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/75 backdrop-blur-sm"
          />

          {/* Sheet Container */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className={`relative z-10 w-full max-w-lg mx-auto bg-[var(--color-panel)] rounded-t-[20px] border-t border-[var(--color-line)] shadow-[0_-12px_40px_rgba(0,0,0,0.8)] pb-safe max-h-[85vh] flex flex-col ${className}`}
          >
            {/* Drag Handle */}
            <div className="w-12 h-1.5 bg-[var(--color-line)] rounded-full mx-auto my-3 shrink-0 cursor-grab active:cursor-grabbing" />

            {/* Header */}
            {title && (
              <div className="flex items-center justify-between px-5 pb-3 border-b border-[var(--color-line)] shrink-0">
                <h3 className="font-display text-display-m text-[var(--color-text)]">
                  {title}
                </h3>
                <button
                  onClick={onClose}
                  aria-label="Close sheet"
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--color-text-2)] hover:text-[var(--color-text)] hover:bg-[var(--color-panel-2)] transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            )}

            {/* Content Slot */}
            <div className="p-5 overflow-y-auto no-scrollbar flex-1">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

BottomSheet.displayName = 'BottomSheet';
