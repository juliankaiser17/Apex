import React, { useState, useEffect } from 'react';
import { 
  Flame, 
  Trophy, 
  Users, 
  User, 
  UserPlus, 
  X, 
  Check, 
  Clock, 
  Plus, 
  MessageSquare,
  Search
} from 'lucide-react';
import { useApexStore } from '../../store/useApexStore';
import type { FeedPost, CarCard } from '../../types/apex';
import { CommentsModal } from './CommentsModal';
import { PaperThrowFeed } from './PaperThrowFeed';
import { MediaPostComposerModal } from './MediaPostComposerModal';
import { PublicProfileModal } from '../profile/PublicProfileModal';
import { DirectMessageModal } from './DirectMessageModal';
import { SpatialCreationSheet } from './SpatialCreationSheet';
import { RanksScreen } from '../ranks/RanksScreen';
import { ProfileScreen } from '../profile/ProfileScreen';
import { sounds } from '../../utils/audio';
import { hapticImpact, hapticTap } from '../../utils/haptics';
import { Button } from '../ui/Button';

interface SocialScreenProps {
  initialSubTab?: 'activity' | 'leaderboard' | 'friends' | 'profile';
}

export const SocialScreen: React.FC<SocialScreenProps> = ({ initialSubTab = 'activity' }) => {
  const feedPosts = useApexStore(s => s.feedPosts);
  const friends = useApexStore(s => s.friends);
  const setScannerOpen = useApexStore(s => s.setScannerOpen);
  const incomingRequests = useApexStore(s => s.incomingRequests);
  const fetchFriendRequests = useApexStore(s => s.fetchFriendRequests);
  const sendFriendRequest = useApexStore(s => s.sendFriendRequest);
  const acceptFriendRequest = useApexStore(s => s.acceptFriendRequest);
  const denyFriendRequest = useApexStore(s => s.denyFriendRequest);
  const setSelectedCardForDetail = useApexStore(s => s.setSelectedCardForDetail);

  const [subTab, setSubTab] = useState<'activity' | 'leaderboard' | 'friends' | 'profile'>(initialSubTab);
  const [, setSelectedCard] = useState<CarCard | null>(null);
  const [selectedPostForComments, setSelectedPostForComments] = useState<FeedPost | null>(null);
  const [friendSearch, setFriendSearch] = useState('');

  // Creation & Modals
  const [isCreationSheetOpen, setIsCreationSheetOpen] = useState(false);
  const [isMediaComposerOpen, setIsMediaComposerOpen] = useState(false);
  const [composerInitialPhoto, setComposerInitialPhoto] = useState<string | null>(null);
  const [selectedUserForProfile, setSelectedUserForProfile] = useState<{ userId?: string; username?: string } | null>(null);
  const [activeConversationUser, setActiveConversationUser] = useState<{ id: string; username: string; displayName: string; avatarUrl: string; level: number } | null>(null);

  // Add Friend Modal State
  const [isAddFriendModalOpen, setIsAddFriendModalOpen] = useState(false);
  const [targetUsernameInput, setTargetUsernameInput] = useState('');
  const [friendModalFeedback, setFriendModalFeedback] = useState<{ type: 'success' | 'error' | ''; message: string }>({ type: '', message: '' });
  const [isSearchingFriend, setIsSearchingFriend] = useState(false);

  useEffect(() => {
    if (initialSubTab) {
      setSubTab(initialSubTab);
    }
  }, [initialSubTab]);

  useEffect(() => {
    fetchFriendRequests();
  }, [subTab, fetchFriendRequests]);

  const handleSendFriendRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanHandle = targetUsernameInput.trim().replace(/^@/, '').toLowerCase();
    if (!cleanHandle) return;

    setIsSearchingFriend(true);
    setFriendModalFeedback({ type: '', message: '' });

    try {
      const res = await sendFriendRequest(cleanHandle);
      if (res.success) {
        setFriendModalFeedback({ 
          type: 'success', 
          message: `Friend request sent to @${cleanHandle}!` 
        });
        setTargetUsernameInput('');
        fetchFriendRequests();
      } else {
        setFriendModalFeedback({ 
          type: 'error', 
          message: res.error || `Could not find @${cleanHandle}.` 
        });
      }
    } catch (err: any) {
      setFriendModalFeedback({ 
        type: 'error', 
        message: err?.message || `Failed to send friend request to @${cleanHandle}.` 
      });
    } finally {
      setIsSearchingFriend(false);
    }
  };

  // Filter out seeded mock posts in production
  const activeFeedPosts = feedPosts.filter(p => {
    if (import.meta.env.PROD && (p.id.startsWith('mock_') || p.id.startsWith('sample_'))) {
      return false;
    }
    return true;
  });

  return (
    <>
      {subTab === 'activity' ? (
        <div className="fixed inset-0 top-[calc(var(--sat,28px)+54px)] bottom-[74px] z-10 w-full bg-[var(--color-void)] overflow-hidden select-none font-sans">
          {/* Single Clean Chrome Row (Top Bar over feed) */}
          <div className="absolute top-2.5 left-3 right-3 z-50 max-w-sm mx-auto flex items-center justify-between pointer-events-auto">
            {/* 3-Tab Pill Switcher: Feed | Ranks | Friends */}
            <div className="flex bg-[var(--color-panel)]/90 backdrop-blur-xl p-1 rounded-[var(--radius-button)] border border-[var(--color-line)] shadow-xl">
              {[
                { id: 'activity', label: 'Feed', icon: Flame, badge: 0 },
                { id: 'leaderboard', label: 'Ranks', icon: Trophy, badge: 0 },
                { id: 'friends', label: 'Friends', icon: Users, badge: incomingRequests.length },
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = subTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      sounds.playTargetLock();
                      setSubTab(tab.id as any);
                    }}
                    className={`py-1.5 px-3 rounded-[var(--radius-chip)] text-caption font-semibold flex items-center gap-1.5 transition-all relative active:scale-95 cursor-pointer ${
                      isActive
                        ? 'bg-[var(--color-panel-2)] text-[var(--color-text)] shadow-sm'
                        : 'text-[var(--color-text-3)] hover:text-[var(--color-text)]'
                    }`}
                  >
                    <Icon size={14} className={isActive ? 'text-[var(--color-xp)]' : ''} />
                    <span>{tab.label}</span>
                    {tab.badge > 0 && (
                      <span className="w-4 h-4 rounded-full bg-[var(--accent-color)] text-white text-[9px] font-bold flex items-center justify-center">
                        {tab.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* + Button for Standalone Media Post Creation */}
            <button
              onClick={() => {
                hapticImpact('medium');
                sounds.playTargetLock();
                setIsCreationSheetOpen(true);
              }}
              aria-label="Create Post"
              className="w-10 h-10 rounded-[var(--radius-button)] flex items-center justify-center text-white shadow-xl active:scale-90 transition-all border border-white/20 shrink-0 bg-[var(--accent-color)] hover:brightness-110 cursor-pointer"
              title="Create Post"
            >
              <Plus size={18} />
            </button>
          </div>

          {/* Full-Screen Reels Discovery Feed */}
          <PaperThrowFeed
            posts={activeFeedPosts}
            onOpenCardDetail={(card) => {
              setSelectedCard(card);
              setSelectedCardForDetail(card);
            }}
            onOpenComments={(post) => setSelectedPostForComments(post)}
            onOpenProfile={(userId, username) => setSelectedUserForProfile({ userId, username })}
            onOpenScanner={() => setScannerOpen(true)}
          />
        </div>
      ) : (
        <div className="flex-1 w-full pb-36 px-4 pt-2 space-y-4 font-sans bg-[var(--color-void)] max-w-lg mx-auto select-none">
          {/* Top Single Chrome Row for non-feed tabs */}
          <div className="flex items-center gap-2">
            <div className="flex-1 flex bg-[var(--color-panel)] p-1 rounded-[var(--radius-button)] border border-[var(--color-line)]">
              {[
                { id: 'activity', label: 'Feed', icon: Flame, badge: 0 },
                { id: 'leaderboard', label: 'Ranks', icon: Trophy, badge: 0 },
                { id: 'friends', label: 'Friends', icon: Users, badge: incomingRequests.length },
                { id: 'profile', label: 'Profile', icon: User, badge: 0 },
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = subTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      hapticTap();
                      sounds.playTargetLock();
                      setSubTab(tab.id as any);
                    }}
                    className={`flex-1 py-1.5 rounded-[var(--radius-chip)] text-caption font-semibold flex items-center justify-center gap-1.5 transition-all relative cursor-pointer ${
                      isActive
                        ? 'bg-[var(--color-panel-2)] text-[var(--color-text)] shadow-sm'
                        : 'text-[var(--color-text-3)] hover:text-[var(--color-text)]'
                    }`}
                  >
                    <Icon size={14} className={isActive ? 'text-[var(--color-xp)]' : ''} />
                    <span>{tab.label}</span>
                    {tab.badge > 0 && (
                      <span className="w-4 h-4 rounded-full bg-[var(--accent-color)] text-white text-[9px] font-bold flex items-center justify-center">
                        {tab.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* + Button for Post Creation */}
            <button
              onClick={() => {
                hapticImpact('medium');
                sounds.playTargetLock();
                setIsCreationSheetOpen(true);
              }}
              aria-label="Create Post"
              className="w-10 h-10 rounded-[var(--radius-button)] flex items-center justify-center text-white shadow-xl active:scale-90 transition-all border border-white/20 shrink-0 bg-[var(--accent-color)] hover:brightness-110 cursor-pointer"
            >
              <Plus size={18} />
            </button>
          </div>

          {/* SUB-TAB: LEADERBOARD */}
          {subTab === 'leaderboard' && (
            <RanksScreen
              onOpenProfile={(userId, username) => setSelectedUserForProfile({ userId, username })}
            />
          )}

          {/* SUB-TAB: USER PROFILE */}
          {subTab === 'profile' && (
            <ProfileScreen />
          )}

          {/* SUB-TAB: FRIENDS */}
          {subTab === 'friends' && (
            <div className="space-y-4">
              {/* Friends Header & Add Friend CTA */}
              <div className="p-4 rounded-[var(--radius-panel)] border border-[var(--color-line)] bg-[var(--color-panel)] flex items-center justify-between">
                <div>
                  <h3 className="font-display text-display-m text-[var(--color-text)] uppercase leading-none">
                    Spotter Friends
                  </h3>
                  <p className="font-mono text-caption text-[var(--color-text-3)] mt-0.5">
                    {friends.length} confirmed connections
                  </p>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    hapticTap();
                    setIsAddFriendModalOpen(true);
                  }}
                >
                  <UserPlus size={14} />
                  <span>Add Friend</span>
                </Button>
              </div>

              {/* Friend Search Bar */}
              {friends.length > 3 && (
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-3 text-[var(--color-text-3)]" />
                  <input
                    type="text"
                    value={friendSearch}
                    onChange={(e) => setFriendSearch(e.target.value)}
                    placeholder="Search friends by name or handle..."
                    className="w-full bg-[var(--color-panel)] border border-[var(--color-line)] rounded-[var(--radius-button)] pl-9 pr-4 py-2 text-secondary text-[var(--color-text)] placeholder-[var(--color-text-3)] focus:border-[var(--color-text-2)] outline-none"
                  />
                </div>
              )}

              {/* Incoming Friend Requests */}
              {incomingRequests.length > 0 && (
                <div className="p-4 rounded-[var(--radius-panel)] border border-amber-500/30 bg-amber-500/10 space-y-3">
                  <div className="flex items-center gap-1.5 font-mono text-caption font-bold text-amber-300 uppercase tracking-wider">
                    <Clock size={13} />
                    <span>Pending Requests ({incomingRequests.length})</span>
                  </div>

                  <div className="space-y-2">
                    {incomingRequests.map((req) => (
                      <div
                        key={req.id}
                        className="p-3 rounded-[var(--radius-panel)] bg-[var(--color-panel)] border border-[var(--color-line)] flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2.5">
                          <img
                            src={req.fromAvatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=400'}
                            alt={req.fromUsername}
                            className="w-9 h-9 rounded-full object-cover border border-[var(--color-line)]"
                          />
                          <div>
                            <span className="font-semibold text-secondary text-[var(--color-text)] block">
                              {req.fromDisplayName}
                            </span>
                            <span className="font-mono text-caption text-[var(--color-text-3)]">
                              @{req.fromUsername} · Lvl {req.fromLevel}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={async () => {
                              hapticTap();
                              await acceptFriendRequest(req.id);
                            }}
                            className="p-2 rounded-[var(--radius-chip)] bg-[var(--color-ok)]/20 border border-[var(--color-ok)]/30 text-[var(--color-ok)] hover:bg-[var(--color-ok)]/30 cursor-pointer"
                            title="Accept"
                          >
                            <Check size={14} />
                          </button>
                          <button
                            onClick={async () => {
                              hapticTap();
                              await denyFriendRequest(req.id);
                            }}
                            className="p-2 rounded-[var(--radius-chip)] bg-[var(--color-danger)]/20 border border-[var(--color-danger)]/40 text-[var(--color-danger)] hover:bg-[var(--color-danger)]/30 cursor-pointer"
                            title="Decline"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Confirmed Friends List */}
              {friends.length > 0 ? (
                <div className="rounded-[var(--radius-panel)] border border-[var(--color-line)] bg-[var(--color-panel)] divide-y divide-[var(--color-line)] overflow-hidden">
                  {friends
                    .filter(f => f.username.toLowerCase().includes(friendSearch.toLowerCase()) || f.displayName.toLowerCase().includes(friendSearch.toLowerCase()))
                    .map((friend) => (
                      <div
                        key={friend.username}
                        className="p-3.5 flex items-center justify-between hover:bg-[var(--color-panel-2)] transition-colors"
                      >
                        <div
                          onClick={() => setSelectedUserForProfile({ userId: friend.id, username: friend.username })}
                          className="flex items-center gap-3 cursor-pointer group min-w-0"
                        >
                          <img
                            src={friend.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=400'}
                            alt={friend.username}
                            className="w-10 h-10 rounded-full object-cover border border-[var(--color-line)] group-hover:border-[var(--color-xp)] transition-colors shrink-0"
                          />
                          <div className="min-w-0">
                            <span className="font-semibold text-secondary text-[var(--color-text)] group-hover:text-[var(--color-xp)] transition-colors truncate block">
                              {friend.displayName}
                            </span>
                            <span className="font-mono text-caption text-[var(--color-text-3)] truncate block">
                              @{friend.username} · Level {friend.level} {friend.city ? `· ${friend.city}` : ''}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => setActiveConversationUser(friend)}
                            className="p-2 rounded-[var(--radius-chip)] bg-[var(--color-panel-2)] border border-[var(--color-line)] text-[var(--color-text-2)] hover:text-[var(--color-text)] cursor-pointer"
                            title="Message"
                          >
                            <MessageSquare size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="p-8 rounded-[var(--radius-panel)] border border-[var(--color-line)] bg-[var(--color-panel)] text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-[var(--color-panel-2)] border border-[var(--color-line)] flex items-center justify-center mx-auto text-[var(--color-text-3)]">
                    <Users size={20} />
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-display text-display-m text-[var(--color-text)]">
                      No Friends Added Yet
                    </h4>
                    <p className="text-secondary text-[var(--color-text-3)] max-w-xs mx-auto">
                      Connect with spotters to compare sightings and compete on friend leaderboards.
                    </p>
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setIsAddFriendModalOpen(true)}
                  >
                    <UserPlus size={14} />
                    <span>Send Friend Request</span>
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Add Friend Modal */}
      {isAddFriendModalOpen && (
        <div className="fixed inset-0 z-50 bg-[var(--color-void)]/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[var(--color-panel)] border border-[var(--color-line)] rounded-[var(--radius-panel)] p-6 space-y-4 shadow-2xl relative">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--color-line)]">
              <h3 className="font-display text-display-m text-[var(--color-text)] uppercase">
                Send Friend Request
              </h3>
              <button
                onClick={() => {
                  setIsAddFriendModalOpen(false);
                  setFriendModalFeedback({ type: '', message: '' });
                }}
                className="w-7 h-7 rounded-full bg-[var(--color-panel-2)] border border-[var(--color-line)] flex items-center justify-center text-[var(--color-text-3)] hover:text-[var(--color-text)] cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>

            <form onSubmit={handleSendFriendRequest} className="space-y-3">
              <div>
                <label className="font-mono text-caption text-[var(--color-text-3)] uppercase block mb-1">
                  Spotter Username
                </label>
                <input
                  type="text"
                  value={targetUsernameInput}
                  onChange={(e) => setTargetUsernameInput(e.target.value)}
                  placeholder="Enter @username"
                  className="w-full bg-[var(--color-panel-2)] border border-[var(--color-line)] rounded-[var(--radius-button)] px-3 py-2 text-secondary text-[var(--color-text)] placeholder-[var(--color-text-3)] focus:border-[var(--color-text-2)] outline-none font-mono"
                  autoFocus
                />
              </div>

              {friendModalFeedback.message && (
                <p className={`text-caption font-semibold ${
                  friendModalFeedback.type === 'success' ? 'text-[var(--color-ok)]' : 'text-[var(--color-danger)]'
                }`}>
                  {friendModalFeedback.message}
                </p>
              )}

              <Button
                variant="primary"
                type="submit"
                disabled={isSearchingFriend || !targetUsernameInput.trim()}
                className="w-full"
              >
                {isSearchingFriend ? 'Sending...' : 'Send Request'}
              </Button>
            </form>
          </div>
        </div>
      )}

      {/* Creation Sheet & Modals */}
      <SpatialCreationSheet
        isOpen={isCreationSheetOpen}
        onClose={() => setIsCreationSheetOpen(false)}
        onOpenScanner={() => {
          setIsCreationSheetOpen(false);
          setScannerOpen(true);
        }}
        onOpenMediaComposer={(photoUrl) => {
          setIsCreationSheetOpen(false);
          setComposerInitialPhoto(photoUrl || null);
          setIsMediaComposerOpen(true);
        }}
      />

      <MediaPostComposerModal
        isOpen={isMediaComposerOpen}
        onClose={() => {
          setIsMediaComposerOpen(false);
          setComposerInitialPhoto(null);
        }}
        initialPhotoUrl={composerInitialPhoto}
      />

      {/* Comments Modal */}
      {selectedPostForComments && (
        <CommentsModal
          post={selectedPostForComments}
          onClose={() => setSelectedPostForComments(null)}
          onOpenProfile={(userId, username) => setSelectedUserForProfile({ userId, username })}
        />
      )}

      {/* Public Profile Modal */}
      {selectedUserForProfile && (
        <PublicProfileModal
          isOpen={selectedUserForProfile !== null}
          onClose={() => setSelectedUserForProfile(null)}
          userId={selectedUserForProfile.userId}
          username={selectedUserForProfile.username}
        />
      )}

      {/* Direct Messaging Modal */}
      {activeConversationUser && (
        <DirectMessageModal
          isOpen={activeConversationUser !== null}
          onClose={() => setActiveConversationUser(null)}
          recipient={activeConversationUser}
          onOpenProfile={(userId, username) => setSelectedUserForProfile({ userId, username })}
        />
      )}
    </>
  );
};

SocialScreen.displayName = 'SocialScreen';
