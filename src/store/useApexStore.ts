import { create } from 'zustand';
import type { UserProfile, CarCard, Hunt, DailyQuest, Mission, Badge, FeedPost, PostComment, LeaderboardEntry, Persona, PrivacyLevel } from '../types/apex';
import { getLevelFromXp, calculateScanXp } from '../utils/rarity';
import { sounds } from '../utils/audio';
import { supabase } from '../lib/supabase';

// PERSISTENT GLOBAL EVENT EXPIRATION TIMESTAMPS (Never reset on tab switch!)
export const GLOBAL_QUEST_EXPIRES_AT = Date.now() + 3 * 3600 * 1000 + 47 * 60 * 1000 + 22 * 1000;
export const GLOBAL_EVENT_EXPIRES_AT = Date.now() + 14 * 3600 * 1000 + 32 * 60 * 1000 + 9 * 1000;

interface ApexState {
  // Navigation & Modals
  activeTab: 'home' | 'map' | 'garage' | 'social' | 'profile';
  scannerOpen: boolean;
  onboardingCompleted: boolean;
  enthusiastModalOpen: boolean;
  activeHuntAlert: Hunt | null;
  activeHuntModal: Hunt | null;
  selectedCardForDetail: CarCard | null;
  locationDisplayMode: 'exact' | 'radius';

  // User Profile
  setLocationDisplayMode: (mode: 'exact' | 'radius') => void;

  user: UserProfile;

  // Collection & Content
  garage: CarCard[];
  activeHunts: Hunt[];
  dailyQuests: DailyQuest[];
  dailyMissions: Mission[];
  badges: Badge[];
  feedPosts: FeedPost[];
  leaderboards: LeaderboardEntry[];
  liveEventExpiresAt: number;

  settingsModalOpen: boolean;
  setSettingsModalOpen: (open: boolean) => void;
  updateUserProfile: (profile: Partial<UserProfile>) => void;
  logoutUser: () => void;
  setActiveTab: (tab: 'home' | 'map' | 'garage' | 'social' | 'profile') => void;
  setScannerOpen: (open: boolean) => void;
  setPersona: (persona: Persona) => void;
  initializeSession: (userId: string) => Promise<void>;
  fetchFeedPosts: () => Promise<void>;
  completeOnboarding: () => void;
  addCardToGarage: (newCard: CarCard, customCaption?: string) => Promise<void>;
  addXp: (amount: number, reason?: string) => void;
  toggleLikePost: (postId: string) => void;
  addCommentToPost: (postId: string, text: string) => void;
  toggleLikeComment: (postId: string, commentId: string) => void;
  toggleEnthusiastModal: (open?: boolean) => void;
  setSelectedCardForDetail: (card: CarCard | null) => void;
  dismissHuntAlert: () => void;
  openHuntModal: (hunt: Hunt) => void;
  closeHuntModal: () => void;
  triggerMockHunt: (card: CarCard) => void;
  completeMission: (missionId: string) => void;
  levelUpLevel: number | null;
  dismissLevelUp: () => void;
  toggleAllowHunts: () => void;
  setDefaultPrivacyLevel: (level: PrivacyLevel) => void;
  resetDevelopmentState: () => void;
}

const INITIAL_USER: UserProfile = {
  id: 'user-apex-01',
  username: '',
  displayName: '',
  email: '',
  avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=400&auto=format&fit=crop',
  persona: 'unspecified',
  level: 1,
  xp: 0,
  coins: 0,
  streakDays: 0,
  streakLastAt: new Date().toISOString(),
  rankGlobal: 1,
  rankCountry: 1,
  rankCity: 1,
  city: 'Tokyo',
  country: 'Japan',
  latitude: 35.6762,
  longitude: 139.6503,
  countryCode: 'GLOBAL',
  isPremium: false,
  totalSpots: 0,
  rarestFind: 'common',
  badgesUnlocked: 0,
  citiesExplored: 0,
  allowHunts: true,
  defaultPrivacyLevel: 'public_blurred'
};

export const INITIAL_HUNTS: Hunt[] = [];

const INITIAL_QUESTS: DailyQuest[] = [
  {
    id: 'quest-daily-spotlight',
    title: 'Daily Spotlight: 3 Vehicle Scans',
    description: 'Spot and photograph 3 real vehicles in the wild before midnight.',
    targetCount: 3,
    currentCount: 0,
    xpReward: 500,
    coinReward: 100,
    badgeName: 'Apex Spotter',
    expiresInSeconds: 13642,
    expiresAtTimestamp: GLOBAL_QUEST_EXPIRES_AT,
    allowedMakes: [],
    isCompleted: false
  }
];

const INITIAL_MISSIONS: Mission[] = [
  { id: 'm1', title: 'Scan 1 car today', xpReward: 50, completed: false, type: 'scan' },
  { id: 'm2', title: 'Identify 1 Rare or higher', xpReward: 100, completed: false, type: 'rarity' },
  { id: 'm3', title: 'Daily Login Bonus', xpReward: 25, completed: false, type: 'login' },
  { id: 'm4', title: 'Spot an SUV or Coupe', xpReward: 75, completed: false, type: 'body' },
  { id: 'm5', title: 'Scan a car you\'ve never seen', xpReward: 200, completed: false, type: 'new_car' }
];

const INITIAL_BADGES: Badge[] = [
  { id: 'b1', slug: 'first_blood', name: 'First Blood', description: 'Scanned your very first car card.', icon: 'Target', rarity: 'bronze', isUnlocked: false, xpBonus: 100 },
  { id: 'b2', slug: 'rare_encounter', name: 'Rare Encounter', description: 'Spotted a Rare rarity car in the wild.', icon: 'Zap', rarity: 'silver', isUnlocked: false, xpBonus: 250 },
  { id: 'b3', slug: 'das_auto', name: 'Das Auto', description: 'Spotted 3 German cars in a single day.', icon: 'Flag', rarity: 'silver', isUnlocked: false, xpBonus: 300 },
  { id: 'b4', slug: 'mythic_hunter', name: 'Mythic Hunter', description: 'Scanned an ultra-rare Mythic tier hypercar!', icon: 'Crown', rarity: 'diamond', isUnlocked: false, xpBonus: 1000 },
  { id: 'b5', slug: 'streak_7', name: '7-Day Spotter', description: 'Maintained a 7-day active scan streak.', icon: 'Flame', rarity: 'gold', isUnlocked: false, xpBonus: 500 },
  { id: 'b6', slug: 'jdm_royalty', name: 'JDM Royalty', description: 'Spot 10 iconic Japanese domestic market cars.', icon: 'Globe', rarity: 'gold', isUnlocked: false, xpBonus: 600 }
];

export const INITIAL_POSTS: FeedPost[] = [
  {
    id: 'post1',
    user: { id: 'test1', username: 'tokyo_drifter', avatarUrl: 'https://images.unsplash.com/photo-1511367461989-f85a21fda167?w=100&h=100&fit=crop', level: 12 },
    card: {
      id: 'c1', cardNumber: '#APX-001', make: 'Porsche', model: '911 GT3 RS', yearEstimate: '2023', color: 'Guards Red', rarity: 'legendary', rarityScore: 92,
      imageUrl: 'https://images.unsplash.com/photo-1503376713914-934394017a1e?w=800&q=80', city: 'Tokyo', country: 'Japan', latApprox: 35.6762, lngApprox: 139.6503,
      horsepower: 518, topSpeedKmH: 296, xpEarned: 250, createdAt: new Date(Date.now() - 3600000).toISOString(),
      bodyStyle: 'Coupe', originCountry: 'Germany', interestingFact: 'Nürburgring lap time of 6:49.328', briefHistory: '', modsDetected: [{part: 'Aero Kit', description: 'Carbon rear wing', confidence: 0.98}],
      marketValueLowUsd: 225000, marketValueHighUsd: 280000, scanValidated: true, isPublic: true, huntTriggered: false, privacyLevel: 'public_blurred', aiConfidence: 0.99
    },
    likesCount: 24, commentsCount: 5, isLiked: false, createdAt: new Date(Date.now() - 3600000).toISOString()
  },
  {
    id: 'post2',
    user: { id: 'test2', username: 'm_power_guy', avatarUrl: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=100&h=100&fit=crop', level: 8 },
    card: {
      id: 'c2', cardNumber: '#APX-002', make: 'BMW', model: 'M4 Competition', yearEstimate: '2024', color: 'Isle of Man Green', rarity: 'epic', rarityScore: 78,
      imageUrl: 'https://images.unsplash.com/photo-1617814076367-b759c7d7e738?w=800&q=80', city: 'London', country: 'UK', latApprox: 51.5072, lngApprox: -0.1276,
      horsepower: 503, topSpeedKmH: 290, xpEarned: 150, createdAt: new Date(Date.now() - 7200000).toISOString(),
      bodyStyle: 'Coupe', originCountry: 'Germany', interestingFact: 'Features a massive kidney grille.', briefHistory: '', modsDetected: [],
      marketValueLowUsd: 78000, marketValueHighUsd: 90000, scanValidated: true, isPublic: true, huntTriggered: false, privacyLevel: 'public_blurred', aiConfidence: 0.95
    },
    likesCount: 12, commentsCount: 1, isLiked: false, createdAt: new Date(Date.now() - 7200000).toISOString()
  }
];

const INITIAL_LEADERBOARD: LeaderboardEntry[] = [
  { rank: 1, username: 'you', displayName: 'You', avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=400&auto=format&fit=crop', xp: 0, level: 1, rankChange: 'same', isUser: true, rarestCard: 'None Yet' }
];

const getSavedUser = (): UserProfile => {
  try {
    const saved = localStorage.getItem('apex_user_session');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed === 'object' && (parsed.id || parsed.username || parsed.displayName)) {
        return {
          ...INITIAL_USER,
          ...parsed
        };
      }
    }
  } catch (e) {
    console.warn('Error reading saved user session:', e);
  }
  return INITIAL_USER;
};

const getSavedGarage = (): CarCard[] => {
  try {
    const saved = localStorage.getItem('apex_garage_cards');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.warn('Error reading saved garage cards:', e);
  }
  return [];
};

const getSavedOnboarding = (): boolean => {
  try {
    const saved = localStorage.getItem('apex_onboarding_v2_completed');
    if (saved !== null) return saved === 'true';
  } catch (e) {}
  return false;
};

export const useApexStore = create<ApexState>((set, get) => ({
  activeTab: 'home',
  scannerOpen: false,
  onboardingCompleted: getSavedOnboarding(),
  enthusiastModalOpen: false,
  activeHuntAlert: null,
  activeHuntModal: null,
  selectedCardForDetail: null,
  locationDisplayMode: 'radius',

  user: getSavedUser(),
  garage: getSavedGarage(),
  activeHunts: [],
  dailyQuests: INITIAL_QUESTS,
  dailyMissions: INITIAL_MISSIONS,
  badges: INITIAL_BADGES,
  feedPosts: INITIAL_POSTS,
  leaderboards: INITIAL_LEADERBOARD,
  liveEventExpiresAt: GLOBAL_EVENT_EXPIRES_AT,

  levelUpLevel: null,
  dismissLevelUp: () => set({ levelUpLevel: null }),

  settingsModalOpen: false,
  setSettingsModalOpen: (open) => set({ settingsModalOpen: open }),
  setLocationDisplayMode: (mode) => set({ locationDisplayMode: mode }),

  updateUserProfile: (profile) => set((state) => {
    const updatedUser = { ...state.user, ...profile };
    try {
      localStorage.setItem('apex_user_session', JSON.stringify(updatedUser));
    } catch (e) {}
    return { user: updatedUser };
  }),

  logoutUser: async () => {
    // Clear state synchronously first to prevent UI flashes
    set({
      onboardingCompleted: false,
      settingsModalOpen: false,
      user: {
        ...INITIAL_USER,
      },
      garage: []
    });
    localStorage.removeItem('apex_user_session');
    localStorage.removeItem('apex_onboarding_v2_completed');
    localStorage.removeItem('apex_onboarding_completed');
    localStorage.removeItem('apex_garage_cards');

    try {
      await supabase.auth.signOut({ scope: 'global' });
    } catch (e) {
      console.warn('Signout error', e);
    }
  },

  resetDevelopmentState: async () => {
    try {
      localStorage.clear();
    } catch (e) {}
    set({
      onboardingCompleted: false,
      settingsModalOpen: false,
      user: { ...INITIAL_USER },
      garage: [],
      activeHunts: [],
      dailyQuests: INITIAL_QUESTS,
      dailyMissions: INITIAL_MISSIONS,
      badges: INITIAL_BADGES,
    });
    try {
      await supabase.auth.signOut({ scope: 'global' });
    } catch (e) {}
  },

  setActiveTab: (tab) => set({ activeTab: tab }),

  setScannerOpen: (open) => set({ scannerOpen: open }),

  setPersona: (persona) => set((state) => ({ user: { ...state.user, persona } })),
  
  initializeSession: async (userId: string) => {
    try {
      const currentSaved = getSavedUser();
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
      const { data: garage } = await supabase.from('garage').select('*').eq('user_id', userId);
      
      if (profile) {
        const mergedUser: UserProfile = {
          ...INITIAL_USER,
          ...currentSaved,
          id: profile.id,
          username: profile.username || currentSaved.username || `hunter_${userId.substring(0, 6)}`,
          displayName: profile.display_name || currentSaved.displayName || 'Apex Hunter',
          avatarUrl: profile.avatar_url || currentSaved.avatarUrl || INITIAL_USER.avatarUrl,
          level: profile.level ?? currentSaved.level ?? 1,
          xp: profile.xp ?? currentSaved.xp ?? 0,
          coins: profile.coins ?? currentSaved.coins ?? 0,
          totalSpots: profile.total_spots ?? currentSaved.totalSpots ?? 0,
          rarestFind: (profile.rarest_find as any) || currentSaved.rarestFind || 'common',
          city: profile.city || currentSaved.city || 'Tokyo',
          country: profile.country || currentSaved.country || 'Japan',
          persona: (profile.persona as any) || currentSaved.persona || 'unspecified'
        };

        try {
          localStorage.setItem('apex_user_session', JSON.stringify(mergedUser));
          localStorage.setItem('apex_onboarding_v2_completed', 'true');
        } catch (e) {}

        set({
          user: mergedUser,
          garage: (garage && garage.length > 0) ? garage : getSavedGarage(),
          onboardingCompleted: true
        });
      } else {
        const fallbackUsername = currentSaved.username || `hunter_${userId.substring(0, 6)}`;
        const fallbackDisplayName = currentSaved.displayName || 'Apex Hunter';
        const fallbackProfile = {
          id: userId,
          username: fallbackUsername,
          display_name: fallbackDisplayName,
          level: currentSaved.level || 1,
          xp: currentSaved.xp || 0,
          coins: currentSaved.coins || 0,
          total_spots: currentSaved.totalSpots || 0,
          rarest_find: currentSaved.rarestFind || 'common',
          city: currentSaved.city || 'Tokyo',
          country: currentSaved.country || 'Japan'
        };

        try {
          await supabase.from('profiles').upsert([fallbackProfile]);
        } catch (e) {
          console.warn('Upsert fallback profile warning:', e);
        }

        const mergedUser: UserProfile = {
          ...INITIAL_USER,
          ...currentSaved,
          id: userId,
          username: fallbackUsername,
          displayName: fallbackDisplayName
        };

        try {
          localStorage.setItem('apex_user_session', JSON.stringify(mergedUser));
          localStorage.setItem('apex_onboarding_v2_completed', 'true');
        } catch (e) {}

        set({
          user: mergedUser,
          garage: getSavedGarage(),
          onboardingCompleted: true
        });
      }
      
      try {
        await get().fetchFeedPosts();
      } catch (e) {}
    } catch (e) {
      console.warn('Failed to initialize remote session, preserving local user state:', e);
      set({
        user: getSavedUser(),
        garage: getSavedGarage(),
        onboardingCompleted: getSavedOnboarding()
      });
    }
  },

  fetchFeedPosts: async () => {
    try {
      // Use standard Supabase syntax for joins without renaming
      const { data: postsData, error } = await supabase
        .from('posts')
        .select(`
          id, caption, likes_count, comments_count, created_at,
          profiles ( id, username, avatar_url, level ),
          garage ( * )
        `)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) {
        console.error("Error fetching feed posts:", error.message);
        return;
      }

      if (postsData) {
        const mappedPosts: FeedPost[] = postsData.map((p: any) => ({
          id: p.id,
          user: {
            id: p.profiles?.id || 'unknown',
            username: p.profiles?.username || 'unknown',
            avatarUrl: p.profiles?.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop',
            level: p.profiles?.level || 1
          },
          card: {
            id: p.garage?.id || 'unknown',
            cardNumber: p.garage?.card_number || '#APX-UNKNOWN',
            make: p.garage?.make || 'Unknown',
            model: p.garage?.model || 'Unknown',
            yearEstimate: p.garage?.year_estimate || 'Unknown',
            color: p.garage?.color || 'Unknown',
            rarity: p.garage?.rarity || 'common',
            rarityScore: 50,
            imageUrl: p.garage?.image_url || '',
            city: p.garage?.city || 'Unknown',
            country: p.garage?.country || 'Unknown',
            latApprox: p.garage?.latitude || 0,
            lngApprox: p.garage?.longitude || 0,
            horsepower: p.garage?.horsepower || 0,
            topSpeedKmH: p.garage?.top_speed_kmh || 0,
            xpEarned: p.garage?.xp_earned || 0,
            isMinted: p.garage?.is_minted || false,
            createdAt: p.garage?.scanned_at || new Date().toISOString(),
            bodyStyle: 'Coupe',
            originCountry: 'Unknown',
            interestingFact: p.caption || 'No fact provided.',
            briefHistory: '',
            modsDetected: [],
            marketValueLowUsd: 0,
            marketValueHighUsd: 0,
            scanValidated: true,
            isPublic: true,
            huntTriggered: false,
            privacyLevel: 'public_blurred',
            aiConfidence: 0.99
          },
          likesCount: p.likes_count || 0,
          commentsCount: p.comments_count || 0,
          isLiked: false,
          createdAt: p.created_at
        }));
        
        set({ feedPosts: mappedPosts });
      }
    } catch (e) {
      console.error('Failed to fetch feed posts:', e);
    }
  },

  completeOnboarding: () => {
    try {
      localStorage.setItem('apex_onboarding_v2_completed', 'true');
    } catch (e) {}
    set({ onboardingCompleted: true });
  },
  addCardToGarage: async (newCard, customCaption) => {
    sounds.playXpPop();
    const postCaption = customCaption?.trim() || `Just found this incredible ${newCard.make} ${newCard.model} in ${newCard.city}!`;
    
    let authoritativeXp = calculateScanXp(newCard.rarity, newCard.isFirstGlobalScan, newCard.isFirstCityScan);
    let authoritativeRarity = newCard.rarity;
    let serverCardId = newCard.id;

    // 1. Invoke Authoritative Server-Side PostgreSQL RPC
    try {
      const { data: rpcResult, error: rpcError } = await supabase.rpc('record_car_scan', {
        p_make: newCard.make,
        p_model: newCard.model,
        p_year_estimate: newCard.yearEstimate || 'Unknown',
        p_color: newCard.color || 'Unknown',
        p_image_url: newCard.imageUrl,
        p_city: newCard.city || 'Local Area',
        p_country: newCard.country || 'Global',
        p_latitude: newCard.latApprox || null,
        p_longitude: newCard.lngApprox || null,
        p_horsepower: newCard.horsepower || 0,
        p_top_speed_kmh: newCard.topSpeedKmH || 0,
        p_caption: postCaption,
        p_image_hash: `hash_${Date.now()}_${newCard.make}_${newCard.model}`
      });

      if (!rpcError && rpcResult?.success) {
        authoritativeXp = rpcResult.xp_earned || authoritativeXp;
        authoritativeRarity = rpcResult.rarity || authoritativeRarity;
        serverCardId = rpcResult.card_id || serverCardId;
      }
    } catch (dbErr) {
      console.warn('RPC record_car_scan execution fallback:', dbErr);
    }

    const authoritativeCard: CarCard = {
      ...newCard,
      id: serverCardId,
      rarity: authoritativeRarity,
      xpEarned: authoritativeXp
    };

    set((state) => {
      const updatedGarage = [authoritativeCard, ...state.garage];
      const newXp = state.user.xp + authoritativeXp;
      const { level } = getLevelFromXp(newXp);

      const updatedQuests = state.dailyQuests.map(quest => {
        if (!quest.isCompleted && (!quest.allowedMakes || quest.allowedMakes.length === 0 || quest.allowedMakes.includes(newCard.make))) {
          const newCount = quest.currentCount + 1;
          const isNowCompleted = newCount >= quest.targetCount;
          return {
            ...quest,
            currentCount: newCount,
            isCompleted: isNowCompleted
          };
        }
        return quest;
      });

      // Automatically satisfy car-related daily missions on scan!
      const updatedMissions = state.dailyMissions.map(m => {
        if (!m.completed) {
          if (m.type === 'scan') return { ...m, completed: true };
          if (m.type === 'rarity' && ['rare', 'epic', 'legendary', 'mythic'].includes(newCard.rarity)) return { ...m, completed: true };
          if (m.type === 'body' && (newCard.bodyStyle === 'SUV' || newCard.bodyStyle === 'Coupe' || newCard.bodyStyle === 'Supercar')) return { ...m, completed: true };
          if (m.type === 'new_car') return { ...m, completed: true };
        }
        return m;
      });

      const newPost: FeedPost = {
        id: `post-${Date.now()}`,
        user: {
          id: state.user.id,
          username: state.user.username,
          avatarUrl: state.user.avatarUrl,
          level: level
        },
        card: newCard,
        caption: postCaption,
        likesCount: 1,
        commentsCount: 0,
        isLiked: true,
        createdAt: 'Just now',
        comments: []
      };

      const isLevelUp = level > state.user.level;

      return {
        garage: updatedGarage,
        user: {
          ...state.user,
          xp: newXp,
          level: level,
          totalSpots: state.user.totalSpots + 1
        },
        levelUpLevel: isLevelUp ? level : state.levelUpLevel,
        dailyQuests: updatedQuests,
        dailyMissions: updatedMissions,
        feedPosts: [newPost, ...state.feedPosts]
      };
    });
  },

  addXp: (amount) => {
    sounds.playXpPop();
    set((state) => {
      const newXp = state.user.xp + amount;
      const { level } = getLevelFromXp(newXp);
      const isLevelUp = level > state.user.level;
      return {
        user: { ...state.user, xp: newXp, level },
        levelUpLevel: isLevelUp ? level : state.levelUpLevel
      };
    });
  },

  toggleLikePost: (postId) => {
    set((state) => ({
      feedPosts: state.feedPosts.map((post) => {
        if (post.id === postId) {
          const isLiked = !post.isLiked;
          return {
            ...post,
            isLiked,
            likesCount: isLiked ? post.likesCount + 1 : post.likesCount - 1
          };
        }
        return post;
      })
    }));
  },

  addCommentToPost: (postId, text) => {
    sounds.playXpPop();
    set((state) => {
      const newComment: PostComment = {
        id: `c-${Date.now()}`,
        user: {
          id: state.user.id,
          username: state.user.username,
          avatarUrl: state.user.avatarUrl,
          level: state.user.level
        },
        text: text.trim(),
        createdAt: 'Just now',
        likesCount: 0,
        isLiked: false
      };

      return {
        feedPosts: state.feedPosts.map((post) => {
          if (post.id === postId) {
            const existingComments = post.comments || [];
            return {
              ...post,
              commentsCount: post.commentsCount + 1,
              comments: [newComment, ...existingComments]
            };
          }
          return post;
        })
      };
    });
  },

  toggleLikeComment: (postId, commentId) => {
    set((state) => ({
      feedPosts: state.feedPosts.map((post) => {
        if (post.id === postId && post.comments) {
          return {
            ...post,
            comments: post.comments.map((comment) => {
              if (comment.id === commentId) {
                const isLiked = !comment.isLiked;
                return {
                  ...comment,
                  isLiked,
                  likesCount: isLiked ? comment.likesCount + 1 : comment.likesCount - 1
                };
              }
              return comment;
            })
          };
        }
        return post;
      })
    }));
  },

  toggleEnthusiastModal: (open) => set((state) => ({
    enthusiastModalOpen: open !== undefined ? open : !state.enthusiastModalOpen
  })),

  setSelectedCardForDetail: (card) => set({ selectedCardForDetail: card }),

  dismissHuntAlert: () => set({ activeHuntAlert: null }),

  openHuntModal: (hunt) => set({ activeHuntModal: hunt }),

  closeHuntModal: () => set({ activeHuntModal: null }),

  triggerMockHunt: (card) => {
    const mockHunt: Hunt = {
      id: `hunt-${Date.now()}`,
      cardId: card.id,
      carName: `${card.make} ${card.model}`,
      make: card.make,
      model: card.model,
      rarity: card.rarity,
      latApprox: card.latApprox,
      lngApprox: card.lngApprox,
      radiusKm: card.privacyLevel === 'approximate_only' ? 3.0 : 2.0,
      startedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      participantsCount: 3,
      city: card.city,
      imageUrl: card.imageUrl,
      status: 'active'
    };
    set((state) => ({
      activeHunts: [mockHunt, ...state.activeHunts],
      activeHuntAlert: mockHunt,
      activeHuntModal: mockHunt
    }));
  },

  completeMission: (missionId) => {
    set((state) => {
      const mission = state.dailyMissions.find(m => m.id === missionId);
      if (!mission || mission.completed) return state;

      sounds.playXpPop();
      const updatedMissions = state.dailyMissions.map(m => m.id === missionId ? { ...m, completed: true } : m);
      const newXp = state.user.xp + mission.xpReward;
      const { level } = getLevelFromXp(newXp);

      return {
        dailyMissions: updatedMissions,
        user: { ...state.user, xp: newXp, level }
      };
    });
  },

  toggleAllowHunts: () => set((state) => ({
    user: {
      ...state.user,
      allowHunts: !state.user.allowHunts,
      defaultPrivacyLevel: !state.user.allowHunts ? 'public_blurred' : 'no_hunt_private'
    }
  })),

  setDefaultPrivacyLevel: (level) => set((state) => ({
    user: {
      ...state.user,
      defaultPrivacyLevel: level,
      allowHunts: level !== 'no_hunt_private'
    }
  }))
}));
