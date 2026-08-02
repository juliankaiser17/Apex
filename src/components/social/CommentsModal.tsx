import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, Heart, MessageSquare } from 'lucide-react';
import { useApexStore } from '../../store/useApexStore';
import type { FeedPost } from '../../types/apex';
import { RARITY_CONFIG } from '../../utils/rarity';

interface CommentsModalProps {
  post: FeedPost | null;
  onClose: () => void;
}

export const CommentsModal: React.FC<CommentsModalProps> = ({ post, onClose }) => {
  const { user, addCommentToPost, toggleLikeComment } = useApexStore();
  const [commentText, setCommentText] = useState('');

  if (!post) return null;

  const comments = post.comments || [];
  const conf = RARITY_CONFIG[post.card.rarity];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    addCommentToPost(post.id, commentText);
    setCommentText('');
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 bg-[#080808]/85 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 select-none" style={{ fontFamily: 'DM Sans' }}>
        {/* Backdrop click to dismiss */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0"
        />

        {/* Modal Container */}
        <motion.div
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 250 }}
          className="relative z-10 w-full max-w-md bg-[#111111] border border-[#FF4500]/40 rounded-t-xl sm:rounded-xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl glow-orange"
        >
          {/* Top Bar */}
          <div className="p-4 border-b border-[#2C2C2C] flex items-center justify-between bg-[#080808]">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-[#FF4500]" />
              <h3 className="font-display text-xl text-[#F0EBE3] tracking-wide">
                SPOTTER DISCUSSION ({post.commentsCount})
              </h3>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full bg-[#1A1A1A] text-[#9A9088] hover:text-[#F0EBE3] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Post Summary Header */}
          <div className="p-3 bg-[#1A1A1A] border-b border-[#2C2C2C] flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 overflow-hidden">
              <img src={post.card.imageUrl} alt={post.card.model} className="w-12 h-12 rounded-lg object-cover border border-[#2C2C2C] shrink-0" />
              <div className="truncate">
                <h4 className="font-display text-base text-[#F0EBE3] truncate">{post.card.make} {post.card.model}</h4>
                <p className="text-[11px] font-data text-[#9A9088] truncate">Spotted by @{post.user.username} in {post.card.city}</p>
              </div>
            </div>
            <span className={`text-[9px] font-data font-semibold px-2 py-0.5 rounded border shrink-0 ${conf.badgeBg}`}>
              {conf.label}
            </span>
          </div>

          {/* Comments List Area */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3 max-h-[45vh] no-scrollbar">
            {comments.length === 0 ? (
              <div className="text-center py-8 text-[#9A9088] space-y-1">
                <p className="font-display text-lg text-[#F0EBE3]">NO COMMENTS YET</p>
                <p className="text-xs">Be the first spotter to start the discussion!</p>
              </div>
            ) : (
              comments.map((c) => (
                <div key={c.id} className="p-3 rounded-lg bg-[#1A1A1A] border border-[#2C2C2C] space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <img src={c.user.avatarUrl} alt={c.user.username} className="w-6 h-6 rounded-full object-cover border border-[#2C2C2C]" />
                      <span className="text-xs font-semibold text-[#F0EBE3]">@{c.user.username}</span>
                      <span className="text-[9px] font-data text-[#FF4500] bg-[#080808] px-1.5 py-0.5 rounded border border-[#FF4500]/30">Lvl {c.user.level}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-data text-[#9A9088]">{c.createdAt}</span>
                      <button
                        onClick={() => toggleLikeComment(post.id, c.id)}
                        className={`flex items-center gap-1 text-xs transition-colors ${c.isLiked ? 'text-[#FF2200]' : 'text-[#9A9088] hover:text-[#F0EBE3]'}`}
                      >
                        <Heart className={`w-3.5 h-3.5 ${c.isLiked ? 'fill-[#FF2200]' : ''}`} />
                        <span className="text-[10px] font-data">{c.likesCount}</span>
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-[#F0EBE3] leading-relaxed pl-8">{c.text}</p>
                </div>
              ))
            )}
          </div>

          {/* Comment Submission Bar */}
          <form onSubmit={handleSubmit} className="p-3 bg-[#080808] border-t border-[#2C2C2C] flex items-center gap-2">
            <input
              type="text"
              placeholder={`Add a comment as @${user.username}...`}
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              className="flex-1 bg-[#1A1A1A] border border-[#2C2C2C] rounded-lg px-4 py-2.5 text-xs text-[#F0EBE3] placeholder-[#5A5550] focus:outline-none focus:border-[#FF4500]"
            />
            <button
              type="submit"
              disabled={!commentText.trim()}
              className={`p-2.5 rounded-lg text-[#F0EBE3] font-display text-sm flex items-center justify-center transition-all ${
                commentText.trim() 
                  ? 'bg-[#FF4500] glow-orange' 
                  : 'bg-[#1A1A1A] text-[#5A5550] cursor-not-allowed'
              }`}
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
