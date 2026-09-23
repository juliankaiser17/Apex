import { create } from 'zustand';
import type { 
  UserProfile, 
  CarCard, 
  Hunt, 
  DailyQuest, 
  Mission, 
  Badge, 
  FeedPost, 
  PostComment, 
  LeaderboardEntry, 
  Persona, 
  PrivacyLevel, 
  FriendUser,
  FriendRequest,
  NotificationItem,
  AuthStatus,
  AuthUser,
  LocalRarityInfo,
  RarityExplanationDebug,
  EconomyLedgerEntry
} from '../types/apex';
import { calculateDiscoveryXp, processXpGain } from '../utils/mastery';
import { sounds } from '../utils/audio';
import { supabase } from '../lib/supabase';
import { cardImageStorage } from '../lib/cardImageStorage';
import { computeImageSha256 } from '../ai-engine/crypto/sha256';
import { localRarityTracer } from '../ai-engine/observability/localRarityTracer';
import { featureFlags } from '../utils/featureFlags';
import { localRarityCache } from '../utils/localRarityCache';
import { LOCAL_RARITY_CONFIG } from '../utils/localRarityEngine';
import { persistItem, removeItem } from '../lib/capacitorStorage';
import { logAuthTransition } from '../utils/authLogger';
import { getAuthoritativeStreak } from '../utils/streak';
import { 
  getRegisteredUsers, 
  registerOrUpdateUser, 
  getIncomingRequests, 
  getOutgoingRequests,
  getUserFriends,
  saveUserFriends,
  sendFriendRequest as apiSendFriendRequest,
  acceptFriendRequest as apiAcceptFriendRequest,
  denyFriendRequest as apiDenyFriendRequest,
  cancelFriendRequest as apiCancelFriendRequest,
  removeFriendship as apiRemoveFriendship,
  normalizeUsername
} from '../services/userService';

// PERSISTENT GLOBAL EVENT EXPIRATION TIMESTAMPS (Never reset on tab switch!)
export const GLOBAL_QUEST_EXPIRES_AT = Date.now() + 3 * 3600 * 1000 + 47 * 60 * 1000 + 22 * 1000;
export const GLOBAL_EVENT_EXPIRES_AT = Date.now() + 14 * 3600 * 1000 + 32 * 60 * 1000 + 9 * 1000;

interface ApexState {
  // Authoritative Authentication State
  authStatus: AuthStatus;
  authUser: AuthUser | null;
  setAuthStatus: (status: AuthStatus, authUser?: AuthUser | null) => void;

  // Navigation & Modals
  activeTab: 'home' | 'map' | 'garage' | 'social' | 'profile';
  scannerOpen: boolean;
  onboardingCompleted: boolean;
  enthusiastModalOpen: boolean;
  activeHuntAlert: Hunt | null;
  activeHuntModal: Hunt | null;
  selectedCardForDetail: CarCard | null;
  locationDisplayMode: 'exact' | 'radius' | 'hidden';
  setLocationDisplayMode: (mode: 'exact' | 'radius' | 'hidden') => void;
  localRarityEnabled: boolean;
  setLocalRarityEnabled: (enabled: boolean) => void;
  localRarityXpEnabled: boolean;
  setLocalRarityXpEnabled: (enabled: boolean) => void;
  levelUpLevel: number | null;
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
  friends: FriendUser[];

  // Friend Requests (Real Two-Way System)
  incomingRequests: FriendRequest[];
  outgoingRequests: FriendRequest[];
  fetchFriendRequests: () => void;
  sendFriendRequest: (targetUsername: string) => Promise<{ success: boolean; message: string; error?: string }>;
  acceptFriendRequest: (requestId: string) => Promise<{ success: boolean; error?: string }>;
  denyFriendRequest: (requestId: string) => Promise<{ success: boolean }>;
  cancelFriendRequest: (requestId: string) => Promise<{ success: boolean }>;
  switchAccount: (userId: string) => Promise<void>;
  refreshLeaderboards: () => void;

  settingsModalOpen: boolean;
  setSettingsModalOpen: (open: boolean) => void;
  streakModalOpen: boolean;
  setStreakModalOpen: (open: boolean) => void;
  notificationModalOpen: boolean;
  setNotificationModalOpen: (open: boolean) => void;
  notifications: NotificationItem[];
  markNotificationAsRead: (id: string) => void;
  clearAllNotifications: () => void;
  claimDailyStreak: () => { xp: number; coins: number; streak: number; alreadyClaimed?: boolean };
  updateUserProfile: (profile: Partial<UserProfile>) => void;
  logoutUser: () => void;
  deleteAccount: () => Promise<void>;
  clearStorageCache: () => void;
  addFriend: (friend: FriendUser) => void;
  removeFriend: (username: string) => void;
  setActiveTab: (tab: 'home' | 'map' | 'garage' | 'social' | 'profile') => void;
  setScannerOpen: (open: boolean) => void;
  setPersona: (persona: Persona) => void;
  initializeSession: (userId: string, authEmail?: string, provider?: string, userMetadata?: any) => Promise<void>;
  fetchFeedPosts: () => Promise<void>;
  completeOnboarding: () => void;
  addCardToGarage: (
    newCard: CarCard, 
    customCaption?: string,
    options?: {
      publishToFeed?: boolean;
      privacyMode?: 'exact_delayed_15' | 'approx_delayed_5' | 'private_hidden';
      allowComments?: boolean;
      allowHunts?: boolean;
      geoBucket?: string | null;
    }
  ) => Promise<void>;
  deletePost: (postId: string) => Promise<void>;
  addXp: (amount: number, reason?: string) => void;
  toggleLikePost: (postId: string) => void;
  addCommentToPost: (postId: string, text: string) => void;
  toggleLikeComment: (postId: string, commentId: string) => void;
  toggleEnthusiastModal: (open?: boolean) => void;
  setSelectedCardForDetail: (card: CarCard | null) => void;
  dismissHuntAlert: () => void;
  openHuntModal: (hunt: Hunt) => void;
  closeHuntModal: () => void;
  abandonHunt: (huntId?: string) => void;
  triggerMockHunt: (card: CarCard) => void;
  completeMission: (missionId: string) => void;
  claimMissionReward: (missionId: string) => Promise<{ success: boolean; error?: string; xpAwarded?: number; coinsAwarded?: number }>;
  onScanCompleted: (card: CarCard) => void;
  rehydrateCardImages: (cards: CarCard[]) => void;
  dismissLevelUp: () => void;
  toggleAllowHunts: () => void;
  setDefaultPrivacyLevel: (level: PrivacyLevel) => void;
  scheduleCardDeletion: (cardId: string) => Promise<void>;
  cancelCardDeletion: (cardId: string) => Promise<void>;
  purgeExpiredDeletedCards: () => Promise<void>;
  resetDevelopmentState: () => void;
  economyLedger: EconomyLedgerEntry[];
  awardCoins: (amount: number, reason: string, metadata?: any) => void;
  purchaseStreakFreeze: () => { success: boolean; error?: string };
  purchaseHuntBooster: () => { success: boolean; error?: string };
  purchaseCardFoil: (cardId: string) => { success: boolean; error?: string };
  purchaseReScan: () => { success: boolean; error?: string };
  updateCardInGarage: (cardId: string, updates: Partial<CarCard>) => void;
  blockUser: (targetUserId: string) => void;
  unblockUser: (targetUserId: string) => void;
}

export const createFreshUser = (): UserProfile => ({
  id: `user_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
  username: '',
  displayName: '',
  email: '',
  avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=400&auto=format&fit=crop',
  persona: 'unspecified',
  level: 1,
  xp: 0,
  coins: 0,
  streakDays: 0,
  streakLastAt: undefined,
  streakFreezes: 0,
  activeHuntBoosterUntil: undefined,
  rescanTokens: 0,
  blockedUsers: [],
  rankGlobal: 1,
  rankCountry: 1,
  rankCity: 1,
  city: '',
  country: '',
  latitude: 0,
  longitude: 0,
  countryCode: 'GLOBAL',
  isPremium: false,
  totalSpots: 0,
  rarestFind: 'common',
  badgesUnlocked: 0,
  citiesExplored: 0,
  allowHunts: true,
  defaultPrivacyLevel: 'public_blurred',
  bio: '',
  driverTitle: 'Apex Spotter',
  favoriteCar: '',
  favoriteBrand: '',
  cardThemeColor: '#E50914',
  speedUnits: 'kmh',
  soundEffectsEnabled: true
});

const INITIAL_USER: UserProfile = createFreshUser();

export const INITIAL_HUNTS: Hunt[] = [];

export function generatePersonaQuests(persona: Persona = 'unspecified'): DailyQuest[] {
  const baseSpotlight: DailyQuest = {
    id: 'quest-daily-spotlight',
    title: 'Daily Spotlight: 3 Vehicle Scans',
    description: 'Spot and photograph 3 real vehicles in the wild today.',
    targetCount: 3,
    currentCount: 0,
    xpReward: 500,
    coinReward: 100,
    badgeName: 'Apex Spotter',
    expiresInSeconds: 13642,
    expiresAtTimestamp: GLOBAL_QUEST_EXPIRES_AT,
    allowedMakes: [],
    isCompleted: false
  };

  if (persona === 'finder') {
    return [
      baseSpotlight,
      {
        id: 'quest-hunter-supercar',
        title: 'Predator: 500+ HP Exotic',
        description: 'Track down and verify a vehicle pushing 500+ horsepower or Epic/Legendary rarity.',
        targetCount: 1,
        currentCount: 0,
        xpReward: 600,
        coinReward: 120,
        badgeName: 'Apex Predator',
        expiresInSeconds: 86400,
        expiresAtTimestamp: GLOBAL_QUEST_EXPIRES_AT,
        allowedMakes: ['Ferrari', 'Lamborghini', 'Porsche', 'McLaren', 'Aston Martin'],
        isCompleted: false
      },
      {
        id: 'quest-hunter-time-attack',
        title: 'Speed Hunt: High-Performance Coupe',
        description: 'Spot an aggressive performance coupe before tonight’s radar reset.',
        targetCount: 2,
        currentCount: 0,
        xpReward: 450,
        coinReward: 90,
        badgeName: 'Time Attack',
        expiresInSeconds: 86400,
        expiresAtTimestamp: GLOBAL_QUEST_EXPIRES_AT,
        allowedBodyStyles: ['Coupe'],
        isCompleted: false
      }
    ];
  }

  if (persona === 'spotter') {
    return [
      baseSpotlight,
      {
        id: 'quest-spotter-diversity',
        title: 'Sector Survey: 2 Different Body Styles',
        description: 'Document at least 2 distinct vehicle body styles (e.g. Sedan & SUV).',
        targetCount: 2,
        currentCount: 0,
        xpReward: 400,
        coinReward: 80,
        badgeName: 'Field Scout',
        expiresInSeconds: 86400,
        expiresAtTimestamp: GLOBAL_QUEST_EXPIRES_AT,
        allowedMakes: [],
        isCompleted: false
      },
      {
        id: 'quest-spotter-global',
        title: 'Continental Scout: German & Japanese Pair',
        description: 'Photograph 1 German and 1 Japanese vehicle in your city today.',
        targetCount: 2,
        currentCount: 0,
        xpReward: 450,
        coinReward: 90,
        badgeName: 'Global Eye',
        expiresInSeconds: 86400,
        expiresAtTimestamp: GLOBAL_QUEST_EXPIRES_AT,
        allowedMakes: ['Toyota', 'Nissan', 'Honda', 'BMW', 'Porsche', 'Audi', 'Mercedes-Benz'],
        isCompleted: false
      }
    ];
  }

  if (persona === 'love_of_cars') {
    return [
      baseSpotlight,
      {
        id: 'quest-love-heritage',
        title: 'Heritage Preservation: Naturally Aspirated Icon',
        description: 'Spot a heritage naturally aspirated or iconic high-revving sports car.',
        targetCount: 1,
        currentCount: 0,
        xpReward: 500,
        coinReward: 100,
        badgeName: 'Purist',
        expiresInSeconds: 86400,
        expiresAtTimestamp: GLOBAL_QUEST_EXPIRES_AT,
        allowedMakes: ['Porsche', 'Ferrari', 'Mazda', 'Honda', 'BMW'],
        isCompleted: false
      },
      {
        id: 'quest-love-oem',
        title: 'Factory Specimen: Clean OEM Build',
        description: 'Photograph an authentic, unmodified factory production vehicle.',
        targetCount: 2,
        currentCount: 0,
        xpReward: 400,
        coinReward: 80,
        badgeName: 'Connoisseur',
        expiresInSeconds: 86400,
        expiresAtTimestamp: GLOBAL_QUEST_EXPIRES_AT,
        allowedMakes: [],
        isCompleted: false
      }
    ];
  }

  // Safe fallback for 'unspecified'
  return [
    baseSpotlight,
    {
      id: 'quest-german-precision',
      title: 'German Engineering: 2 Sports Cars',
      description: 'Spot 2 German performance cars (Porsche, BMW, Mercedes, or Audi).',
      targetCount: 2,
      currentCount: 0,
      xpReward: 400,
      coinReward: 80,
      badgeName: 'Autobahn Scout',
      expiresInSeconds: 86400,
      expiresAtTimestamp: GLOBAL_QUEST_EXPIRES_AT,
      allowedMakes: ['Porsche', 'BMW', 'Mercedes-Benz', 'Mercedes', 'Audi'],
      isCompleted: false
    },
    {
      id: 'quest-jdm-royalty',
      title: 'JDM Legend: Japanese Icon',
      description: 'Spot a Japanese performance icon (Toyota, Nissan, Honda, Mazda, or Subaru).',
      targetCount: 1,
      currentCount: 0,
      xpReward: 350,
      coinReward: 70,
      badgeName: 'Tokyo Drifter',
      expiresInSeconds: 86400,
      expiresAtTimestamp: GLOBAL_QUEST_EXPIRES_AT,
      allowedMakes: ['Toyota', 'Nissan', 'Honda', 'Mazda', 'Subaru', 'Lexus'],
      isCompleted: false
    }
  ];
}

export const getSavedDailyQuests = (persona: Persona = 'unspecified'): DailyQuest[] => {
  try {
    if (typeof localStorage !== 'undefined') {
      const today = new Date().toISOString().slice(0, 10);
      const savedDate = localStorage.getItem('apex_daily_quests_date');
      if (savedDate === today) {
        const saved = localStorage.getItem('apex_daily_quests');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } else {
        localStorage.setItem('apex_daily_quests_date', today);
      }
    }
  } catch (e) {}
  return generatePersonaQuests(persona);
};

const INITIAL_QUESTS: DailyQuest[] = generatePersonaQuests('unspecified');

const INITIAL_MISSIONS: Mission[] = [
  { id: 'm1', title: 'Scan 1 car today', xpReward: 50, completed: false, type: 'scan' },
  { id: 'm2', title: 'Identify 1 Rare or higher', xpReward: 100, completed: false, type: 'rarity' },
  { id: 'm3', title: 'Daily Login Bonus', xpReward: 25, completed: false, type: 'login' },
  { id: 'm4', title: 'Spot an SUV or Coupe', xpReward: 75, completed: false, type: 'body' },
  { id: 'm5', title: 'Scan a car you\'ve never seen', xpReward: 200, completed: false, type: 'new_car' },
  { id: 'm6', title: 'Spot a car with 400+ HP', xpReward: 120, completed: false, type: 'power' },
  { id: 'm7', title: 'Spot an Aero or Tuned car', xpReward: 100, completed: false, type: 'mods' }
];

export const getSavedDailyMissions = (): Mission[] => {
  try {
    if (typeof localStorage !== 'undefined') {
      const today = new Date().toISOString().slice(0, 10);
      const savedDate = localStorage.getItem('apex_daily_missions_date');
      if (savedDate === today) {
        const saved = localStorage.getItem('apex_daily_missions');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } else {
        localStorage.setItem('apex_daily_missions_date', today);
      }
    }
  } catch (e) {}
  return INITIAL_MISSIONS;
};

const INITIAL_BADGES: Badge[] = [
  { id: 'b1', slug: 'first_blood', name: 'First Blood', description: 'Scanned your very first car card.', icon: 'Target', rarity: 'bronze', isUnlocked: false, xpBonus: 100 },
  { id: 'b2', slug: 'rare_encounter', name: 'Rare Encounter', description: 'Spotted a Rare rarity car in the wild.', icon: 'Zap', rarity: 'silver', isUnlocked: false, xpBonus: 250 },
  { id: 'b3', slug: 'das_auto', name: 'Das Auto', description: 'Spotted 3 German cars in a single day.', icon: 'Flag', rarity: 'silver', isUnlocked: false, xpBonus: 300 },
  { id: 'b4', slug: 'mythic_hunter', name: 'Mythic Hunter', description: 'Scanned an ultra-rare Mythic tier hypercar!', icon: 'Crown', rarity: 'diamond', isUnlocked: false, xpBonus: 1000 },
  { id: 'b5', slug: 'streak_7', name: '7-Day Spotter', description: 'Maintained a 7-day active scan streak.', icon: 'Flame', rarity: 'gold', isUnlocked: false, xpBonus: 500 },
  { id: 'b6', slug: 'jdm_royalty', name: 'JDM Royalty', description: 'Spot 10 iconic Japanese domestic market cars.', icon: 'Globe', rarity: 'gold', isUnlocked: false, xpBonus: 600 }
];

const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'notif-streak-1',
    title: 'Daily Streak Ready to Claim',
    message: 'Log in and spot cars daily to maintain your streak multiplier and earn bonus coins.',
    type: 'reward',
    timestamp: '1h ago',
    read: false,
    actionTab: 'home',
    xpReward: 150
  },
  {
    id: 'notif-event-1',
    title: 'Weekend Supercar Event Live',
    message: 'Supercar Sunday is active: 2× XP on all rare supercar scans.',
    type: 'system',
    timestamp: '3h ago',
    read: true,
    actionTab: 'home'
  }
];

/**
 * Compute real-time leaderboard entries from registered users.
 */
export const computeLeaderboard = (currentUser: UserProfile): LeaderboardEntry[] => {
  const registered = getRegisteredUsers();
  const currentClean = normalizeUsername(currentUser.username);
  let allProfiles: UserProfile[] = [...registered];

  if (currentClean) {
    const existingIdx = allProfiles.findIndex(
      u => normalizeUsername(u.username) === currentClean || u.id === currentUser.id
    );
    if (existingIdx >= 0) {
      allProfiles[existingIdx] = { ...allProfiles[existingIdx], ...currentUser };
    } else {
      allProfiles.push(currentUser);
    }
  }

  // Filter out any entries without a valid username
  allProfiles = allProfiles.filter(u => !!u.username && u.username.trim() !== '');

  if (allProfiles.length === 0) {
    return [
      {
        rank: 1,
        username: currentUser.username || 'you',
        displayName: currentUser.displayName || 'You',
        avatarUrl: currentUser.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=400',
        xp: currentUser.xp || 0,
        level: currentUser.level || 1,
        rankChange: 'same',
        isUser: true,
        rarestCard: (currentUser.rarestFind as string) !== 'None' && currentUser.rarestFind ? currentUser.rarestFind : 'None Yet'
      }
    ];
  }

  // Sort by XP descending, then total spots descending
  allProfiles.sort((a, b) => (b.xp || 0) - (a.xp || 0) || (b.totalSpots || 0) - (a.totalSpots || 0));

  return allProfiles.map((p, idx) => {
    const isMe = normalizeUsername(p.username) === currentClean || p.id === currentUser.id;
    return {
      rank: idx + 1,
      username: p.username,
      displayName: p.displayName || p.username,
      avatarUrl: p.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=400',
      xp: p.xp || 0,
      level: p.level || 1,
      city: p.city || 'Global',
      country: p.country || 'Global',
      rankChange: 'same',
      isUser: isMe,
      rarestCard: (p.rarestFind as string) !== 'None' && p.rarestFind ? p.rarestFind : 'None Yet'
    };
  });
};

const getSavedUser = (): UserProfile => {
  try {
    if (typeof localStorage !== 'undefined') {
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
    }
  } catch (e) {
    console.warn('Error reading saved user session:', e);
  }
  return INITIAL_USER;
};

export const persistLightweightGarage = (userId: string | undefined, garage: CarCard[]) => {
  try {
    if (typeof localStorage === 'undefined') return;
    // Strip heavy base64 strings to prevent QuotaExceededError in localStorage
    const lightweightGarage = garage.map(c => {
      if (c.imageUrl && c.imageUrl.startsWith('data:')) {
        // Persist binary into IndexedDB asynchronously
        cardImageStorage.storeImage(c.id, c.imageUrl).catch(() => {});
        return {
          ...c,
          imageUrl: `indexeddb://${c.id}`
        };
      }
      return c;
    });

    const json = JSON.stringify(lightweightGarage);
    if (userId) {
      localStorage.setItem(`apex_garage_cards_${userId}`, json);
    }
    localStorage.setItem('apex_garage_cards', json);
  } catch (e) {
    console.warn('[Storage] Failed to persist lightweight garage:', e);
  }
};

const getSavedGarage = (userId?: string): CarCard[] => {
  const mergedCardsMap = new Map<string, CarCard>();
  try {
    if (typeof localStorage !== 'undefined') {
      // 1. User-scoped cards
      if (userId) {
        const userSaved = localStorage.getItem(`apex_garage_cards_${userId}`);
        if (userSaved) {
          const parsed = JSON.parse(userSaved);
          if (Array.isArray(parsed)) {
            parsed.forEach(c => { if (c?.id) mergedCardsMap.set(c.id, c); });
          }
        }
      }

      // 2. Merge legacy global cards (apex_garage_cards)
      const legacySaved = localStorage.getItem('apex_garage_cards');
      if (legacySaved) {
        const parsed = JSON.parse(legacySaved);
        if (Array.isArray(parsed)) {
          parsed.forEach(c => {
            if (c?.id && !mergedCardsMap.has(c.id)) {
              mergedCardsMap.set(c.id, c);
            }
          });
        }
      }

      // 3. Merge legacy apex_garage_items
      const oldItemsSaved = localStorage.getItem('apex_garage_items');
      if (oldItemsSaved) {
        const parsed = JSON.parse(oldItemsSaved);
        if (Array.isArray(parsed)) {
          parsed.forEach(c => {
            if (c?.id && !mergedCardsMap.has(c.id)) {
              mergedCardsMap.set(c.id, c);
            }
          });
        }
      }
    }
  } catch (e) {
    console.warn('Error reading saved garage cards:', e);
  }

  const result = Array.from(mergedCardsMap.values());
  // Asynchronously rehydrate images from cardImageStorage for any card with indexeddb:// or missing image
  if (typeof window !== 'undefined' && result.length > 0) {
    setTimeout(async () => {
      let changed = false;
      for (const card of result) {
        if (!card.imageUrl || card.imageUrl.startsWith('indexeddb://')) {
          const storedUrl = await cardImageStorage.getImage(card.id);
          if (storedUrl) {
            card.imageUrl = storedUrl;
            changed = true;
          }
        }
      }
      if (changed) {
        try {
          useApexStore.getState().rehydrateCardImages(result);
        } catch (_) {}
      }
    }, 100);
  }

  return result;
};

const createSampleCard = (partial: Partial<CarCard> & { id: string; make: string; model: string; imageUrl: string }): CarCard => ({
  cardNumber: `#APX-${Math.floor(100000 + Math.random() * 900000)}`,
  yearEstimate: '2023',
  color: 'Standard',
  bodyStyle: 'Coupe',
  rarity: 'rare',
  rarityScore: 75,
  horsepower: 400,
  topSpeedKmH: 280,
  zeroToHundredSec: 3.8,
  originCountry: 'Germany',
  interestingFact: 'Precision track-tested engineering.',
  briefHistory: 'Iconic performance heritage model.',
  modsDetected: [],
  latApprox: 35.6762,
  lngApprox: 139.6503,
  city: 'Tokyo',
  country: 'Japan',
  xpEarned: 250,
  marketValueLowUsd: 85000,
  marketValueHighUsd: 120000,
  scanValidated: true,
  isPublic: true,
  huntTriggered: false,
  privacyLevel: 'public_blurred',
  aiConfidence: 0.98,
  createdAt: new Date().toISOString(),
  ...partial
});

export const SAMPLE_FEED_POSTS: FeedPost[] = [
  {
    id: 'post-sample-1',
    user: {
      id: 'usr-daikoku-1',
      username: 'daikoku_spotter',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=400&auto=format&fit=crop',
      level: 14
    },
    card: createSampleCard({
      id: 'card-gt3rs-1',
      cardNumber: '#APX-009921',
      make: 'Porsche',
      model: '911 GT3 RS',
      yearEstimate: '2023',
      bodyStyle: 'Coupe',
      rarity: 'legendary',
      rarityScore: 96,
      color: 'Signal Yellow / Carbon',
      topSpeedKmH: 296,
      horsepower: 525,
      zeroToHundredSec: 3.2,
      torqueNm: 465,
      kerbWeightKg: 1450,
      city: 'Tokyo',
      country: 'Japan',
      originCountry: 'Germany',
      interestingFact: 'Equipped with active DRS aero wing.',
      briefHistory: 'The pinnacle of Porsche naturally aspirated motorsport engineering.',
      imageUrl: 'https://images.unsplash.com/photo-1614162692292-7ac56d7f7f1e?q=80&w=1200&auto=format&fit=crop'
    }),
    caption: 'Weissach Package GT3 RS rolling through Daikoku Futo at sunset — Massive active DRS wing in person is insane.',
    likesCount: 142,
    commentsCount: 2,
    comments: [
      {
        id: 'cmt-sample-1',
        user: {
          id: 'usr-milan-1',
          username: 'tifosi_scout',
          avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=400&auto=format&fit=crop',
          level: 9
        },
        text: 'That Weissach DRS wing looks even wilder in person 🔥',
        createdAt: '1h ago',
        likesCount: 12,
        isLiked: false
      },
      {
        id: 'cmt-sample-2',
        user: {
          id: 'usr-cali-1',
          username: 'cali_apex',
          avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=400&auto=format&fit=crop',
          level: 16
        },
        text: 'Daikoku Futo at sunset is peak car culture. Great spot!',
        createdAt: '45m ago',
        likesCount: 8,
        isLiked: true
      }
    ],
    isLiked: false,
    createdAt: '2h ago'
  },
  {
    id: 'post-sample-2',
    user: {
      id: 'usr-milan-1',
      username: 'tifosi_scout',
      avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=400&auto=format&fit=crop',
      level: 9
    },
    card: createSampleCard({
      id: 'card-296gtb-1',
      cardNumber: '#APX-002960',
      make: 'Ferrari',
      model: '296 GTB Assetto Fiorano',
      yearEstimate: '2024',
      bodyStyle: 'Supercar',
      rarity: 'legendary',
      rarityScore: 94,
      color: 'Rosso Corsa',
      topSpeedKmH: 330,
      horsepower: 830,
      zeroToHundredSec: 2.9,
      torqueNm: 740,
      kerbWeightKg: 1470,
      city: 'Milan',
      country: 'Italy',
      originCountry: 'Italy',
      interestingFact: '120-degree hot-V twin-turbo with MGU-K hybrid.',
      briefHistory: 'Modern Ferrari mid-rear engine masterpiece.',
      imageUrl: 'https://images.unsplash.com/photo-1592198084033-aade902d1aae?q=80&w=1200&auto=format&fit=crop'
    }),
    caption: 'Twin-turbo V6 hybrid screaming through the streets of Milan. Sounds like a mini V12.',
    likesCount: 98,
    commentsCount: 0,
    comments: [],
    isLiked: false,
    createdAt: '5h ago'
  },
  {
    id: 'post-sample-3',
    user: {
      id: 'usr-cali-1',
      username: 'cali_apex',
      avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=400&auto=format&fit=crop',
      level: 16
    },
    card: createSampleCard({
      id: 'card-sto-1',
      cardNumber: '#APX-006400',
      make: 'Lamborghini',
      model: 'Huracán STO',
      yearEstimate: '2023',
      bodyStyle: 'Supercar',
      rarity: 'legendary',
      rarityScore: 95,
      color: 'Blu Laufey / Arancio Xanto',
      topSpeedKmH: 310,
      horsepower: 640,
      zeroToHundredSec: 3.0,
      torqueNm: 565,
      kerbWeightKg: 1339,
      city: 'Los Angeles',
      country: 'United States',
      originCountry: 'Italy',
      interestingFact: 'Over 75% of the body panels are carbon fibre.',
      briefHistory: 'Homologated road version of the Super Trofeo race car.',
      imageUrl: 'https://images.unsplash.com/photo-1544829099-b9a0c07fad1a?q=80&w=1200&auto=format&fit=crop'
    }),
    caption: 'Track weapon parked on Sunset Blvd. The roof snorkel and carbon cofango are wild.',
    likesCount: 215,
    commentsCount: 0,
    comments: [],
    isLiked: true,
    createdAt: '1d ago'
  },
  {
    id: 'post-sample-4',
    user: {
      id: 'usr-bimmer-1',
      username: 'bimmer_hunter',
      avatarUrl: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?q=80&w=400&auto=format&fit=crop',
      level: 8
    },
    card: createSampleCard({
      id: 'card-m4csl-1',
      cardNumber: '#APX-004550',
      make: 'BMW',
      model: 'M4 CSL',
      yearEstimate: '2024',
      bodyStyle: 'Coupe',
      rarity: 'epic',
      rarityScore: 89,
      color: 'Frozen Brooklyn Grey',
      topSpeedKmH: 307,
      horsepower: 550,
      zeroToHundredSec: 3.7,
      torqueNm: 650,
      kerbWeightKg: 1625,
      city: 'Munich',
      country: 'Germany',
      originCountry: 'Germany',
      interestingFact: 'Strictly limited to 1,000 units worldwide.',
      briefHistory: 'Coupe Sport Leichtbau celebrating 50 years of BMW M.',
      imageUrl: 'https://images.unsplash.com/photo-1580273916550-e323be2ae537?q=80&w=1200&auto=format&fit=crop'
    }),
    caption: '1 of 1,000 worldwide. Yellow laserlights and the carbon ducktail in the Munich rain.',
    likesCount: 76,
    commentsCount: 0,
    comments: [],
    isLiked: false,
    createdAt: '1d ago'
  },
  {
    id: 'post-sample-5',
    user: {
      id: 'usr-jdm-1',
      username: 'jdm_legends',
      avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=400&auto=format&fit=crop',
      level: 11
    },
    card: createSampleCard({
      id: 'card-gtr-1',
      cardNumber: '#APX-003500',
      make: 'Nissan',
      model: 'GT-R Nismo (R35)',
      yearEstimate: '2022',
      bodyStyle: 'Coupe',
      rarity: 'epic',
      rarityScore: 91,
      color: 'Stealth Gray / Carbon',
      topSpeedKmH: 330,
      horsepower: 600,
      zeroToHundredSec: 2.8,
      torqueNm: 652,
      kerbWeightKg: 1720,
      city: 'Yokohama',
      country: 'Japan',
      originCountry: 'Japan',
      interestingFact: 'Handbuilt VR38DETT twin-turbo engine crafted by Takumi master artisans.',
      briefHistory: 'The ultimate evolution of the legendary R35 GT-R platform.',
      imageUrl: 'https://images.unsplash.com/photo-1617814076367-b759c7d7e738?q=80&w=1200&auto=format&fit=crop'
    }),
    caption: 'Godzilla spotted outside the Nismo Omori Factory. The dry carbon hood is art.',
    likesCount: 189,
    commentsCount: 0,
    comments: [],
    isLiked: false,
    createdAt: '2d ago'
  }
];

const getSavedPosts = (): FeedPost[] => {
  try {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('apex_user_posts');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const userPostIds = new Set(parsed.map((p: any) => p.id));
          const nonDuplicateSamples = SAMPLE_FEED_POSTS.filter(s => !userPostIds.has(s.id));
          return [...parsed, ...nonDuplicateSamples];
        }
      }
    }
  } catch (e) {}
  return SAMPLE_FEED_POSTS;
};

const getSavedOnboarding = (): boolean => {
  try {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('apex_onboarding_v2_completed');
      const user = getSavedUser();
      if (!user || !user.username || user.username.startsWith('user_') || user.username.startsWith('spotter_') || user.username.startsWith('hunter_')) {
        return false;
      }
      if (saved === 'true') return true;
    }
  } catch (e) {}
  return false;
};

const initialSavedUser = getSavedUser();

export const useApexStore = create<ApexState>((set, get) => ({
  authStatus: 'AUTH_LOADING',
  authUser: initialSavedUser.email ? { id: initialSavedUser.id, email: initialSavedUser.email } : null,
  setAuthStatus: (status, authUser) => set(state => ({
    authStatus: status,
    authUser: authUser !== undefined ? authUser : state.authUser
  })),

  activeTab: 'home',
  scannerOpen: false,
  onboardingCompleted: getSavedOnboarding(),
  enthusiastModalOpen: false,
  activeHuntAlert: null,
  activeHuntModal: null,
  selectedCardForDetail: null,
  locationDisplayMode: 'radius',
  localRarityEnabled: typeof localStorage !== 'undefined' ? localStorage.getItem('apex_local_rarity_enabled') !== 'false' : true,
  setLocalRarityEnabled: (enabled: boolean) => {
    try {
      localStorage.setItem('apex_local_rarity_enabled', String(enabled));
    } catch {}
    featureFlags.setLocalRarityEnabled(enabled);
    set({ localRarityEnabled: enabled });
  },
  localRarityXpEnabled: typeof localStorage !== 'undefined' ? localStorage.getItem('apex_local_rarity_xp_enabled') !== 'false' : true,
  setLocalRarityXpEnabled: (enabled: boolean) => {
    try {
      localStorage.setItem('apex_local_rarity_xp_enabled', String(enabled));
    } catch {}
    featureFlags.setLocalRarityXpEnabled(enabled);
    set({ localRarityXpEnabled: enabled });
  },

  user: initialSavedUser,
  garage: getSavedGarage(initialSavedUser.id),
  friends: getUserFriends(initialSavedUser.username),
  activeHunts: [],
  dailyQuests: getSavedDailyQuests(initialSavedUser.persona),
  dailyMissions: getSavedDailyMissions(),
  badges: INITIAL_BADGES,
  feedPosts: getSavedPosts(),
  economyLedger: [],
  leaderboards: computeLeaderboard(initialSavedUser),
  liveEventExpiresAt: GLOBAL_EVENT_EXPIRES_AT,

  incomingRequests: getIncomingRequests(initialSavedUser.username),
  outgoingRequests: getOutgoingRequests(initialSavedUser.username),

  levelUpLevel: null,
  dismissLevelUp: () => set({ levelUpLevel: null }),

  settingsModalOpen: false,
  setSettingsModalOpen: (open) => set({ settingsModalOpen: open }),
  streakModalOpen: false,
  setStreakModalOpen: (open) => set({ streakModalOpen: open }),
  notificationModalOpen: false,
  setNotificationModalOpen: (open) => set({ notificationModalOpen: open }),
  notifications: INITIAL_NOTIFICATIONS,
  markNotificationAsRead: (id: string) => {
    set((state) => ({
      notifications: state.notifications.map(n => n.id === id ? { ...n, read: true } : n)
    }));
  },
  clearAllNotifications: () => {
    set({ notifications: [] });
  },
  claimDailyStreak: () => {
    const currentUser = get().user;
    const now = new Date();
    const streakInfo = getAuthoritativeStreak(currentUser.streakDays, currentUser.streakLastAt, now);

    if (!streakInfo.canClaim) {
      return { xp: 0, coins: 0, streak: streakInfo.currentStreak, alreadyClaimed: true };
    }

    const newStreak = streakInfo.targetStreak;
    const reward = streakInfo.reward;

    // Single atomic state update for immediate 60 FPS response
    const xpResult = processXpGain(currentUser, reward.xp, `Daily Streak Day ${streakInfo.displayDayNumber}`);
    const updatedUser: UserProfile = {
      ...xpResult.updatedUser,
      streakDays: newStreak,
      coins: (currentUser.coins || 0) + reward.coins,
      streakLastAt: now.toISOString()
    };

    set({
      user: updatedUser,
      levelUpLevel: xpResult.leveledUp ? updatedUser.level : get().levelUpLevel
    });

    try {
      persistItem('apex_user_session', JSON.stringify(updatedUser));
      localStorage.setItem(`apex_last_streak_popup_${currentUser.id || currentUser.username}`, now.toDateString());
    } catch (e) {}

    // Defer remote Supabase network sync and leaderboard recomputation to background
    setTimeout(() => {
      registerOrUpdateUser(updatedUser);
      supabase.auth.updateUser({
        data: {
          streak_days: newStreak,
          streak_last_at: now.toISOString()
        }
      }).catch(() => {});
      set({ leaderboards: computeLeaderboard(updatedUser) });
    }, 250);

    return { xp: reward.xp, coins: reward.coins, streak: newStreak, alreadyClaimed: false };
  },
  setLocationDisplayMode: (mode) => set({ locationDisplayMode: mode }),

  refreshLeaderboards: () => {
    set((state) => ({ leaderboards: computeLeaderboard(state.user) }));
  },

  fetchFriendRequests: () => {
    const currentUsername = get().user.username;
    if (!currentUsername) return;
    set({
      incomingRequests: getIncomingRequests(currentUsername),
      outgoingRequests: getOutgoingRequests(currentUsername),
      friends: getUserFriends(currentUsername)
    });
  },

  sendFriendRequest: async (targetUsername: string) => {
    const currentUser = get().user;
    const res = await apiSendFriendRequest(currentUser, targetUsername);
    get().fetchFriendRequests();
    return res;
  },

  acceptFriendRequest: async (requestId: string) => {
    sounds.playTargetLock();
    const currentUser = get().user;
    const res = await apiAcceptFriendRequest(requestId, currentUser);
    if (res.success) {
      const updatedFriends = getUserFriends(currentUser.username);
      set({ 
        friends: updatedFriends,
        incomingRequests: getIncomingRequests(currentUser.username)
      });
    }
    return res;
  },

  denyFriendRequest: async (requestId: string) => {
    const res = await apiDenyFriendRequest(requestId);
    const currentUsername = get().user.username;
    set({ incomingRequests: getIncomingRequests(currentUsername) });
    return res;
  },

  cancelFriendRequest: async (requestId: string) => {
    const res = await apiCancelFriendRequest(requestId);
    const currentUsername = get().user.username;
    set({ outgoingRequests: getOutgoingRequests(currentUsername) });
    return res;
  },

  switchAccount: async (userId: string) => {
    const users = getRegisteredUsers();
    const targetUser = users.find(u => u.id === userId);
    if (!targetUser) return;

    try {
      persistItem('apex_user_session', JSON.stringify(targetUser));
      persistItem('apex_onboarding_v2_completed', 'true');
    } catch (e) {}

    const userFriends = getUserFriends(targetUser.username);
    const userGarage = getSavedGarage(targetUser.id);

    set({
      user: targetUser,
      garage: userGarage,
      friends: userFriends,
      incomingRequests: getIncomingRequests(targetUser.username),
      outgoingRequests: getOutgoingRequests(targetUser.username),
      leaderboards: computeLeaderboard(targetUser),
      onboardingCompleted: true
    });
  },

  updateUserProfile: (profile) => set((state) => {
    const updatedUser = { ...state.user, ...profile };
    try {
      persistItem('apex_user_session', JSON.stringify(updatedUser));
    } catch (e) {}
    
    registerOrUpdateUser(updatedUser);
    
    return { 
      user: updatedUser,
      leaderboards: computeLeaderboard(updatedUser),
      friends: getUserFriends(updatedUser.username),
      incomingRequests: getIncomingRequests(updatedUser.username),
      outgoingRequests: getOutgoingRequests(updatedUser.username)
    };
  }),

  addFriend: (friend) => {
    set((state) => {
      const cleanTarget = normalizeUsername(friend.username);
      const cleanUser = normalizeUsername(state.user.username);
      const exists = state.friends.some(f => normalizeUsername(f.username) === cleanTarget);
      if (exists) return state;
      const updated = [...state.friends, { ...friend, isFollowing: true }];
      saveUserFriends(cleanUser, updated);
      return { friends: updated };
    });
  },

  removeFriend: (username) => {
    set((state) => {
      const cleanTarget = normalizeUsername(username);
      const cleanUser = normalizeUsername(state.user.username);
      apiRemoveFriendship(cleanUser, cleanTarget);
      const updated = state.friends.filter(f => normalizeUsername(f.username) !== cleanTarget);
      return { friends: updated };
    });
  },

  clearStorageCache: () => {
    try {
      localStorage.removeItem('apex_temp_crop');
      localStorage.removeItem('apex_cached_locations');
    } catch (e) {}
  },

  logoutUser: async () => {
    logAuthTransition('SIGNED_OUT');
    const freshUser = createFreshUser();
    removeItem('apex_user_session');
    removeItem('apex_onboarding_v2_completed');
    removeItem('apex_onboarding_completed');

    set({
      authStatus: 'GUEST',
      authUser: null,
      onboardingCompleted: false,
      settingsModalOpen: false,
      user: freshUser,
      garage: [],
      friends: [],
      incomingRequests: [],
      outgoingRequests: []
    });

    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch (e) {
      console.warn('Signout error', e);
    }
  },

  deleteAccount: async () => {
    logAuthTransition('ACCOUNT_DELETED');
    const state = get();
    const userId = state.user?.id || state.authUser?.id;

    try {
      // 1. Get current session token for authenticated deletion
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      // 2. Call backend deletion API if online
      if (token) {
        try {
          const apiBase = (typeof window !== 'undefined' && window.location.hostname === 'apex-spotter.vercel.app')
            ? ''
            : 'https://apex-spotter.vercel.app';
          await fetch(`${apiBase}/api/account/delete`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            }
          });
        } catch (apiErr) {
          console.warn('Backend delete endpoint notice:', apiErr);
        }
      }

      // 3. Trigger Supabase RPC delete_user_account or profile purge directly
      if (userId) {
        try {
          await supabase.rpc('delete_user_account');
        } catch (rpcErr) {
          try {
            await supabase.from('profiles').delete().eq('id', userId);
          } catch (e) {
            console.warn('Profile deletion notice:', e);
          }
        }
      }

      // 4. Sign out auth session
      try {
        await supabase.auth.signOut({ scope: 'global' });
      } catch (soErr) {
        console.warn('Signout after delete notice:', soErr);
      }
    } catch (err) {
      console.warn('Account deletion process notice:', err);
    } finally {
      // 5. Purge all persistent storage caches and local keys
      removeItem('apex_user_session');
      removeItem('apex_onboarding_v2_completed');
      removeItem('apex_onboarding_completed');
      removeItem('apex_user_profile');
      removeItem('apex_garage_items');
      removeItem('apex_registered_users');
      removeItem('apex_theme_color');

      try {
        localStorage.clear();
      } catch (e) {}

      // 6. Reset state to pristine Guest
      const freshUser = createFreshUser();
      set({
        authStatus: 'GUEST',
        authUser: null,
        onboardingCompleted: false,
        settingsModalOpen: false,
        user: freshUser,
        garage: [],
        friends: [],
        incomingRequests: [],
        outgoingRequests: [],
        activeHunts: [],
        feedPosts: [],
        notifications: []
      });
    }
  },

  resetDevelopmentState: async () => {
    const isDev = Boolean((import.meta as any)?.env?.DEV) ||
      (typeof (globalThis as any).process !== 'undefined' && (globalThis as any).process?.env?.NODE_ENV !== 'production');
    if (!isDev) {
      console.warn('[Security] resetDevelopmentState is forbidden in production environments.');
      return;
    }
    try {
      localStorage.clear();
    } catch (e) {}
    const freshUser = createFreshUser();
    set({
      authStatus: 'GUEST',
      authUser: null,
      onboardingCompleted: false,
      settingsModalOpen: false,
      user: freshUser,
      garage: [],
      friends: [],
      incomingRequests: [],
      outgoingRequests: [],
      activeHunts: [],
      feedPosts: [],
      economyLedger: [],
      leaderboards: computeLeaderboard(freshUser),
      dailyQuests: INITIAL_QUESTS,
      dailyMissions: INITIAL_MISSIONS,
      badges: INITIAL_BADGES,
    });
    try {
      await supabase.auth.signOut({ scope: 'global' });
    } catch (e) {}
  },

  awardCoins: (amount: number, reason: string, metadata?: any) => {
    const currentUser = get().user;
    const newBalance = Math.max(0, (currentUser.coins || 0) + amount);
    const entry: EconomyLedgerEntry = {
      id: `ledg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      userId: currentUser.id,
      type: 'credit',
      amount,
      balanceAfter: newBalance,
      item: metadata?.item || 'quest_reward',
      description: reason,
      metadata
    };
    set((state) => ({
      user: { ...state.user, coins: newBalance },
      economyLedger: [entry, ...(state.economyLedger || []).slice(0, 99)]
    }));
  },

  purchaseStreakFreeze: () => {
    const COST = 250;
    const user = get().user;
    if ((user.coins || 0) < COST) {
      return { success: false, error: `Insufficient coins. Streak Freeze costs ${COST} coins (you have ${user.coins || 0}).` };
    }
    const newBalance = user.coins - COST;
    const currentFreezes = user.streakFreezes || 0;
    const entry: EconomyLedgerEntry = {
      id: `ledg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      userId: user.id,
      type: 'debit',
      amount: COST,
      balanceAfter: newBalance,
      item: 'streak_freeze',
      description: 'Purchased Streak Freeze (+1 protection)',
      metadata: { previousFreezes: currentFreezes, newFreezes: currentFreezes + 1 }
    };
    set((state) => ({
      user: { ...state.user, coins: newBalance, streakFreezes: currentFreezes + 1 },
      economyLedger: [entry, ...(state.economyLedger || []).slice(0, 99)]
    }));
    return { success: true };
  },

  purchaseHuntBooster: () => {
    const COST = 500;
    const user = get().user;
    if ((user.coins || 0) < COST) {
      return { success: false, error: `Insufficient coins. Radar Booster costs ${COST} coins (you have ${user.coins || 0}).` };
    }
    const newBalance = user.coins - COST;
    const boostExpiry = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    const entry: EconomyLedgerEntry = {
      id: `ledg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      userId: user.id,
      type: 'debit',
      amount: COST,
      balanceAfter: newBalance,
      item: 'hunt_booster',
      description: 'Activated 2-Hour Radar Hunt Booster',
      metadata: { activeUntil: boostExpiry }
    };
    set((state) => ({
      user: { ...state.user, coins: newBalance, activeHuntBoosterUntil: boostExpiry },
      economyLedger: [entry, ...(state.economyLedger || []).slice(0, 99)]
    }));
    return { success: true };
  },

  purchaseCardFoil: (cardId: string) => {
    const COST = 1000;
    const user = get().user;
    if ((user.coins || 0) < COST) {
      return { success: false, error: `Insufficient coins. Custom Foil costs ${COST} coins (you have ${user.coins || 0}).` };
    }
    const targetCard = get().garage.find((c) => c.id === cardId);
    if (!targetCard) {
      return { success: false, error: 'Vehicle card not found in garage.' };
    }
    if (targetCard.customFoil) {
      return { success: false, error: 'This vehicle card already has Custom Foil applied.' };
    }
    const newBalance = user.coins - COST;
    const entry: EconomyLedgerEntry = {
      id: `ledg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      userId: user.id,
      type: 'debit',
      amount: COST,
      balanceAfter: newBalance,
      item: 'card_foil',
      description: `Applied Custom Holographic Foil to ${targetCard.make} ${targetCard.model}`,
      metadata: { cardId }
    };
    set((state) => {
      const updatedGarage = state.garage.map((c) =>
        c.id === cardId ? { ...c, customFoil: true } : c
      );
      try {
        localStorage.setItem('apex_garage_cards', JSON.stringify(updatedGarage));
      } catch (e) {}
      return {
        user: { ...state.user, coins: newBalance },
        garage: updatedGarage,
        economyLedger: [entry, ...(state.economyLedger || []).slice(0, 99)]
      };
    });
    return { success: true };
  },

  purchaseReScan: () => {
    const COST = 100;
    const user = get().user;
    if ((user.coins || 0) < COST) {
      return { success: false, error: `Insufficient coins. Re-Scan token costs ${COST} coins (you have ${user.coins || 0}).` };
    }
    const newBalance = user.coins - COST;
    const currentTokens = user.rescanTokens || 0;
    const entry: EconomyLedgerEntry = {
      id: `ledg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      userId: user.id,
      type: 'debit',
      amount: COST,
      balanceAfter: newBalance,
      item: 'rescan_token',
      description: 'Purchased Neural Re-Scan Token (+1)',
      metadata: { newTokens: currentTokens + 1 }
    };
    set((state) => ({
      user: { ...state.user, coins: newBalance, rescanTokens: currentTokens + 1 },
      economyLedger: [entry, ...(state.economyLedger || []).slice(0, 99)]
    }));
    return { success: true };
  },

  updateCardInGarage: (cardId: string, updates: Partial<CarCard>) => {
    set((state) => {
      const updatedGarage = state.garage.map((c) =>
        c.id === cardId ? { ...c, ...updates } : c
      );
      try {
        localStorage.setItem('apex_garage_cards', JSON.stringify(updatedGarage));
      } catch (e) {}
      return { garage: updatedGarage };
    });
  },

  blockUser: (targetUserId: string) => {
    set((state) => {
      const currentBlocked = state.user.blockedUsers || [];
      if (currentBlocked.includes(targetUserId)) return state;
      const updatedBlocked = [...currentBlocked, targetUserId];
      return {
        user: { ...state.user, blockedUsers: updatedBlocked },
        feedPosts: state.feedPosts.filter((p) => p.user.id !== targetUserId)
      };
    });
  },

  unblockUser: (targetUserId: string) => {
    set((state) => ({
      user: {
        ...state.user,
        blockedUsers: (state.user.blockedUsers || []).filter((id) => id !== targetUserId)
      }
    }));
  },

  setActiveTab: (tab) => set({ activeTab: tab }),

  setScannerOpen: (open) => set({ scannerOpen: open }),

  setPersona: (persona) => set((state) => ({
    user: { ...state.user, persona },
    dailyQuests: generatePersonaQuests(persona)
  })),
  
  initializeSession: async (userId: string, authEmail?: string, provider?: string, userMetadata?: any) => {
    logAuthTransition('PROFILE_LOADING', userId, authEmail);
    const resolvedEmail = authEmail || '';
    const determinedProvider = provider || (resolvedEmail.includes('gmail') || resolvedEmail.includes('google') ? 'google' : 'email');

    set({ 
      authStatus: 'AUTHENTICATED_PROFILE_LOADING',
      authUser: {
        id: userId,
        email: resolvedEmail,
        provider: determinedProvider
      }
    });

    try {
      // 1. Authoritatively fetch profile from Supabase using only valid columns
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, level, xp, coins, streak_days, last_scan_at, total_spots, rarest_find, created_at, daily_scans_count, daily_scans_reset_at, last_login_at')
        .eq('id', userId)
        .maybeSingle();

      // 2. Fetch garage cars belonging to this auth user
      const { data: garage } = await supabase
        .from('garage')
        .select('*')
        .eq('user_id', userId)
        .limit(100);

      // Determine if this account is an established existing active profile
      const isExistingActiveUser = Boolean(
        profile && (
          (profile.username && !profile.username.startsWith('hunter_') && !profile.username.startsWith('spotter_')) ||
          (profile.xp && profile.xp > 0) ||
          (profile.level && profile.level > 1) ||
          (profile.total_spots && profile.total_spots > 0) ||
          (garage && garage.length > 0)
        )
      );

      // Authoritative onboarding state: true if metadata says true, OR if established profile and not explicitly set false
      const isOnboardingDone = 
        userMetadata?.onboarding_completed === true || 
        (isExistingActiveUser && userMetadata?.onboarding_completed !== false);

      if (isOnboardingDone && userMetadata?.onboarding_completed !== true) {
        supabase.auth.updateUser({ data: { onboarding_completed: true } }).catch(() => {});
      }

      if (profile) {
        // Existing profile in Supabase: Hydrate existing identity & progress
        const cached = getSavedUser();
        const resolvedStreakDays = (profile.streak_days && profile.streak_days > 0)
          ? profile.streak_days
          : (userMetadata?.streak_days || (cached.id === userId ? cached.streakDays : 0) || 0);

        const resolvedStreakLastAt = userMetadata?.streak_last_at || 
          (profile as any).streak_last_at || 
          profile.last_scan_at || 
          (cached.id === userId ? cached.streakLastAt : undefined) || 
          undefined;

        const mergedUser: UserProfile = {
          ...INITIAL_USER,
          id: profile.id,
          username: profile.username || `hunter_${userId.substring(0, 6)}`,
          displayName: profile.display_name || 'Apex Hunter',
          email: resolvedEmail,
          avatarUrl: profile.avatar_url || INITIAL_USER.avatarUrl,
          level: profile.level ?? 1,
          xp: profile.xp ?? 0,
          coins: profile.coins ?? 0,
          streakDays: resolvedStreakDays,
          streakLastAt: resolvedStreakLastAt,
          totalSpots: profile.total_spots ?? 0,
          rarestFind: (profile.rarest_find as any) || 'None',
          city: userMetadata?.city || '',
          country: userMetadata?.country || '',
          bio: userMetadata?.bio || '',
          driverTitle: userMetadata?.driver_title || 'Apex Spotter',
          favoriteCar: userMetadata?.favorite_car || '',
          favoriteBrand: userMetadata?.favorite_brand || '',
          cardThemeColor: userMetadata?.card_theme_color || '#E50914',
          speedUnits: userMetadata?.speed_units || 'kmh',
          soundEffectsEnabled: userMetadata?.sound_effects_enabled !== false
        };

        const localCards = getSavedGarage(mergedUser.id);
        const cardMap = new Map<string, CarCard>();
        localCards.forEach(c => { if (c?.id) cardMap.set(c.id, c); });

        if (garage && garage.length > 0) {
          garage.forEach(g => {
            const existing = cardMap.get(g.id);
            const remoteCard = createSampleCard({
              id: g.id,
              cardNumber: g.card_number || existing?.cardNumber || `#APX-${Math.floor(100000 + Math.random() * 900000)}`,
              make: g.make,
              model: g.model,
              yearEstimate: String(g.year_estimate || existing?.yearEstimate || 2023),
              bodyStyle: (g.body_style as any) || existing?.bodyStyle || 'Coupe',
              rarity: (g.rarity as any) || existing?.rarity || 'rare',
              rarityScore: g.rarity_score || existing?.rarityScore || 75,
              horsepower: g.horsepower || existing?.horsepower || 400,
              topSpeedKmH: g.top_speed_kmh || existing?.topSpeedKmH || 280,
              zeroToHundredSec: g.zero_to_hundred_sec || existing?.zeroToHundredSec || 3.8,
              color: g.color || existing?.color || 'Standard',
              imageUrl: g.image_url || existing?.imageUrl || '',
              city: g.city || existing?.city || 'Tokyo',
              country: g.country || existing?.country || 'Japan',
              originCountry: g.origin_country || existing?.originCountry || 'Japan',
              interestingFact: g.interesting_fact || existing?.interestingFact || 'Precision engineering.',
              briefHistory: g.brief_history || existing?.briefHistory || 'Performance icon.',
              modsDetected: g.mods_detected || existing?.modsDetected || [],
              createdAt: g.created_at || existing?.createdAt || new Date().toISOString(),
              pendingDeletionUntil: g.pending_deletion_until || undefined,
              isPublic: true,
              privacyLevel: 'public_blurred',
              xpEarned: existing?.xpEarned || 250,
              aiConfidence: existing?.aiConfidence || 0.95
            });
            if (existing?.imageUrl && (!remoteCard.imageUrl || remoteCard.imageUrl.startsWith('indexeddb://'))) {
              remoteCard.imageUrl = existing.imageUrl;
            }
            cardMap.set(g.id, remoteCard);
          });
        }
        const hydratedGarage: CarCard[] = Array.from(cardMap.values());

        try {
          persistItem('apex_user_session', JSON.stringify(mergedUser));
          persistLightweightGarage(mergedUser.id, hydratedGarage);
          if (isOnboardingDone) {
            persistItem('apex_onboarding_v2_completed', 'true');
          }
        } catch (e) {}

        await registerOrUpdateUser(mergedUser);
        logAuthTransition('PROFILE_LOADED', userId, resolvedEmail);

        const serverDailyScans = profile.daily_scans_count ?? 0;
        const currentQuests = get().dailyQuests;
        const updatedQuests = currentQuests.map(q => {
          if (q.id === 'quest-daily-spotlight') {
            return {
              ...q,
              currentCount: serverDailyScans,
              isCompleted: serverDailyScans >= q.targetCount
            };
          }
          return q;
        });

        set({
          authStatus: 'AUTHENTICATED',
          authUser: {
            id: userId,
            email: resolvedEmail,
            provider: determinedProvider
          },
          user: mergedUser,
          garage: hydratedGarage,
          dailyQuests: updatedQuests,
          friends: getUserFriends(mergedUser.username),
          incomingRequests: getIncomingRequests(mergedUser.username),
          outgoingRequests: getOutgoingRequests(mergedUser.username),
          leaderboards: computeLeaderboard(mergedUser),
          onboardingCompleted: isOnboardingDone
        });
      } else {
        // Missing profile in Supabase: Idempotently create exactly one default profile row
        const derivedUsername = userMetadata?.username || (resolvedEmail ? resolvedEmail.split('@')[0].replace(/[^a-z0-9_]/gi, '').toLowerCase() : `hunter_${userId.substring(0, 6)}`);
        const derivedDisplayName = userMetadata?.full_name || userMetadata?.display_name || 'Apex Hunter';

        const newProfileRow = {
          id: userId,
          username: derivedUsername,
          display_name: derivedDisplayName,
          level: 1,
          xp: 0,
          coins: 50,
          streak_days: 0,
          total_spots: 0,
          rarest_find: 'None'
        };

        try {
          await supabase.from('profiles').upsert([newProfileRow], { onConflict: 'id' });
        } catch (insertErr) {
          console.warn('Idempotent profile creation notice:', insertErr);
        }

        const existingLocalGarage = getSavedGarage(userId);
        const newUser: UserProfile = {
          ...INITIAL_USER,
          id: userId,
          username: derivedUsername,
          displayName: derivedDisplayName,
          email: resolvedEmail,
          city: userMetadata?.city || '',
          country: userMetadata?.country || '',
          totalSpots: existingLocalGarage.length
        };

        try {
          persistItem('apex_user_session', JSON.stringify(newUser));
          persistLightweightGarage(userId, existingLocalGarage);
        } catch (e) {}

        await registerOrUpdateUser(newUser);
        logAuthTransition('PROFILE_LOADED', userId, resolvedEmail);

        set({
          authStatus: 'AUTHENTICATED',
          authUser: {
            id: userId,
            email: resolvedEmail,
            provider: determinedProvider
          },
          user: newUser,
          garage: existingLocalGarage,
          friends: [],
          incomingRequests: [],
          outgoingRequests: [],
          leaderboards: computeLeaderboard(newUser),
          onboardingCompleted: isOnboardingDone
        });
      }

      try {
        await get().fetchFeedPosts();
      } catch (e) {}

      try {
        await get().purgeExpiredDeletedCards();
      } catch (e) {}
    } catch (err) {
      console.warn('Error during initializeSession:', err);
      logAuthTransition('AUTH_ERROR', userId, authEmail, { error: err });
      const cached = getSavedUser();
      const fallbackUser: UserProfile = {
        ...cached,
        id: userId,
        email: resolvedEmail || cached.email
      };
      set({
        authStatus: 'AUTHENTICATED',
        authUser: {
          id: userId,
          email: fallbackUser.email,
          provider: determinedProvider
        },
        user: fallbackUser,
        garage: getSavedGarage(userId),
        onboardingCompleted: getSavedOnboarding()
      });
    }
  },

  fetchFeedPosts: async () => {
    try {
      let postsData: any[] | null = null;
      const { data, error } = await supabase
        .from('posts')
        .select(`
          id, caption, likes_count, comments_count, created_at, media_type, media_url, thumbnail_url,
          profiles ( id, username, avatar_url, level ),
          garage ( * )
        `)
        .order('created_at', { ascending: false })
        .limit(30);

      if (error) {
        if (error.message?.includes('media_type') || error.message?.includes('column')) {
          // Graceful fallback for unmigrated database instances
          const { data: legacyData, error: legacyError } = await supabase
            .from('posts')
            .select(`
              id, caption, likes_count, comments_count, created_at,
              profiles ( id, username, avatar_url, level ),
              garage ( * )
            `)
            .order('created_at', { ascending: false })
            .limit(30);
          if (!legacyError && legacyData) {
            postsData = legacyData;
          }
        } else {
          console.error("Error fetching feed posts:", error.message);
          return;
        }
      } else {
        postsData = data;
      }

      if (postsData && postsData.length > 0) {
        const mappedPosts: FeedPost[] = postsData.map((p: any) => ({
          id: p.id,
          user: {
            id: p.profiles?.id || 'unknown',
            username: p.profiles?.username || 'unknown',
            avatarUrl: p.profiles?.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop',
            level: p.profiles?.level || 1
          },
          mediaType: p.media_type || (p.garage ? 'image' : 'image'),
          mediaUrl: p.media_url || p.garage?.image_url,
          thumbnailUrl: p.thumbnail_url || p.garage?.image_url,
          card: p.garage ? {
            id: p.garage.id || 'unknown',
            cardNumber: p.garage.card_number || '#APX-UNKNOWN',
            make: p.garage.make || 'Unknown',
            model: p.garage.model || 'Unknown',
            yearEstimate: p.garage.year_estimate || 'Unknown',
            color: p.garage.color || 'Unknown',
            rarity: p.garage.rarity || 'common',
            rarityScore: 50,
            imageUrl: p.garage.image_url || '',
            city: p.garage.city || 'Unknown',
            country: p.garage.country || 'Unknown',
            latApprox: p.garage.latitude || 0,
            lngApprox: p.garage.longitude || 0,
            horsepower: p.garage.horsepower || 0,
            topSpeedKmH: p.garage.top_speed_kmh || 0,
            xpEarned: p.garage.xp_earned || 0,
            isMinted: p.garage.is_minted || false,
            createdAt: p.garage.scanned_at || new Date().toISOString(),
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
          } : undefined,
          likesCount: p.likes_count || 0,
          commentsCount: p.comments_count || 0,
          isLiked: false,
          createdAt: p.created_at
        }));
        
        const userPostIds = new Set(mappedPosts.map(p => p.id));
        const nonDuplicateSamples = SAMPLE_FEED_POSTS.filter(s => !userPostIds.has(s.id));
        set({ feedPosts: [...mappedPosts, ...nonDuplicateSamples] });
      } else {
        set({ feedPosts: getSavedPosts() });
      }
    } catch (e) {
      console.error('Failed to fetch feed posts:', e);
      set({ feedPosts: getSavedPosts() });
    }
  },

  completeOnboarding: () => {
    try {
      persistItem('apex_onboarding_v2_completed', 'true');
      supabase.auth.updateUser({
        data: { onboarding_completed: true }
      }).catch((e) => {
        console.warn('Notice updating onboarding metadata:', e);
      });
    } catch (e) {}
    const currentUser = get().user;
    registerOrUpdateUser(currentUser);
    set({ 
      onboardingCompleted: true,
      leaderboards: computeLeaderboard(currentUser)
    });
  },

  addCardToGarage: async (newCard, customCaption, options) => {
    sounds.playXpPop();
    const shouldPublishToFeed = options?.publishToFeed === true;
    const postCaption = shouldPublishToFeed ? (customCaption?.trim() || `Just discovered this ${newCard.make} ${newCard.model} in ${newCard.city}!`) : null;
    
    // Count previous spots of this vehicle model in current user's garage
    const previousSpotsOfModel = get().garage.filter(
      c => c.make.toLowerCase() === newCard.make.toLowerCase() && c.model.toLowerCase() === newCard.model.toLowerCase()
    ).length;
    const isFirstEverDiscovery = previousSpotsOfModel === 0;

    const discoveryXpResult = calculateDiscoveryXp({
      rarity: newCard.rarity,
      isFirstEverDiscovery,
      previousSpotsOfModel,
      identificationQuality: {
        hasMake: Boolean(newCard.make),
        hasModel: Boolean(newCard.model),
        hasGeneration: Boolean(newCard.generation),
        hasYearRange: Boolean(newCard.yearEstimate || newCard.productionYears),
        hasTrim: Boolean(newCard.trim)
      },
      context: {
        isNewLocation: !get().garage.some(c => c.city && c.city.toLowerCase() === (newCard.city || '').toLowerCase()),
        isNight: new Date().getHours() >= 20 || new Date().getHours() < 6
      }
    });

    let authoritativeXp = discoveryXpResult.finalAwardedXp;
    let authoritativeRarity = newCard.rarity;
    let serverCardId = newCard.id;

    // Apply location privacy configuration
    const privacyMode = options?.privacyMode || 'approx_delayed_5';
    let cardPrivacyLevel: PrivacyLevel = 'public_blurred';
    let isPublicCard = true;

    if (privacyMode === 'private_hidden') {
      cardPrivacyLevel = 'no_hunt_private';
      isPublicCard = false;
    } else if (privacyMode === 'exact_delayed_15') {
      cardPrivacyLevel = 'approximate_only';
      isPublicCard = true;
    } else {
      cardPrivacyLevel = 'public_blurred';
      isPublicCard = true;
    }

    let localRarityData: LocalRarityInfo | undefined = newCard.localRarity;

    // Check if scan was already recorded authoritatively during onScanCompleted
    if ((newCard as any).serverRecorded) {
      if ((newCard as any).serverCardId) {
        serverCardId = (newCard as any).serverCardId;
      }
      if (shouldPublishToFeed && postCaption) {
        try {
          supabase.from('posts').insert([{
            user_id: get().user?.id,
            car_id: serverCardId,
            caption: postCaption,
            likes_count: 0,
            comments_count: 0
          }]);
        } catch (_) {}
      }
    } else {
      // Invoke Authoritative Server-Side PostgreSQL RPC if connected
      try {
        const canonicalId = (newCard as any).canonicalVehicleId || 
          `${newCard.make}-${newCard.model}`.toLowerCase().replace(/[^a-z0-9]+/g, '-');

        const { data: rpcResult, error: rpcError } = await supabase.rpc('record_car_scan', {
        p_make: newCard.make,
        p_model: newCard.model,
        p_year_estimate: newCard.yearEstimate || 'Unknown',
        p_color: newCard.color || 'Unknown',
        p_image_url: newCard.imageUrl,
        p_city: newCard.city || 'Local Area',
        p_country: newCard.country || 'Global',
        p_latitude: isPublicCard ? (newCard.latApprox || null) : null,
        p_longitude: isPublicCard ? (newCard.lngApprox || null) : null,
        p_horsepower: newCard.horsepower || 0,
        p_top_speed_kmh: newCard.topSpeedKmH || 0,
        p_caption: postCaption,
        p_image_hash: newCard.imageHash || computeImageSha256(newCard.imageUrl) || `hash_${newCard.make}_${newCard.model}_${newCard.id}`,
        p_canonical_vehicle_id: canonicalId,
        p_geography_bucket: options?.geoBucket || (newCard as any).geoBucket || (newCard.localRarity as any)?.geographyBucket || null,
        p_scanner_status: newCard.identificationStatus || 'identified',
        p_ai_confidence: newCard.aiConfidence || 0.95,
        p_local_rarity_enabled: featureFlags.isLocalRarityEnabled() && get().localRarityEnabled !== false
      });

      if (!rpcError && rpcResult?.success) {
        authoritativeXp = rpcResult.xp_earned || authoritativeXp;
        authoritativeRarity = rpcResult.global_rarity || rpcResult.rarity || authoritativeRarity;
        serverCardId = rpcResult.card_id || serverCardId;

        if (rpcResult.local_rarity_tier && rpcResult.confidence_state && featureFlags.isLocalRarityEnabled()) {
          const isXpEnabled = featureFlags.isLocalRarityXpEnabled() && get().localRarityXpEnabled !== false;
          const xpModifier = isXpEnabled ? (rpcResult.local_xp_modifier || 1.0) : 1.0;
          const bonusXp = isXpEnabled ? (rpcResult.local_bonus_xp || 0) : 0;
          const coarseName = rpcResult.coarse_area_name || newCard.city || 'Your Area';
          const geoBucketId = options?.geoBucket || (newCard as any).geoBucket || (newCard.localRarity as any)?.geographyBucket || 'global';

          const isDev = Boolean((import.meta as any)?.env?.DEV) || 
            (typeof (globalThis as any).process !== 'undefined' && (globalThis as any).process?.env?.NODE_ENV !== 'production');
          let explanationDebug: RarityExplanationDebug | undefined;

          if (isDev) {
            explanationDebug = {
              canonicalVehicleId: canonicalId,
              coarseAreaName: coarseName,
              geographyBucketId: geoBucketId,
              globalRarityTier: rpcResult.global_rarity || authoritativeRarity,
              globalRarityScore: rpcResult.global_rarity_score || 50,
              globalPrevalencePrior: 0.05,
              localObservationMass: rpcResult.local_observation_mass || 0,
              bucketTotalMass: rpcResult.bucket_total_mass || 0,
              uniqueContributors: rpcResult.unique_contributors || 0,
              bucketTotalContributors: rpcResult.bucket_unique_contributors || 0,
              confidenceState: rpcResult.confidence_state,
              confidenceWeight: rpcResult.confidence_weight || 0,
              localSightingPrevalence: rpcResult.local_prevalence || 0,
              prevalenceRatio: rpcResult.prevalence_ratio || 1.0,
              rawLocalScore: rpcResult.raw_local_score || rpcResult.local_rarity_score || 50,
              blendedScore: rpcResult.local_rarity_score || 50,
              localRarityTier: rpcResult.local_rarity_tier,
              localXpModifier: xpModifier,
              localBonusXp: bonusXp,
              modelVersion: rpcResult.model_version || LOCAL_RARITY_CONFIG.MODEL_VERSION,
              priorWeightAlpha: LOCAL_RARITY_CONFIG.BAYESIAN_PRIOR_WEIGHT_ALPHA,
              decisionReason: rpcResult.confidence_state === 'LOCAL_UNKNOWN'
                ? 'Sparse local data: universal rarity baseline applied'
                : 'Empirical local prevalence calculated with Bayesian Dirichlet shrinkage',
              calculatedAt: new Date().toISOString()
            };
          }

          localRarityData = {
            localRarityTier: rpcResult.local_rarity_tier,
            localRarityScore: rpcResult.local_rarity_score || 50,
            globalRarityTier: rpcResult.global_rarity || authoritativeRarity,
            globalRarityScore: rpcResult.global_rarity_score || 50,
            confidenceState: rpcResult.confidence_state,
            coarseAreaName: coarseName,
            localXpModifier: xpModifier,
            localBonusXp: bonusXp,
            explanation: rpcResult.confidence_state === 'LOCAL_UNKNOWN'
              ? 'Not enough local sighting data in your broader area yet. Universal rarity applies.'
              : `Local prevalence in ${coarseName}: ${rpcResult.local_rarity_tier.toUpperCase()}`,
            explanationDebug
          };

          // Cache authoritative server response with model version key
          localRarityCache.set(canonicalId, geoBucketId, {
            localRarityTier: localRarityData.localRarityTier,
            localRarityScore: localRarityData.localRarityScore,
            globalRarityTier: localRarityData.globalRarityTier,
            globalRarityScore: localRarityData.globalRarityScore,
            confidenceState: localRarityData.confidenceState,
            confidenceWeight: rpcResult.confidence_weight || 0,
            localPrevalence: rpcResult.local_prevalence || 0,
            globalPrevalencePrior: 0.05,
            prevalenceRatio: rpcResult.prevalence_ratio || 1.0,
            localXpModifier: localRarityData.localXpModifier,
            explanation: localRarityData.explanation,
            coarseAreaName: localRarityData.coarseAreaName,
            modelVersion: LOCAL_RARITY_CONFIG.MODEL_VERSION,
            debug: explanationDebug
          }, undefined, LOCAL_RARITY_CONFIG.MODEL_VERSION);

          localRarityTracer.recordCalculation({
            durationMs: 45,
            geographyBucket: geoBucketId,
            coarseAreaName: localRarityData.coarseAreaName,
            confidenceState: localRarityData.confidenceState,
            globalTier: localRarityData.globalRarityTier,
            localTier: localRarityData.localRarityTier,
            xpModifier: localRarityData.localXpModifier,
            bonusXp: localRarityData.localBonusXp
          });
        }
      } else if (rpcResult && !rpcResult.success) {
        localRarityTracer.recordAbuseRejection(
          rpcResult.error || 'Scan validation failed',
          options?.geoBucket || (newCard as any).geoBucket
        );
      }
    } catch (dbErr) {
      console.warn('RPC record_car_scan execution fallback:', dbErr);
    }
  }

    const authoritativeCard: CarCard = {
      ...newCard,
      id: serverCardId,
      rarity: authoritativeRarity,
      xpEarned: authoritativeXp,
      isPublic: isPublicCard,
      privacyLevel: cardPrivacyLevel,
      localRarity: localRarityData,
      explanationDebug: localRarityData?.explanationDebug
    };

    // Trigger Hunt if requested and allowed
    if (options?.allowHunts && isPublicCard && authoritativeRarity !== 'common') {
      get().triggerMockHunt(authoritativeCard);
    }

    set((state) => {
      const updatedGarage = [authoritativeCard, ...state.garage];
      persistLightweightGarage(state.user.id, updatedGarage);

      const xpResult = processXpGain(state.user, authoritativeXp, `${authoritativeRarity.toUpperCase()} Discovery`);
      const updatedUser: UserProfile = {
        ...xpResult.updatedUser,
        totalSpots: (state.user.totalSpots || 0) + 1
      };

      // Only increment quests if not already processed in onScanCompleted
      let updatedQuests = state.dailyQuests;
      if (!(newCard as any).serverRecorded) {
        updatedQuests = state.dailyQuests.map(quest => {
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
      }

      // Missions must be authoritatively verified and claimed via claimMissionReward
      const updatedMissions = state.dailyMissions;

      let updatedPosts = state.feedPosts;
      if (shouldPublishToFeed && postCaption) {
        const newPost: FeedPost = {
          id: `post-${Date.now()}`,
          user: {
            id: updatedUser.id,
            username: updatedUser.username || 'driver',
            avatarUrl: updatedUser.avatarUrl,
            level: updatedUser.level
          },
          card: authoritativeCard,
          caption: postCaption,
          likesCount: 0,
          commentsCount: 0,
          isLiked: false,
          createdAt: 'Just now',
          comments: []
        };
        updatedPosts = [newPost, ...state.feedPosts];
        try {
          localStorage.setItem('apex_user_posts', JSON.stringify(updatedPosts));
        } catch (e) {}
      }

      try {
        localStorage.setItem('apex_user_session', JSON.stringify(updatedUser));
      } catch (e) {}
      registerOrUpdateUser(updatedUser);

      // Cloud persistence: save vehicle to Supabase garage table
      try {
        supabase.from('garage').upsert([{
          id: authoritativeCard.id,
          user_id: updatedUser.id,
          make: authoritativeCard.make,
          model: authoritativeCard.model,
          year_estimate: authoritativeCard.yearEstimate,
          body_style: authoritativeCard.bodyStyle,
          rarity: authoritativeCard.rarity,
          rarity_score: authoritativeCard.rarityScore,
          horsepower: authoritativeCard.horsepower,
          top_speed_kmh: authoritativeCard.topSpeedKmH,
          zero_to_hundred_sec: authoritativeCard.zeroToHundredSec,
          color: authoritativeCard.color,
          image_url: authoritativeCard.imageUrl,
          city: authoritativeCard.city,
          country: authoritativeCard.country,
          origin_country: authoritativeCard.originCountry,
          interesting_fact: authoritativeCard.interestingFact,
          brief_history: authoritativeCard.briefHistory,
          created_at: authoritativeCard.createdAt
        }]);
      } catch (e) {}

      return {
        garage: updatedGarage,
        user: updatedUser,
        levelUpLevel: xpResult.leveledUp ? updatedUser.level : state.levelUpLevel,
        dailyQuests: updatedQuests,
        dailyMissions: updatedMissions,
        feedPosts: updatedPosts,
        leaderboards: computeLeaderboard(updatedUser)
      };
    });
  },

  deletePost: async (postId: string) => {
    sounds.playTargetAcquired();
    set((state) => {
      const updatedPosts = state.feedPosts.filter(p => p.id !== postId);
      try {
        localStorage.setItem('apex_user_posts', JSON.stringify(updatedPosts));
      } catch (e) {}
      return { feedPosts: updatedPosts };
    });

    try {
      await supabase.from('feed_posts').delete().eq('id', postId);
    } catch (e) {
      console.warn('Supabase delete post error:', e);
    }
  },

  scheduleCardDeletion: async (cardId: string) => {
    sounds.playTargetAcquired();
    const threeDaysFromNow = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    const currentGarage = get().garage;
    const updatedGarage = currentGarage.map(card => 
      card.id === cardId ? { ...card, pendingDeletionUntil: threeDaysFromNow } : card
    );

    const selected = get().selectedCardForDetail;
    const updatedSelected = selected && selected.id === cardId 
      ? { ...selected, pendingDeletionUntil: threeDaysFromNow } 
      : selected;

    set({ garage: updatedGarage, selectedCardForDetail: updatedSelected });

    const userId = get().user.id;
    try {
      persistItem(`apex_garage_cards_${userId}`, JSON.stringify(updatedGarage));
      persistItem('apex_garage_cards', JSON.stringify(updatedGarage));
    } catch (e) {}

    try {
      await supabase.from('garage').update({
        pending_deletion_until: threeDaysFromNow
      } as any).eq('id', cardId);
    } catch (err) {
      console.warn('Notice syncing card deletion schedule to Supabase:', err);
    }
  },

  cancelCardDeletion: async (cardId: string) => {
    sounds.playTargetLock();
    const currentGarage = get().garage;
    const updatedGarage = currentGarage.map(card => {
      if (card.id === cardId) {
        const { pendingDeletionUntil: _pendingDeletionUntil, ...rest } = card;
        return rest;
      }
      return card;
    });

    const selected = get().selectedCardForDetail;
    let updatedSelected = selected;
    if (selected && selected.id === cardId) {
      const { pendingDeletionUntil: _pendingDeletionUntil, ...rest } = selected;
      updatedSelected = rest;
    }

    set({ garage: updatedGarage, selectedCardForDetail: updatedSelected });

    const userId = get().user.id;
    try {
      persistItem(`apex_garage_cards_${userId}`, JSON.stringify(updatedGarage));
      persistItem('apex_garage_cards', JSON.stringify(updatedGarage));
    } catch (e) {}

    try {
      await supabase.from('garage').update({
        pending_deletion_until: null
      } as any).eq('id', cardId);
    } catch (err) {
      console.warn('Notice syncing card restoration to Supabase:', err);
    }
  },

  purgeExpiredDeletedCards: async () => {
    const currentGarage = get().garage;
    const now = Date.now();
    const expiredCards = currentGarage.filter(c => 
      c.pendingDeletionUntil && new Date(c.pendingDeletionUntil).getTime() <= now
    );

    if (expiredCards.length === 0) return;

    const remainingGarage = currentGarage.filter(c => 
      !c.pendingDeletionUntil || new Date(c.pendingDeletionUntil).getTime() > now
    );

    set({ garage: remainingGarage });
    const userId = get().user.id;
    try {
      persistItem(`apex_garage_cards_${userId}`, JSON.stringify(remainingGarage));
      persistItem('apex_garage_cards', JSON.stringify(remainingGarage));
    } catch (e) {}

    for (const card of expiredCards) {
      try {
        await supabase.from('garage').delete().eq('id', card.id);
      } catch (e) {}
    }
  },


  addXp: (amount, reason) => {
    sounds.playXpPop();
    const xpResult = processXpGain(get().user, amount, reason);
    const updatedUser = xpResult.updatedUser;

    try {
      persistItem('apex_user_session', JSON.stringify(updatedUser));
    } catch (e) {}

    set({
      user: updatedUser,
      levelUpLevel: xpResult.leveledUp ? updatedUser.level : get().levelUpLevel
    });

    // Defer network sync and leaderboards recomputation so animation frame is never blocked
    setTimeout(() => {
      registerOrUpdateUser(updatedUser);
      set({ leaderboards: computeLeaderboard(updatedUser) });
    }, 250);
  },

  toggleLikePost: (postId) => {
    set((state) => {
      const updatedPosts = state.feedPosts.map((post) => {
        if (post.id === postId) {
          const isLiked = !post.isLiked;
          return {
            ...post,
            isLiked,
            likesCount: isLiked ? post.likesCount + 1 : post.likesCount - 1
          };
        }
        return post;
      });
      try {
        localStorage.setItem('apex_user_posts', JSON.stringify(updatedPosts));
      } catch (e) {}
      return { feedPosts: updatedPosts };
    });
  },

  addCommentToPost: (postId, text) => {
    sounds.playXpPop();
    set((state) => {
      const newComment: PostComment = {
        id: `c-${Date.now()}`,
        user: {
          id: state.user.id,
          username: state.user.username || 'driver',
          avatarUrl: state.user.avatarUrl,
          level: state.user.level
        },
        text: text.trim(),
        createdAt: 'Just now',
        likesCount: 0,
        isLiked: false
      };

      const updatedPosts = state.feedPosts.map((post) => {
        if (post.id === postId) {
          const existingComments = post.comments || [];
          return {
            ...post,
            commentsCount: post.commentsCount + 1,
            comments: [newComment, ...existingComments]
          };
        }
        return post;
      });

      try {
        localStorage.setItem('apex_user_posts', JSON.stringify(updatedPosts));
      } catch (e) {}

      return { feedPosts: updatedPosts };
    });
  },

  toggleLikeComment: (postId, commentId) => {
    set((state) => {
      const updatedPosts = state.feedPosts.map((post) => {
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
      });
      try {
        localStorage.setItem('apex_user_posts', JSON.stringify(updatedPosts));
      } catch (e) {}
      return { feedPosts: updatedPosts };
    });
  },

  toggleEnthusiastModal: (open) => set((state) => ({
    enthusiastModalOpen: open !== undefined ? open : !state.enthusiastModalOpen
  })),

  setSelectedCardForDetail: (card) => set({ selectedCardForDetail: card }),

  dismissHuntAlert: () => set({ activeHuntAlert: null }),

  openHuntModal: (hunt) => set({ activeHuntModal: hunt }),

  closeHuntModal: () => set({ activeHuntModal: null }),

  abandonHunt: (huntId) => {
    set((state) => {
      const remaining = huntId ? state.activeHunts.filter(h => h.id !== huntId) : [];
      return {
        activeHunts: remaining,
        activeHuntAlert: null,
        activeHuntModal: null
      };
    });
  },

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
      radiusKm: 1.0,
      startedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      participantsCount: 8,
      city: card.city,
      imageUrl: card.imageUrl,
      status: 'active'
    };
    set((state) => ({
      activeHunts: [mockHunt, ...state.activeHunts],
      activeHuntAlert: mockHunt,
      activeHuntModal: null
    }));
  },

  onScanCompleted: async (card: CarCard) => {
    // 1. Authoritative Server Path: record_car_scan transaction on database
    let authoritativeDailyScans: number | null = null;

    try {
      const canonicalId = (card as any).canonicalVehicleId || 
        `${card.make}-${card.model}`.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const imageHash = card.imageHash || computeImageSha256(card.imageUrl) || `hash_${card.make}_${card.model}_${card.id}`;

      const { data: rpcResult, error: rpcError } = await supabase.rpc('record_car_scan', {
        p_make: card.make,
        p_model: card.model,
        p_year_estimate: card.yearEstimate || 'Unknown',
        p_color: card.color || 'Unknown',
        p_image_url: card.imageUrl,
        p_city: card.city || 'Local Area',
        p_country: card.country || 'Global',
        p_latitude: card.latApprox || null,
        p_longitude: card.lngApprox || null,
        p_horsepower: card.horsepower || 0,
        p_top_speed_kmh: card.topSpeedKmH || 0,
        p_caption: null, // Hard invariant: scan event never auto-publishes to community feed
        p_image_hash: imageHash,
        p_canonical_vehicle_id: canonicalId,
        p_geography_bucket: (card as any).geoBucket || (card.localRarity as any)?.geographyBucket || null,
        p_scanner_status: card.identificationStatus || 'identified',
        p_ai_confidence: card.aiConfidence || 0.95,
        p_local_rarity_enabled: featureFlags.isLocalRarityEnabled() && get().localRarityEnabled !== false
      });

      if (!rpcError && rpcResult?.success) {
        (card as any).serverRecorded = true;
        if (rpcResult.card_id) {
          (card as any).serverCardId = rpcResult.card_id;
          card.id = rpcResult.card_id;
        }

        const currentUser = get().user;
        if (currentUser && currentUser.id) {
          // Fetch authoritative daily_scans_count updated by record_car_scan in profiles table
          const { data: profRow } = await supabase
            .from('profiles')
            .select('daily_scans_count')
            .eq('id', currentUser.id)
            .maybeSingle();

          if (profRow && typeof profRow.daily_scans_count === 'number') {
            authoritativeDailyScans = profRow.daily_scans_count;
          }

          const updatedUser: UserProfile = {
            ...currentUser,
            xp: rpcResult.new_total_xp ?? currentUser.xp,
            level: rpcResult.new_level ?? currentUser.level,
            totalSpots: (currentUser.totalSpots || 0) + 1
          };
          set({
            user: updatedUser,
            leaderboards: computeLeaderboard(updatedUser)
          });
          registerOrUpdateUser(updatedUser);
        }
      }
    } catch (scanErr) {
      console.warn('[onScanCompleted] RPC record_car_scan notice:', scanErr);
    }

    // 2. Authoritative UI Quest State Update:
    // Uses server-returned daily_scans_count when online/authenticated, with local increment fallback for offline/guest
    set((state) => {
      const updatedQuests = state.dailyQuests.map(quest => {
        if (quest.id === 'quest-daily-spotlight') {
          const newCount = authoritativeDailyScans !== null 
            ? authoritativeDailyScans 
            : (quest.currentCount + 1);
          const isNowCompleted = newCount >= quest.targetCount;
          return {
            ...quest,
            currentCount: newCount,
            isCompleted: isNowCompleted
          };
        }
        if (!quest.isCompleted && (!quest.allowedMakes || quest.allowedMakes.length === 0 || quest.allowedMakes.includes(card.make))) {
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

      try {
        const today = new Date().toISOString().slice(0, 10);
        localStorage.setItem('apex_daily_quests_date', today);
        localStorage.setItem('apex_daily_quests', JSON.stringify(updatedQuests));
      } catch (e) {}

      return { dailyQuests: updatedQuests };
    });
  },

  rehydrateCardImages: (cards: CarCard[]) => {
    set({ garage: cards });
  },

  claimMissionReward: async (missionId: string) => {
    const currentUser = get().user;
    if (!currentUser || !currentUser.id) {
      return { success: false, error: 'Authentication required to claim rewards.' };
    }

    try {
      // 1. Authoritative Server RPC verification
      const { data: rpcData, error: rpcError } = await supabase.rpc('claim_mission_reward', {
        p_mission_id: missionId
      });

      if (!rpcError && rpcData?.success) {
        sounds.playXpPop();
        const xpGain = rpcData.xp_awarded || 0;
        const coinsGain = rpcData.coins_awarded || 0;
        const updatedMissions = get().dailyMissions.map(m => 
          m.id === missionId ? { ...m, completed: true } : m
        );
        const updatedUser: UserProfile = {
          ...currentUser,
          xp: rpcData.new_xp ?? ((currentUser.xp || 0) + xpGain),
          coins: rpcData.new_coins ?? ((currentUser.coins || 0) + coinsGain),
          level: rpcData.new_level ?? currentUser.level
        };

        set({
          dailyMissions: updatedMissions,
          user: updatedUser,
          levelUpLevel: (updatedUser.level > currentUser.level) ? updatedUser.level : get().levelUpLevel,
          leaderboards: computeLeaderboard(updatedUser)
        });

        try {
          const today = new Date().toISOString().slice(0, 10);
          localStorage.setItem('apex_daily_missions_date', today);
          localStorage.setItem('apex_daily_missions', JSON.stringify(updatedMissions));
          localStorage.setItem('apex_user_session', JSON.stringify(updatedUser));
        } catch (e) {}

        registerOrUpdateUser(updatedUser);
        return { success: true, xpAwarded: xpGain, coinsAwarded: coinsGain };
      }

      if (rpcError) {
        const notFound = rpcError.message?.includes('Could not find the function') || rpcError.code === 'PGRST202';
        if (!notFound) {
          return { success: false, error: rpcError.message };
        }
        console.warn('[claimMissionReward] RPC not in schema cache, trying /api/missions/claim fallback');
      }
    } catch (err: any) {
      console.warn('[claimMissionReward] RPC exception, trying API fallback:', err);
    }

    // 2. Serverless API Fallback
    try {
      const apiBase = (typeof window !== 'undefined' && window.location?.origin) ? window.location.origin : '';
      const endpoint = apiBase ? `${apiBase}/api/missions/claim` : '/api/missions/claim';
      const session = (await supabase.auth.getSession()).data.session;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {})
        },
        body: JSON.stringify({ missionId })
      });
      const json = await res.json();
      if (res.ok && json.success) {
        sounds.playXpPop();
        const updatedMissions = get().dailyMissions.map(m => 
          m.id === missionId ? { ...m, completed: true } : m
        );
        const updatedUser: UserProfile = {
          ...currentUser,
          xp: json.newXp ?? ((currentUser.xp || 0) + (json.xpAwarded || 0)),
          coins: json.newCoins ?? ((currentUser.coins || 0) + (json.coinsAwarded || 0)),
          level: json.newLevel ?? currentUser.level
        };
        set({
          dailyMissions: updatedMissions,
          user: updatedUser,
          levelUpLevel: (updatedUser.level > currentUser.level) ? updatedUser.level : get().levelUpLevel,
          leaderboards: computeLeaderboard(updatedUser)
        });

        try {
          const today = new Date().toISOString().slice(0, 10);
          localStorage.setItem('apex_daily_missions_date', today);
          localStorage.setItem('apex_daily_missions', JSON.stringify(updatedMissions));
          localStorage.setItem('apex_user_session', JSON.stringify(updatedUser));
        } catch (e) {}

        registerOrUpdateUser(updatedUser);
        return { success: true, xpAwarded: json.xpAwarded, coinsAwarded: json.coinsAwarded };
      }
      return { success: false, error: json.error || 'Server rejected reward claim.' };
    } catch (fallbackErr: any) {
      return { success: false, error: fallbackErr?.message || 'Network error claiming reward.' };
    }
  },

  completeMission: (missionId: string) => {
    get().claimMissionReward(missionId);
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
