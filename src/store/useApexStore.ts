import { create } from 'zustand';
import type { UserProfile, CarCard, Hunt, DailyQuest, Mission, Badge, FeedPost, PostComment, LeaderboardEntry, Persona, PrivacyLevel } from '../types/apex';
import { getLevelFromXp, calculateScanXp } from '../utils/rarity';
import { sounds } from '../utils/audio';

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

  // User Profile
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
  setGoogleUser: (userData: { name: string; email: string; picture: string }) => void;
  completeOnboarding: () => void;
  addCardToGarage: (newCard: CarCard) => void;
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
  toggleAllowHunts: () => void;
  setDefaultPrivacyLevel: (level: PrivacyLevel) => void;
}

const INITIAL_USER: UserProfile = {
  id: 'user-apex-01',
  username: 'hunter',
  displayName: 'Apex Hunter',
  email: 'hunter@apex.app',
  avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=400&auto=format&fit=crop',
  persona: 'spotter',
  level: 1,
  xp: 0,
  coins: 50,
  streakDays: 0,
  streakLastAt: new Date().toISOString(),
  rankGlobal: 1,
  rankCountry: 1,
  rankCity: 1,
  city: 'Local Area',
  country: 'Your Country',
  countryCode: 'GLOBAL',
  isPremium: false,
  totalSpots: 0,
  rarestFind: 'common',
  badgesUnlocked: 0,
  citiesExplored: 1,
  allowHunts: true,
  defaultPrivacyLevel: 'public_blurred'
};

export const INITIAL_HUNTS: Hunt[] = [];

const INITIAL_QUESTS: DailyQuest[] = [
  {
    id: 'quest-german-day',
    title: 'German Engineering Day',
    description: 'Spot 3 German-made cars (Porsche, BMW, Mercedes, Audi) before midnight.',
    targetCount: 3,
    currentCount: 2,
    xpReward: 500,
    coinReward: 100,
    badgeName: 'Das Auto',
    expiresInSeconds: 13642,
    expiresAtTimestamp: GLOBAL_QUEST_EXPIRES_AT,
    allowedMakes: ['Porsche', 'BMW', 'Mercedes-Benz', 'Audi', 'Volkswagen'],
    isCompleted: false
  }
];

// Car-related missions start uncompleted (completed: false), Daily Login starts completed
const INITIAL_MISSIONS: Mission[] = [
  { id: 'm1', title: 'Scan 1 car today', xpReward: 50, completed: false, type: 'scan' },
  { id: 'm2', title: 'Identify 1 Rare or higher', xpReward: 100, completed: false, type: 'rarity' },
  { id: 'm3', title: 'Daily Login Bonus', xpReward: 25, completed: true, type: 'login' },
  { id: 'm4', title: 'Spot an SUV or Coupe', xpReward: 75, completed: false, type: 'body' },
  { id: 'm5', title: 'Scan a car you\'ve never seen', xpReward: 200, completed: false, type: 'new_car' }
];

const INITIAL_BADGES: Badge[] = [
  { id: 'b1', slug: 'first_blood', name: 'First Blood', description: 'Scanned your very first car card.', icon: '🎯', rarity: 'bronze', isUnlocked: true, xpBonus: 100, earnedAt: '2025-01-10' },
  { id: 'b2', slug: 'rare_encounter', name: 'Rare Encounter', description: 'Spotted a Rare rarity car in the wild.', icon: '⚡', rarity: 'silver', isUnlocked: true, xpBonus: 250, earnedAt: '2025-01-14' },
  { id: 'b3', slug: 'das_auto', name: 'Das Auto', description: 'Spotted 3 German cars in a single day.', icon: '🇩🇪', rarity: 'silver', isUnlocked: true, xpBonus: 300, earnedAt: '2025-01-18' },
  { id: 'b4', slug: 'mythic_hunter', name: 'Mythic Hunter', description: 'Scanned an ultra-rare Mythic tier hypercar!', icon: '👑', rarity: 'diamond', isUnlocked: true, xpBonus: 1000, earnedAt: '2025-01-22' },
  { id: 'b5', slug: 'streak_7', name: '7-Day Spotter', description: 'Maintained a 7-day active scan streak.', icon: '🔥', rarity: 'gold', isUnlocked: true, xpBonus: 500, earnedAt: '2025-01-28' },
  { id: 'b6', slug: 'jdm_royalty', name: 'JDM Royalty', description: 'Spot 10 iconic Japanese domestic market cars.', icon: '🎌', rarity: 'gold', isUnlocked: false, xpBonus: 600 }
];

export const INITIAL_POSTS: FeedPost[] = [];

const INITIAL_LEADERBOARD: LeaderboardEntry[] = [
  { rank: 1, username: 'you', displayName: 'You', avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=400&auto=format&fit=crop', xp: 0, level: 1, rankChange: 'same', isUser: true, rarestCard: 'None Yet' }
];

export const useApexStore = create<ApexState>((set) => ({
  activeTab: 'home',
  scannerOpen: false,
  onboardingCompleted: true,
  enthusiastModalOpen: false,
  activeHuntAlert: null,
  activeHuntModal: null,
  selectedCardForDetail: null,

  user: INITIAL_USER,
  garage: [],
  activeHunts: [],
  dailyQuests: INITIAL_QUESTS,
  dailyMissions: INITIAL_MISSIONS,
  badges: INITIAL_BADGES,
  feedPosts: [],
  leaderboards: INITIAL_LEADERBOARD,
  liveEventExpiresAt: GLOBAL_EVENT_EXPIRES_AT,

  settingsModalOpen: false,
  setSettingsModalOpen: (open) => set({ settingsModalOpen: open }),

  updateUserProfile: (profile) => set((state) => ({
    user: { ...state.user, ...profile }
  })),

  logoutUser: () => {
    localStorage.removeItem('apex_user_session');
    set({
      onboardingCompleted: false,
      settingsModalOpen: false,
      user: {
        ...INITIAL_USER,
        displayName: 'Spotter',
        username: 'spotter_guest',
        email: ''
      }
    });
  },

  setActiveTab: (tab) => set({ activeTab: tab }),

  setScannerOpen: (open) => set({ scannerOpen: open }),

  setPersona: (persona) => set((state) => ({
    user: { ...state.user, persona }
  })),

  setGoogleUser: (userData) => set((state) => ({
    user: {
      ...state.user,
      displayName: userData.name,
      username: userData.email.split('@')[0] || state.user.username,
      email: userData.email,
      avatarUrl: userData.picture || state.user.avatarUrl
    }
  })),

  completeOnboarding: () => set({ onboardingCompleted: true }),

  addCardToGarage: (newCard) => {
    sounds.playXpPop();
    const xpGained = calculateScanXp(newCard.rarity, newCard.isFirstGlobalScan, newCard.isFirstCityScan);

    set((state) => {
      const updatedGarage = [newCard, ...state.garage];
      const newXp = state.user.xp + xpGained;
      const { level } = getLevelFromXp(newXp);

      const updatedQuests = state.dailyQuests.map(quest => {
        if (!quest.isCompleted && quest.allowedMakes?.includes(newCard.make)) {
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
        likesCount: 1,
        commentsCount: 0,
        isLiked: true,
        createdAt: 'Just now',
        comments: []
      };

      return {
        garage: updatedGarage,
        user: {
          ...state.user,
          xp: newXp,
          level: level,
          totalSpots: state.user.totalSpots + 1
        },
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
      return {
        user: { ...state.user, xp: newXp, level }
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
