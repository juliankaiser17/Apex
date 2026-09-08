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
  AuthUser
} from '../types/apex';
import { calculateDiscoveryXp, processXpGain } from '../utils/mastery';
import { sounds } from '../utils/audio';
import { supabase } from '../lib/supabase';
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
  dismissLevelUp: () => void;
  toggleAllowHunts: () => void;
  setDefaultPrivacyLevel: (level: PrivacyLevel) => void;
  scheduleCardDeletion: (cardId: string) => Promise<void>;
  cancelCardDeletion: (cardId: string) => Promise<void>;
  purgeExpiredDeletedCards: () => Promise<void>;
  resetDevelopmentState: () => void;
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

const INITIAL_QUESTS: DailyQuest[] = [
  {
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
  },
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
  },
  {
    id: 'quest-powerhouse',
    title: '500+ Horsepower Club',
    description: 'Photograph any supercar or sports car pushing 500+ horsepower.',
    targetCount: 1,
    currentCount: 0,
    xpReward: 450,
    coinReward: 90,
    badgeName: 'Power Hunter',
    expiresInSeconds: 86400,
    expiresAtTimestamp: GLOBAL_QUEST_EXPIRES_AT,
    allowedMakes: [],
    isCompleted: false
  },
  {
    id: 'quest-italian-stallion',
    title: 'Italian Thoroughbred',
    description: 'Spot an exotic Italian vehicle (Ferrari, Lamborghini, Maserati, or Alfa Romeo).',
    targetCount: 1,
    currentCount: 0,
    xpReward: 600,
    coinReward: 150,
    badgeName: 'Tifosi Legend',
    expiresInSeconds: 86400,
    expiresAtTimestamp: GLOBAL_QUEST_EXPIRES_AT,
    allowedMakes: ['Ferrari', 'Lamborghini', 'Maserati', 'Alfa Romeo'],
    isCompleted: false
  },
  {
    id: 'quest-v8-muscle',
    title: 'American Muscle & V8s',
    description: 'Spot a Ford Mustang, Chevrolet Corvette, Camaro, or Dodge V8.',
    targetCount: 1,
    currentCount: 0,
    xpReward: 350,
    coinReward: 70,
    badgeName: 'Muscle Scout',
    expiresInSeconds: 86400,
    expiresAtTimestamp: GLOBAL_QUEST_EXPIRES_AT,
    allowedMakes: ['Ford', 'Chevrolet', 'Dodge'],
    isCompleted: false
  },
  {
    id: 'quest-electric-future',
    title: 'Electric Revolution',
    description: 'Spot a high-performance EV (Tesla, Porsche Taycan, Audi e-tron, or Rimac).',
    targetCount: 1,
    currentCount: 0,
    xpReward: 300,
    coinReward: 60,
    badgeName: 'Volt Spotter',
    expiresInSeconds: 86400,
    expiresAtTimestamp: GLOBAL_QUEST_EXPIRES_AT,
    allowedMakes: ['Tesla', 'Porsche', 'Audi', 'Rivian', 'Lucid'],
    isCompleted: false
  }
];

const INITIAL_MISSIONS: Mission[] = [
  { id: 'm1', title: 'Scan 1 car today', xpReward: 50, completed: false, type: 'scan' },
  { id: 'm2', title: 'Identify 1 Rare or higher', xpReward: 100, completed: false, type: 'rarity' },
  { id: 'm3', title: 'Daily Login Bonus', xpReward: 25, completed: false, type: 'login' },
  { id: 'm4', title: 'Spot an SUV or Coupe', xpReward: 75, completed: false, type: 'body' },
  { id: 'm5', title: 'Scan a car you\'ve never seen', xpReward: 200, completed: false, type: 'new_car' },
  { id: 'm6', title: 'Spot a car with 400+ HP', xpReward: 120, completed: false, type: 'power' },
  { id: 'm7', title: 'Spot an Aero or Tuned car', xpReward: 100, completed: false, type: 'mods' }
];

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

const getSavedGarage = (userId?: string): CarCard[] => {
  try {
    if (typeof localStorage !== 'undefined') {
      if (userId) {
        const userSaved = localStorage.getItem(`apex_garage_cards_${userId}`);
        if (userSaved) {
          const parsed = JSON.parse(userSaved);
          if (Array.isArray(parsed)) return parsed;
        }
      }
      // Fallback to initial saved if only one account exists
      const legacySaved = localStorage.getItem('apex_garage_cards');
      if (legacySaved && !userId) {
        const parsed = JSON.parse(legacySaved);
        if (Array.isArray(parsed)) return parsed;
      }
    }
  } catch (e) {
    console.warn('Error reading saved garage cards:', e);
  }
  return [];
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
    commentsCount: 28,
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
    commentsCount: 14,
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
    commentsCount: 39,
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
    commentsCount: 9,
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
    commentsCount: 22,
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

  user: initialSavedUser,
  garage: getSavedGarage(initialSavedUser.id),
  friends: getUserFriends(initialSavedUser.username),
  activeHunts: [],
  dailyQuests: INITIAL_QUESTS,
  dailyMissions: INITIAL_MISSIONS,
  badges: INITIAL_BADGES,
  feedPosts: getSavedPosts(),
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
      leaderboards: computeLeaderboard(freshUser),
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
        .select('id, username, display_name, avatar_url, level, xp, coins, streak_days, last_scan_at, total_spots, rarest_find, created_at')
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

        const hydratedGarage: CarCard[] = (garage && garage.length > 0)
          ? garage.map(g => createSampleCard({
              id: g.id,
              cardNumber: g.card_number || `#APX-${Math.floor(100000 + Math.random() * 900000)}`,
              make: g.make,
              model: g.model,
              yearEstimate: String(g.year_estimate || 2023),
              bodyStyle: (g.body_style as any) || 'Coupe',
              rarity: (g.rarity as any) || 'rare',
              rarityScore: g.rarity_score || 75,
              horsepower: g.horsepower || 400,
              topSpeedKmH: g.top_speed_kmh || 280,
              zeroToHundredSec: g.zero_to_hundred_sec || 3.8,
              color: g.color || 'Standard',
              imageUrl: g.image_url || '',
              city: g.city || 'Tokyo',
              country: g.country || 'Japan',
              originCountry: g.origin_country || 'Japan',
              interestingFact: g.interesting_fact || 'Precision engineering.',
              briefHistory: g.brief_history || 'Performance icon.',
              modsDetected: g.mods_detected || [],
              createdAt: g.created_at || new Date().toISOString(),
              pendingDeletionUntil: g.pending_deletion_until || undefined,
              isPublic: true,
              privacyLevel: 'public_blurred',
              xpEarned: 250,
              aiConfidence: 0.95
            }))
          : getSavedGarage(mergedUser.id);

        try {
          persistItem('apex_user_session', JSON.stringify(mergedUser));
          persistItem(`apex_garage_cards_${mergedUser.id}`, JSON.stringify(hydratedGarage));
          persistItem('apex_garage_cards', JSON.stringify(hydratedGarage));
          if (isOnboardingDone) {
            persistItem('apex_onboarding_v2_completed', 'true');
          }
        } catch (e) {}

        await registerOrUpdateUser(mergedUser);
        logAuthTransition('PROFILE_LOADED', userId, resolvedEmail);

        set({
          authStatus: 'AUTHENTICATED',
          authUser: {
            id: userId,
            email: resolvedEmail,
            provider: determinedProvider
          },
          user: mergedUser,
          garage: hydratedGarage,
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

        const newUser: UserProfile = {
          ...INITIAL_USER,
          id: userId,
          username: derivedUsername,
          displayName: derivedDisplayName,
          email: resolvedEmail,
          city: userMetadata?.city || '',
          country: userMetadata?.country || ''
        };

        try {
          persistItem('apex_user_session', JSON.stringify(newUser));
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
          garage: [],
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
    const shouldPublishToFeed = options?.publishToFeed !== false;
    const postCaption = customCaption?.trim() || `Just discovered this ${newCard.make} ${newCard.model} in ${newCard.city}!`;
    
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

    // Invoke Authoritative Server-Side PostgreSQL RPC if connected
    try {
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
      xpEarned: authoritativeXp,
      isPublic: isPublicCard,
      privacyLevel: cardPrivacyLevel
    };

    // Trigger Hunt if requested and allowed
    if (options?.allowHunts && isPublicCard && authoritativeRarity !== 'common') {
      get().triggerMockHunt(authoritativeCard);
    }

    set((state) => {
      const updatedGarage = [authoritativeCard, ...state.garage];
      try {
        localStorage.setItem(`apex_garage_cards_${state.user.id}`, JSON.stringify(updatedGarage));
        localStorage.setItem('apex_garage_cards', JSON.stringify(updatedGarage));
      } catch (e) {}

      const xpResult = processXpGain(state.user, authoritativeXp, `${authoritativeRarity.toUpperCase()} Discovery`);
      const updatedUser: UserProfile = {
        ...xpResult.updatedUser,
        totalSpots: (state.user.totalSpots || 0) + 1
      };

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

      const updatedMissions = state.dailyMissions.map(m => {
        if (!m.completed) {
          if (m.type === 'scan') return { ...m, completed: true };
          if (m.type === 'rarity' && ['rare', 'epic', 'legendary', 'mythic'].includes(newCard.rarity)) return { ...m, completed: true };
          if (m.type === 'body' && (newCard.bodyStyle === 'SUV' || newCard.bodyStyle === 'Coupe' || newCard.bodyStyle === 'Supercar')) return { ...m, completed: true };
          if (m.type === 'new_car') return { ...m, completed: true };
        }
        return m;
      });

      let updatedPosts = state.feedPosts;
      if (shouldPublishToFeed) {
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

  completeMission: (missionId) => {
    set((state) => {
      const mission = state.dailyMissions.find(m => m.id === missionId);
      if (!mission || mission.completed) return state;

      sounds.playXpPop();
      const updatedMissions = state.dailyMissions.map(m => m.id === missionId ? { ...m, completed: true } : m);
      const xpResult = processXpGain(state.user, mission.xpReward, 'Mission Complete');
      const updatedUser = xpResult.updatedUser;
      try {
        localStorage.setItem('apex_user_session', JSON.stringify(updatedUser));
      } catch (e) {}
      registerOrUpdateUser(updatedUser);

      return {
        dailyMissions: updatedMissions,
        user: updatedUser,
        levelUpLevel: xpResult.leveledUp ? updatedUser.level : state.levelUpLevel,
        leaderboards: computeLeaderboard(updatedUser)
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
