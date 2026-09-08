import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Send, 
  AlertCircle, 
  CheckCheck, 
  Clock 
} from 'lucide-react';
import { useApexStore } from '../../store/useApexStore';
import { supabase } from '../../lib/supabase';
import { sounds } from '../../utils/audio';
import { MessageBubbleSkeleton } from '../common/Skeleton';
import type { DirectMessage } from '../../types/apex';

interface RecipientUser {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  level: number;
}

interface DirectMessageModalProps {
  recipient: RecipientUser | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenProfile?: (userId: string, username: string) => void;
}

export const DirectMessageModal: React.FC<DirectMessageModalProps> = ({
  recipient,
  isOpen,
  onClose,
  onOpenProfile
}) => {
  const currentUser = useApexStore(s => s.user);

  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [isLoadingConv, setIsLoadingConv] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [keyboardOffset, setKeyboardOffset] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Track received message IDs and nonces to deduplicate realtime events
  const seenMessageIdsRef = useRef<Set<string>>(new Set());

  // ─── 1. VIRTUAL KEYBOARD OFFSET LISTENER ───
  useEffect(() => {
    if (!isOpen) return;

    const handleViewportChange = () => {
      if (!window.visualViewport) return;
      const vv = window.visualViewport;
      const offset = window.innerHeight - (vv.height + vv.offsetTop);
      setKeyboardOffset(Math.max(0, offset));
    };

    window.visualViewport?.addEventListener('resize', handleViewportChange);
    window.visualViewport?.addEventListener('scroll', handleViewportChange);

    return () => {
      window.visualViewport?.removeEventListener('resize', handleViewportChange);
      window.visualViewport?.removeEventListener('scroll', handleViewportChange);
    };
  }, [isOpen]);

  // ─── 2. ATOMIC DIRECT CONVERSATION INITIALIZATION & HISTORY LOAD ───
  useEffect(() => {
    if (!isOpen || !recipient?.id || !currentUser.id) {
      setConversationId(null);
      setMessages([]);
      setIsLoadingConv(false);
      return;
    }

    let isMounted = true;
    setIsLoadingConv(true);
    setErrorMessage(null);
    seenMessageIdsRef.current.clear();

    const initConversation = async () => {
      try {
        const isUuidRecipient = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(recipient.id);
        const isUuidUser = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(currentUser.id);

        if (!isUuidRecipient || !isUuidUser) {
          // Local direct channel for sample spotters / guest exploration
          const localConvId = `local_conv_${recipient.id}`;
          if (!isMounted) return;
          setConversationId(localConvId);
          try {
            const stored = localStorage.getItem(`apex_dm_${recipient.id}`);
            if (stored) {
              setMessages(JSON.parse(stored));
            } else {
              setMessages([]);
            }
          } catch (e) {
            setMessages([]);
          }
          return;
        }

        // 1. Call server-side RPC to authoritatively get or create the 2-person channel
        const { data: convRes, error: convErr } = await supabase.rpc(
          'get_or_create_direct_conversation',
          { p_recipient_id: recipient.id }
        );

        if (convErr || !convRes?.conversation_id) {
          throw new Error(convErr?.message || 'Failed to establish encrypted direct channel.');
        }

        const convId = convRes.conversation_id;
        if (!isMounted) return;
        setConversationId(convId);

        // 2. Fetch past message history
        const { data: messagesData, error: msgErr } = await supabase
          .from('messages')
          .select('id, conversation_id, sender_id, content, client_nonce, created_at, read_at')
          .eq('conversation_id', convId)
          .order('created_at', { ascending: true })
          .limit(50);

        if (msgErr) {
          throw new Error(msgErr.message);
        }

        if (isMounted && messagesData) {
          const loaded: DirectMessage[] = messagesData.map((m: any) => {
            seenMessageIdsRef.current.add(m.id);
            if (m.client_nonce) seenMessageIdsRef.current.add(m.client_nonce);
            return {
              id: m.id,
              conversationId: m.conversation_id,
              senderId: m.sender_id,
              content: m.content,
              clientNonce: m.client_nonce,
              createdAt: m.created_at,
              readAt: m.read_at
            };
          });
          setMessages(loaded);
          setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
          }, 100);
        }
      } catch (err: any) {
        console.error('Direct channel error:', err);
        if (isMounted) {
          if (err.message?.includes('Authentication required') || !currentUser.email) {
            setErrorMessage('Sign in to message this spotter.');
          } else {
            setErrorMessage(err.message || 'Unable to open messaging channel.');
          }
        }
      } finally {
        if (isMounted) setIsLoadingConv(false);
      }
    };

    initConversation();

    return () => {
      isMounted = false;
    };
  }, [isOpen, recipient?.id, currentUser.id]);

  // ─── 3. REALTIME SUBSCRIPTION (ZERO POLLING) ───
  useEffect(() => {
    if (!conversationId || conversationId.startsWith('local_conv_')) return;

    // Subscribe to messages in this conversation exclusively
    const channel = supabase
      .channel(`dm:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`
        },
        (payload) => {
          const newRow = payload.new as any;
          if (!newRow) return;

          // Deduplicate by DB ID or client nonce
          if (seenMessageIdsRef.current.has(newRow.id)) return;
          if (newRow.client_nonce && seenMessageIdsRef.current.has(newRow.client_nonce)) {
            // Replace optimistic message with confirmed server message
            setMessages(prev =>
              prev.map(m =>
                m.clientNonce === newRow.client_nonce
                  ? { ...m, id: newRow.id, createdAt: newRow.created_at, isOptimistic: false }
                  : m
              )
            );
            seenMessageIdsRef.current.add(newRow.id);
            return;
          }

          seenMessageIdsRef.current.add(newRow.id);
          if (newRow.client_nonce) seenMessageIdsRef.current.add(newRow.client_nonce);

          const incomingMsg: DirectMessage = {
            id: newRow.id,
            conversationId: newRow.conversation_id,
            senderId: newRow.sender_id,
            content: newRow.content,
            clientNonce: newRow.client_nonce,
            createdAt: newRow.created_at,
            readAt: newRow.read_at
          };

          sounds.playXpPop();
          setMessages(prev => [...prev, incomingMsg]);

          setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
          }, 60);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  // ─── 4. SEND MESSAGE WITH OPTIMISTIC STATE & DB PERSISTENCE ───
  const handleSendMessage = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanContent = messageInput.trim();
    if (!cleanContent || !conversationId || !currentUser.id || !recipient?.id || isSending) return;

    sounds.playTargetLock();
    setMessageInput('');
    setIsSending(true);

    const clientNonce = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    seenMessageIdsRef.current.add(clientNonce);

    // Optimistic message append
    const optimisticMessage: DirectMessage = {
      id: clientNonce,
      conversationId,
      senderId: currentUser.id,
      content: cleanContent,
      clientNonce,
      createdAt: new Date().toISOString(),
      isOptimistic: true
    };

    setMessages(prev => [...prev, optimisticMessage]);

    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 60);

    if (conversationId.startsWith('local_conv_')) {
      try {
        const stored = localStorage.getItem(`apex_dm_${recipient.id}`);
        const existing = stored ? JSON.parse(stored) : [];
        const confirmedMsg = { ...optimisticMessage, isOptimistic: false };
        localStorage.setItem(`apex_dm_${recipient.id}`, JSON.stringify([...existing, confirmedMsg]));
      } catch (e) {}
      setIsSending(false);
      return;
    }

    try {
      // Direct insert into messages table protected by RLS
      const { data, error } = await supabase
        .from('messages')
        .insert([{
          conversation_id: conversationId,
          sender_id: currentUser.id,
          content: cleanContent,
          client_nonce: clientNonce
        }])
        .select('id, created_at')
        .single();

      if (error) throw error;

      if (data) {
        seenMessageIdsRef.current.add(data.id);
        setMessages(prev =>
          prev.map(m =>
            m.clientNonce === clientNonce
              ? { ...m, id: data.id, createdAt: data.created_at, isOptimistic: false }
              : m
          )
        );
      }
    } catch (err: any) {
      console.error('Failed to send direct message:', err);
      // Mark as failed rather than losing user content
      setMessages(prev =>
        prev.map(m =>
          m.clientNonce === clientNonce
            ? { ...m, hasFailed: true, isOptimistic: false }
            : m
        )
      );
    } finally {
      setIsSending(false);
    }
  }, [messageInput, conversationId, currentUser.id, recipient?.id, isSending]);

  if (!isOpen || !recipient) return null;

  return createPortal(
    <AnimatePresence>
      <div 
        className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-md flex flex-col justify-end select-none font-sans"
      >
        {/* Backdrop dismiss */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0"
        />

        {/* Messaging Container */}
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 28, stiffness: 320 }}
          className="relative z-10 w-full max-w-lg mx-auto bg-[#111111] border-t border-x border-white/15 rounded-t-[28px] flex flex-col overflow-hidden shadow-2xl"
          style={{
            height: '92dvh',
            maxHeight: '94dvh',
            marginBottom: `${keyboardOffset}px`,
            transition: keyboardOffset > 0 ? 'none' : 'margin-bottom 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
          }}
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between bg-[#141414] shrink-0">
            <button
              onClick={() => {
                onClose();
                onOpenProfile?.(recipient.id, recipient.username);
              }}
              className="flex items-center gap-3 text-left group min-h-[44px]"
            >
              <div className="relative">
                <img
                  src={recipient.avatarUrl}
                  alt={recipient.username}
                  className="w-10 h-10 rounded-full object-cover border border-white/20 group-hover:border-[#E50914] transition-colors"
                />
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 absolute bottom-0 right-0 border-2 border-black" />
              </div>

              <div>
                <h3 className="font-bold text-sm text-white group-hover:text-[#E50914] transition-colors leading-tight">
                  {recipient.displayName}
                </h3>
                <div className="flex items-center gap-1.5 text-[11px] text-white/50">
                  <span>@{recipient.username}</span>
                  <span>·</span>
                  <span className="text-[#E50914] font-semibold">Lvl {recipient.level}</span>
                </div>
              </div>
            </button>

            <button
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-white/10 text-white/60 hover:text-white transition-colors flex items-center justify-center min-h-[44px] min-w-[44px]"
              aria-label="Close messaging"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Messages Stream */}
          <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3 no-scrollbar overscroll-contain">
            {isLoadingConv ? (
              <div className="space-y-4 py-2">
                <MessageBubbleSkeleton isOutgoing={false} />
                <MessageBubbleSkeleton isOutgoing={true} />
                <MessageBubbleSkeleton isOutgoing={false} />
                <MessageBubbleSkeleton isOutgoing={true} />
              </div>
            ) : errorMessage ? (
              <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/30 text-red-200 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center py-20 text-white/40 space-y-3 px-4">
                <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-white/40">
                  <Send className="w-6 h-6 text-white/60" />
                </div>
                <div>
                  <p className="font-bold text-sm text-white">Direct Transmission</p>
                  <p className="text-xs text-white/50 max-w-xs mx-auto mt-1">
                    Start a conversation with @{recipient.username}. End-to-end realtime delivery active.
                  </p>
                </div>
              </div>
            ) : (
              messages.map((m) => {
                const isMe = m.senderId === currentUser.id;
                const formattedTime = new Date(m.createdAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit'
                });

                return (
                  <div
                    key={m.id}
                    className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-[78%] px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed break-words shadow-md ${
                        isMe
                          ? 'bg-[#E50914] text-white rounded-br-xs'
                          : 'bg-[#1c1c1c] text-white/95 border border-white/10 rounded-bl-xs'
                      }`}
                    >
                      {m.content}
                    </div>

                    <div className="flex items-center gap-1 mt-1 px-1 text-[10px] text-white/40">
                      <span>{formattedTime}</span>
                      {isMe && (
                        m.isOptimistic ? (
                          <Clock className="w-2.5 h-2.5 text-white/40" />
                        ) : m.hasFailed ? (
                          <span className="text-red-400 font-semibold flex items-center gap-0.5">
                            <AlertCircle className="w-2.5 h-2.5" /> Failed
                          </span>
                        ) : (
                          <CheckCheck className="w-3 h-3 text-white/70" />
                        )
                      )}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Bottom Message Input Composer */}
          <form
            onSubmit={handleSendMessage}
            className="p-3 bg-[#0c0c0c] border-t border-white/10 flex items-center gap-2.5 shrink-0"
            style={{
              paddingBottom: keyboardOffset > 0 ? '12px' : 'max(14px, env(safe-area-inset-bottom, 14px))'
            }}
          >
            <input
              ref={inputRef}
              type="text"
              placeholder={`Message @${recipient.username}...`}
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              disabled={isLoadingConv || Boolean(errorMessage)}
              maxLength={2000}
              className="flex-1 bg-[#1a1a1a] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-white/40 focus:outline-none focus:border-[#E50914] focus:ring-1 focus:ring-[#E50914] transition-all min-h-[44px]"
            />
            <button
              type="submit"
              disabled={!messageInput.trim() || isSending || isLoadingConv}
              aria-label="Send message"
              className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all active:scale-95 shrink-0 ${
                messageInput.trim() && !isSending
                  ? 'bg-[#E50914] text-white shadow-md shadow-red-950/40 hover:bg-[#ff1a25]'
                  : 'bg-white/10 text-white/30 cursor-not-allowed'
              }`}
            >
              <Send className={`w-4 h-4 transition-transform duration-150 ${isSending ? 'translate-x-1 -translate-y-1 opacity-60' : ''}`} />
            </button>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
};
