import { create } from 'zustand';
import type { UserProfile, CarCard, Hunt, DailyQuest, Mission, Badge, FeedPost, PostComment, LeaderboardEntry, Persona, PrivacyLevel } from '../types/apex';
import { INITIAL_GARAGE, CAR_PRESETS } from '../data/carDatabase';
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

  // Actions
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
  username: 'prateek_k',
  displayName: 'Prateek K',
  email: 'prateek@apex.app',
  avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=400&auto=format&fit=crop',
  persona: 'spotter',
  level: 12,
  xp: 4820,
  coins: 320,
  streakDays: 7,
  streakLastAt: new Date().toISOString(),
  rankGlobal: 1420,
  rankCountry: 340,
  rankCity: 142,
  city: 'Hong Kong',
  country: 'Hong Kong',
  countryCode: 'HK',
  isPremium: false,
  totalSpots: 142,
  rarestFind: 'mythic',
  badgesUnlocked: 18,
  citiesExplored: 3,
  allowHunts: true,
  defaultPrivacyLevel: 'public_blurred'
};

const INITIAL_HUNTS: Hunt[] = [
  {
    id: 'hunt-101',
    cardId: 'card-3',
    carName: 'Bugatti Chiron Super Sport',
    make: 'Bugatti',
    model: 'Chiron',
    rarity: 'mythic',
    latApprox: 22.2930,
    lngApprox: 114.1720,
    radiusKm: 2.0,
    startedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 1000 * 60 * 4 + 1000 * 22).toISOString(),
    participantsCount: 14,
    city: 'Hong Kong',
    imageUrl: CAR_PRESETS[1].imageUrl,
    status: 'active'
  }
];

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

const INITIAL_POSTS: FeedPost[] = [
  {
    id: 'post-supra-hk',
    user: {
      id: 'u-kenji',
      username: 'kenji_wong',
      avatarUrl: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?q=80&w=200&auto=format&fit=crop',
      level: 18
    },
    card: {
      id: 'card-supra-hk',
      cardNumber: 'APX-8921',
      make: 'Toyota',
      model: 'GR Supra 3.0 (A90)',
      generation: 'MK5',
      trim: 'Inline-6 Turbo',
      yearEstimate: '2021',
      releasedYear: '2021',
      color: 'Ice Cap White',
      bodyStyle: 'Coupe',
      rarity: 'epic',
      rarityScore: 79,
      topSpeedKmH: 250,
      horsepower: 382,
      engine: '3.0L B58 Turbo I6',
      zeroToHundredSec: 3.9,
      torqueNm: 500,
      kerbWeightKg: 1540,
      originCountry: 'Japan',
      interestingFact: 'Co-developed with BMW, featuring the iconic B58 inline-six engine and 50:50 weight distribution.',
      briefHistory: 'Tucked away in the K11 Musea underground garage in Tsim Sha Tsui late at night.',
      modsDetected: [
        { part: 'Exhaust', description: 'Akrapovič Slip-On Line Titanium Exhaust', confidence: 0.94 },
        { part: 'Suspension', description: 'KW V3 Coilover Suspension System', confidence: 0.88 }
      ],
      imageUrl: '/spot_supra.jpg',
      latApprox: 22.2950,
      lngApprox: 114.1730,
      city: 'Hong Kong',
      stateRegion: 'Kowloon',
      country: 'Hong Kong',
      xpEarned: 280,
      marketValueLowUsd: 55000,
      marketValueHighUsd: 72000,
      scanValidated: true,
      isPublic: true,
      huntTriggered: false,
      privacyLevel: 'public_blurred',
      aiConfidence: 0.98,
      createdAt: '2025-07-28T01:15:00Z',
      spottedDateFormatted: '28 JUL 2025'
    },
    likesCount: 64,
    commentsCount: 3,
    isLiked: false,
    createdAt: '18m ago',
    comments: [
      {
        id: 'c-supra-1',
        user: { id: 'u-boosted', username: 'boosted_b58', avatarUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?q=80&w=200&auto=format&fit=crop', level: 24 },
        text: 'B58 engine under the hood is pure magic! Is this stock or running a downpipe?',
        createdAt: '12m ago',
        likesCount: 7,
        isLiked: true
      },
      {
        id: 'c-supra-2',
        user: { id: 'u-hk-night', username: 'hk_nightspotter', avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200&auto=format&fit=crop', level: 19 },
        text: 'K11 Musea underground parking always hits different at 1 AM 🔥',
        createdAt: '8m ago',
        likesCount: 4,
        isLiked: false
      },
      {
        id: 'c-supra-3',
        user: { id: 'user-apex-01', username: 'prateek_k', avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=400&auto=format&fit=crop', level: 12 },
        text: 'White paint with dark red parking lighting looks so aggressive!',
        createdAt: '3m ago',
        likesCount: 2,
        isLiked: false
      }
    ]
  },
  {
    id: 'post-mclaren-hk',
    user: {
      id: 'u-marco',
      username: 'marco_rossi_hk',
      avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=200&auto=format&fit=crop',
      level: 35
    },
    card: {
      id: 'card-mclaren-hk',
      cardNumber: 'APX-0185',
      make: 'McLaren',
      model: '650S',
      generation: 'Super Series',
      trim: 'Twin-Turbo V8',
      yearEstimate: '2015',
      releasedYear: '2015',
      color: 'Chicane Grey',
      bodyStyle: 'Supercar',
      rarity: 'legendary',
      rarityScore: 89,
      topSpeedKmH: 333,
      horsepower: 641,
      engine: '3.8L M838T Twin-Turbo V8',
      zeroToHundredSec: 3.0,
      torqueNm: 678,
      kerbWeightKg: 1330,
      originCountry: 'United Kingdom',
      interestingFact: 'The 650S replaced the 12C and bridged the gap to the P1 hypercar, borrowing its aerodynamic DNA.',
      briefHistory: 'Spotted crawling through afternoon city traffic on Salisbury Road near Tsim Sha Tsui harbour.',
      modsDetected: [
        { part: 'Exhaust', description: 'Factory Titanium Dual Rear Exit Exhaust', confidence: 0.98 }
      ],
      imageUrl: '/spot_mclaren.jpg',
      latApprox: 22.2930,
      lngApprox: 114.1720,
      city: 'Hong Kong',
      stateRegion: 'Kowloon',
      country: 'Hong Kong',
      xpEarned: 450,
      marketValueLowUsd: 310000,
      marketValueHighUsd: 380000,
      scanValidated: true,
      isPublic: true,
      huntTriggered: false,
      privacyLevel: 'public_blurred',
      aiConfidence: 0.99,
      createdAt: '2025-07-28T14:20:00Z',
      spottedDateFormatted: '28 JUL 2025'
    },
    likesCount: 152,
    commentsCount: 3,
    isLiked: true,
    createdAt: '1h ago',
    comments: [
      {
        id: 'c-mcl-1',
        user: { id: 'u3', username: 'apex_king', avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=200&auto=format&fit=crop', level: 32 },
        text: 'Chicane Grey McLaren 650S! The active airbrake wing deploy in city traffic is legendary 👑',
        createdAt: '45m ago',
        likesCount: 19,
        isLiked: true
      },
      {
        id: 'c-mcl-2',
        user: { id: 'u-traffic', username: 'traffic_chaser', avatarUrl: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?q=80&w=200&auto=format&fit=crop', level: 23 },
        text: 'Imagine commuting in a 641 HP twin-turbo V8 during rush hour 🤯',
        createdAt: '30m ago',
        likesCount: 8,
        isLiked: false
      },
      {
        id: 'c-mcl-3',
        user: { id: 'u-kenji', username: 'kenji_wong', avatarUrl: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?q=80&w=200&auto=format&fit=crop', level: 18 },
        text: 'Heard this one down Salisbury Road earlier, absolute thunder!',
        createdAt: '15m ago',
        likesCount: 5,
        isLiked: false
      }
    ]
  },
  {
    id: 'post-ferrari-hk',
    user: {
      id: 'u-elena',
      username: 'elena_rostova',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200&auto=format&fit=crop',
      level: 29
    },
    card: {
      id: 'card-ferrari-hk',
      cardNumber: 'APX-0102',
      make: 'Ferrari',
      model: '458 Spider',
      generation: 'F142',
      trim: 'Naturally Aspirated V8',
      yearEstimate: '2013',
      releasedYear: '2013',
      color: 'Rosso Corsa',
      bodyStyle: 'Supercar',
      rarity: 'legendary',
      rarityScore: 88,
      topSpeedKmH: 320,
      horsepower: 562,
      engine: '4.5L NA V8',
      zeroToHundredSec: 3.4,
      torqueNm: 540,
      kerbWeightKg: 1430,
      originCountry: 'Italy',
      interestingFact: 'The last mid-engine Ferrari powered by a naturally aspirated V8 screaming up to 9,000 RPM.',
      briefHistory: 'Captured crossing yellow pedestrian markings right in front of the Cultural Centre.',
      modsDetected: [
        { part: 'Wheels', description: 'Novitec Rosso White Forged Monoblock Alloys', confidence: 0.95 },
        { part: 'Exhaust', description: 'Innotech Performance Exhaust (iPE) Valvetronic System', confidence: 0.91 }
      ],
      imageUrl: '/spot_ferrari458.jpg',
      latApprox: 22.2940,
      lngApprox: 114.1710,
      city: 'Hong Kong',
      stateRegion: 'Kowloon',
      country: 'Hong Kong',
      xpEarned: 420,
      marketValueLowUsd: 210000,
      marketValueHighUsd: 270000,
      scanValidated: true,
      isPublic: true,
      huntTriggered: false,
      privacyLevel: 'public_blurred',
      aiConfidence: 0.99,
      createdAt: '2025-07-28T12:00:00Z',
      spottedDateFormatted: '28 JUL 2025'
    },
    likesCount: 118,
    commentsCount: 3,
    isLiked: true,
    createdAt: '2h ago',
    comments: [
      {
        id: 'c-fer-1',
        user: { id: 'u-v8', username: 'v8_screamer', avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=200&auto=format&fit=crop', level: 28 },
        text: 'Last of the naturally aspirated V8 Ferraris! 9,000 RPM screams like music 🇮🇹',
        createdAt: '1h ago',
        likesCount: 12,
        isLiked: true
      },
      {
        id: 'c-fer-2',
        user: { id: 'u4', username: 'spotmeister', avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=200&auto=format&fit=crop', level: 25 },
        text: 'White custom forged rims on Rosso Corsa! Such a unique spec.',
        createdAt: '40m ago',
        likesCount: 5,
        isLiked: false
      },
      {
        id: 'c-fer-3',
        user: { id: 'user-apex-01', username: 'prateek_k', avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=400&auto=format&fit=crop', level: 12 },
        text: 'Spotted this one near the harbour crossing earlier, gorgeous shot!',
        createdAt: '20m ago',
        likesCount: 3,
        isLiked: false
      }
    ]
  },
  {
    id: 'post-porsche997-hk',
    user: {
      id: 'u-julian',
      username: 'julian_vance',
      avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=200&auto=format&fit=crop',
      level: 27
    },
    card: {
      id: 'card-porsche997-hk',
      cardNumber: 'APX-4511',
      make: 'Porsche',
      model: '911 Carrera S (997)',
      generation: '997.1',
      trim: 'Carrera S Flat-6',
      yearEstimate: '2008',
      releasedYear: '2008',
      color: 'Seal Grey Metallic',
      bodyStyle: 'Coupe',
      rarity: 'rare',
      rarityScore: 74,
      topSpeedKmH: 300,
      horsepower: 380,
      engine: '3.8L Flat-6',
      zeroToHundredSec: 4.5,
      torqueNm: 400,
      kerbWeightKg: 1420,
      originCountry: 'Germany',
      interestingFact: 'The 997 marked a return to classic round headlights and hydraulic rack steering loved by purists.',
      briefHistory: 'Spotted in basement parking bay B4 after an early morning mountain pass run.',
      modsDetected: [
        { part: 'Exhaust', description: 'Porsche Sport Exhaust (PSE) Valves', confidence: 0.92 }
      ],
      imageUrl: '/spot_porsche997.jpg',
      latApprox: 22.2960,
      lngApprox: 114.1740,
      city: 'Hong Kong',
      stateRegion: 'Kowloon',
      country: 'Hong Kong',
      xpEarned: 210,
      marketValueLowUsd: 48000,
      marketValueHighUsd: 68000,
      scanValidated: true,
      isPublic: true,
      huntTriggered: false,
      privacyLevel: 'public_blurred',
      aiConfidence: 0.97,
      createdAt: '2025-07-28T08:30:00Z',
      spottedDateFormatted: '28 JUL 2025'
    },
    likesCount: 89,
    commentsCount: 2,
    isLiked: false,
    createdAt: '3h ago',
    comments: [
      {
        id: 'c-997-1',
        user: { id: 'u-flat6', username: 'flat6_purist', avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=200&auto=format&fit=crop', level: 31 },
        text: '997 Carrera S in Seal Grey! Best hydraulic steering feel of any modern 911.',
        createdAt: '2h ago',
        likesCount: 14,
        isLiked: true
      },
      {
        id: 'c-997-2',
        user: { id: 'u-clara', username: 'clara_auto', avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=200&auto=format&fit=crop', level: 21 },
        text: 'Spotting in bay B4! The condition on this paint looks immaculate 🇩🇪',
        createdAt: '1h ago',
        likesCount: 6,
        isLiked: false
      }
    ]
  },
  {
    id: 'post-porsche996-hk',
    user: {
      id: 'u-david',
      username: 'david_sterling',
      avatarUrl: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?q=80&w=200&auto=format&fit=crop',
      level: 16
    },
    card: {
      id: 'card-porsche996-hk',
      cardNumber: 'APX-2967',
      make: 'Porsche',
      model: '911 Carrera Cabriolet (996)',
      generation: '996.2',
      trim: 'Carrera Cabriolet',
      yearEstimate: '2002',
      releasedYear: '2002',
      color: 'Arctic Silver Metallic',
      bodyStyle: 'Convertible',
      rarity: 'rare',
      rarityScore: 71,
      topSpeedKmH: 285,
      horsepower: 315,
      engine: '3.6L Flat-6',
      zeroToHundredSec: 5.0,
      torqueNm: 370,
      kerbWeightKg: 1395,
      originCountry: 'Germany',
      interestingFact: 'The first water-cooled 911 model. Modern collectors are rapidly rediscovering its lightweight purity.',
      briefHistory: 'Spotted dropping off outside the Rosewood hotel driveway.',
      modsDetected: [
        { part: 'Wheels', description: 'Factory 18-inch Turbo Twist Alloy Wheels', confidence: 0.96 }
      ],
      imageUrl: '/spot_porsche996.jpg',
      latApprox: 22.2945,
      lngApprox: 114.1735,
      city: 'Hong Kong',
      stateRegion: 'Kowloon',
      country: 'Hong Kong',
      xpEarned: 190,
      marketValueLowUsd: 32000,
      marketValueHighUsd: 45000,
      scanValidated: true,
      isPublic: true,
      huntTriggered: false,
      privacyLevel: 'public_blurred',
      aiConfidence: 0.96,
      createdAt: '2025-07-28T06:10:00Z',
      spottedDateFormatted: '28 JUL 2025'
    },
    likesCount: 53,
    commentsCount: 2,
    isLiked: false,
    createdAt: '5h ago',
    comments: [
      {
        id: 'c-996-1',
        user: { id: 'u-julian', username: 'julian_vance', avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=200&auto=format&fit=crop', level: 27 },
        text: '996 Cabriolet pulling up to the valet! Fried egg headlights are aging like fine wine 🍷',
        createdAt: '3h ago',
        likesCount: 8,
        isLiked: true
      },
      {
        id: 'c-996-2',
        user: { id: 'u-valet', username: 'valet_watcher', avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=200&auto=format&fit=crop', level: 14 },
        text: 'Classic silver over black leather top. Total timeless class.',
        createdAt: '1h ago',
        likesCount: 3,
        isLiked: false
      }
    ]
  }
];

const INITIAL_LEADERBOARD: LeaderboardEntry[] = [
  { rank: 1, username: 'apex_king', displayName: 'Apex King', avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=200&auto=format&fit=crop', xp: 12450, level: 32, rankChange: 'up', changeAmount: 2, rarestCard: 'Bugatti Chiron' },
  { rank: 2, username: 'driver_27', displayName: 'Driver 27', avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=200&auto=format&fit=crop', xp: 11200, level: 28, rankChange: 'same', rarestCard: 'Porsche GT3 RS' },
  { rank: 3, username: 'spotmeister', displayName: 'Spot Meister', avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=200&auto=format&fit=crop', xp: 9800, level: 25, rankChange: 'down', changeAmount: 1, rarestCard: 'Lamborghini Huracan' },
  { rank: 142, username: 'prateek_k', displayName: 'You (Prateek K)', avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=400&auto=format&fit=crop', xp: 4820, level: 12, rankChange: 'up', changeAmount: 1, isUser: true, rarestCard: 'Bugatti Chiron' }
];

export const useApexStore = create<ApexState>((set) => ({
  activeTab: 'home',
  scannerOpen: false,
  onboardingCompleted: true,
  enthusiastModalOpen: false,
  activeHuntAlert: INITIAL_HUNTS[0],
  activeHuntModal: null,
  selectedCardForDetail: null,

  user: INITIAL_USER,
  garage: INITIAL_GARAGE,
  activeHunts: INITIAL_HUNTS,
  dailyQuests: INITIAL_QUESTS,
  dailyMissions: INITIAL_MISSIONS,
  badges: INITIAL_BADGES,
  feedPosts: INITIAL_POSTS,
  leaderboards: INITIAL_LEADERBOARD,
  liveEventExpiresAt: GLOBAL_EVENT_EXPIRES_AT,

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
