import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ShieldAlert, UserX, Flag, CheckCircle, AlertTriangle } from 'lucide-react';
import { useApexStore } from '../../store/useApexStore';

interface ModerationModalProps {
  isOpen: boolean;
  targetType: 'post' | 'comment' | 'user';
  targetId: string;
  targetUserId: string;
  targetUsername?: string;
  onClose: () => void;
  onActionComplete?: () => void;
}

type ModerationMode = 'menu' | 'report' | 'block_confirm' | 'success';

export const ModerationModal: React.FC<ModerationModalProps> = ({
  isOpen,
  targetType,
  targetId,
  targetUserId,
  targetUsername = 'User',
  onClose,
  onActionComplete
}) => {
  const { blockUser } = useApexStore();
  const [mode, setMode] = useState<ModerationMode>('menu');
  const [reportReason, setReportReason] = useState('Inappropriate Imagery');
  const [reportDetails, setReportDetails] = useState('');
  const [statusMessage, setStatusMessage] = useState('');

  if (!isOpen) return null;

  const handleReportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const reportEntry = {
        id: `rep_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        timestamp: new Date().toISOString(),
        targetType,
        targetId,
        targetUserId,
        reason: reportReason,
        details: reportDetails.trim()
      };
      const existing = JSON.parse(localStorage.getItem('apex_moderation_reports') || '[]');
      existing.push(reportEntry);
      localStorage.setItem('apex_moderation_reports', JSON.stringify(existing));
    } catch (e) {
      console.warn('Failed to save report to local audit log:', e);
    }

    setStatusMessage('Thank you for keeping Apex safe. Our moderation team has received your report.');
    setMode('success');
    setTimeout(() => {
      onActionComplete?.();
      handleClose();
    }, 1500);
  };

  const handleConfirmBlock = () => {
    if (blockUser && targetUserId) {
      blockUser(targetUserId);
    }
    setStatusMessage(`@${targetUsername} has been blocked. Their posts and comments will no longer appear.`);
    setMode('success');
    setTimeout(() => {
      onActionComplete?.();
      handleClose();
    }, 1500);
  };

  const handleClose = () => {
    setMode('menu');
    setReportDetails('');
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm select-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 12 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-sm bg-[#161616] border border-white/10 rounded-3xl p-5 shadow-2xl overflow-hidden text-white"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-red-400" />
              <h3 className="text-sm font-bold text-white tracking-wide">
                {mode === 'report' ? 'Report Content' : mode === 'block_confirm' ? 'Block User' : 'Safety & Moderation'}
              </h3>
            </div>
            <button
              onClick={handleClose}
              className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-white/60 hover:text-white transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Body Content */}
          <div className="py-4">
            {mode === 'menu' && (
              <div className="space-y-2">
                <p className="text-xs text-white/60 pb-1">
                  Choose an action for @{targetUsername}:
                </p>

                <button
                  onClick={() => setMode('report')}
                  className="w-full p-3.5 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] flex items-center gap-3 text-left transition-colors"
                >
                  <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
                    <Flag className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-sm font-bold text-white block">Report {targetType}</span>
                    <span className="text-[11px] text-white/50">Flag inappropriate image, spam, or false vehicle</span>
                  </div>
                </button>

                <button
                  onClick={() => setMode('block_confirm')}
                  className="w-full p-3.5 rounded-2xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 flex items-center gap-3 text-left transition-colors"
                >
                  <div className="p-2 rounded-xl bg-red-500/20 text-red-400">
                    <UserX className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-sm font-bold text-red-400 block">Block @{targetUsername}</span>
                    <span className="text-[11px] text-red-200/60">Hide all posts, comments, and interactions</span>
                  </div>
                </button>
              </div>
            )}

            {mode === 'report' && (
              <form onSubmit={handleReportSubmit} className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-white/60 uppercase tracking-wider">
                    Reason for Report
                  </label>
                  <select
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-white/[0.06] border border-white/10 text-xs text-white focus:outline-none focus:border-red-500"
                  >
                    <option value="Inappropriate Imagery" className="bg-[#1c1c1c]">Inappropriate / NSFW Imagery</option>
                    <option value="Spam or Deceptive" className="bg-[#1c1c1c]">Spam or Deceptive Post</option>
                    <option value="Harassment" className="bg-[#1c1c1c]">Harassment or Hate Speech</option>
                    <option value="Fake Vehicle Photo" className="bg-[#1c1c1c]">Fake / Stolen Vehicle Photo</option>
                    <option value="Other" className="bg-[#1c1c1c]">Other Policy Violation</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-white/60 uppercase tracking-wider">
                    Additional Context (Optional)
                  </label>
                  <textarea
                    rows={2}
                    value={reportDetails}
                    onChange={(e) => setReportDetails(e.target.value)}
                    placeholder="Provide additional details..."
                    className="w-full p-2.5 rounded-xl bg-white/[0.06] border border-white/10 text-xs text-white placeholder-white/30 resize-none focus:outline-none focus:border-red-500"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setMode('menu')}
                    className="flex-1 py-2 rounded-xl bg-white/[0.06] text-white/70 hover:text-white text-xs font-semibold"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2 rounded-xl bg-[#E50914] text-white text-xs font-bold shadow-md hover:bg-[#DC2626]"
                  >
                    Submit Report
                  </button>
                </div>
              </form>
            )}

            {mode === 'block_confirm' && (
              <div className="space-y-3 text-center">
                <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto" />
                <h4 className="text-sm font-bold text-white">Block @{targetUsername}?</h4>
                <p className="text-xs text-white/60 leading-relaxed max-w-xs mx-auto">
                  You will no longer see posts, comments, or direct messages from @{targetUsername}. They will not be notified.
                </p>

                <div className="flex gap-2 pt-3">
                  <button
                    onClick={() => setMode('menu')}
                    className="flex-1 py-2.5 rounded-xl bg-white/[0.06] text-white/70 hover:text-white text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmBlock}
                    className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-md"
                  >
                    Confirm Block
                  </button>
                </div>
              </div>
            )}

            {mode === 'success' && (
              <div className="py-6 text-center space-y-2">
                <CheckCircle className="w-10 h-10 text-emerald-400 mx-auto animate-bounce" />
                <p className="text-xs text-white/80 font-medium px-2 leading-relaxed">
                  {statusMessage}
                </p>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
