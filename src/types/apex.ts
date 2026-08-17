import type { PrivacyLevel } from '../utils/privacyPipeline';

export type { PrivacyLevel };

export type Persona = 'spotter' | 'finder' | 'love_of_cars' | 'unspecified';

export type RarityTier = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';

export type BodyStyle = 
  | 'Sedan' 
  | 'Coupe' 
  | 'SUV' 
  | 'Hatchback' 
  | 'Convertible' 
  | 'Wagon' 
  | 'Pickup' 
  | 'Van' 
  | 'Supercar' 
  | 'Hypercar';

export interface ModItem {
  part: string;
  description: string;
  confidence: number;
}

export interface CarCard {
  id: string;
  cardNumber: string; // e.g. "#APX-004821"
  make: string;
  model: string;
  generation?: string;
  trim?: string;
  yearEstimate: string;
  releasedYear?: string; // e.g. "2019"
  productionYears?: string; // e.g. "2004–2012" or "2019–Present"
  discontinuedStatus?: string; // e.g. "Discontinued" or "Active Production"
  color: string;
  bodyStyle: BodyStyle;
  rarity: RarityTier;
  rarityScore: number; // 0 - 100
  
  // 6 Stats Grid
  topSpeedKmH?: number; // e.g. 325
  horsepower?: number; // e.g. 640
  engine?: string; // e.g. "5.2L V10 NA"
  zeroToHundredSec?: number; // e.g. 3.2
  torqueNm?: number; // e.g. 600
  kerbWeightKg?: number; // e.g. 1422

  originCountry: string;
  interestingFact: string;
  briefHistory: string;
  modsDetected: ModItem[];
  imageUrl: string;
  latApprox: number;
  lngApprox: number;
  city: string;
  stateRegion?: string; // e.g. "Uttar Pradesh"
  country: string;
  xpEarned: number;
  marketValueLowUsd: number;
  marketValueHighUsd: number;
  scanValidated: boolean;
  isPublic: boolean;
  huntTriggered: boolean;
  privacyLevel: PrivacyLevel;
  aiConfidence: number;
  createdAt: string; // e.g. ISO string or "12 JUL 2025"
  spottedDateFormatted?: string; // e.g. "12 JUL 2025"
  isFirstGlobalScan?: boolean;
  isFirstCityScan?: boolean;
}

export interface UserProfile {
  id: string;
  username: string;
  displayName: string;
  email: string;
  avatarUrl: string;
  persona: Persona;
  level: number;
  xp: number;
  coins: number;
  streakDays: number;
  streakLastAt: string;
  rankGlobal: number;
  rankCountry: number;
  rankCity: number;
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  countryCode: string;
  isPremium: boolean;
  premiumUntil?: string;
  totalSpots: number;
  rarestFind: RarityTier;
  badgesUnlocked: number;
  citiesExplored: number;
  allowHunts: boolean;
  defaultPrivacyLevel: PrivacyLevel;
}

export interface DailyQuest {
  id: string;
  title: string;
  description: string;
  targetCount: number;
  currentCount: number;
  xpReward: number;
  coinReward: number;
  badgeName?: string;
  expiresInSeconds: number;
  expiresAtTimestamp?: number; // Persistent epoch ms timestamp
  allowedMakes?: string[];
  allowedBodyStyles?: string[];
  isCompleted: boolean;
}

export interface Mission {
  id: string;
  title: string;
  xpReward: number;
  completed: boolean;
  type: 'scan' | 'rarity' | 'login' | 'body' | 'new_car';
}

export interface Badge {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  rarity: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';
  earnedAt?: string;
  isUnlocked: boolean;
  xpBonus: number;
}

export interface Hunt {
  id: string;
  cardId: string;
  carName: string;
  make: string;
  model: string;
  rarity: RarityTier;
  latApprox: number;
  lngApprox: number;
  radiusKm: number;
  startedAt: string;
  dispatchAt?: string; // 15-minute delayed notification dispatch
  expiresAt: string; // 5 min countdown
  participantsCount: number;
  city: string;
  imageUrl: string;
  status: 'active' | 'completed' | 'expired';
}

export interface PostComment {
  id: string;
  user: {
    id: string;
    username: string;
    avatarUrl: string;
    level: number;
  };
  text: string;
  createdAt: string;
  likesCount: number;
  isLiked?: boolean;
}

export interface FeedPost {
  id: string;
  user: {
    id: string;
    username: string;
    avatarUrl: string;
    level: number;
  };
  card: CarCard;
  caption?: string;
  likesCount: number;
  commentsCount: number;
  isLiked: boolean;
  createdAt: string;
  comments?: PostComment[];
}

export interface LeaderboardEntry {
  rank: number;
  username: string;
  displayName: string;
  avatarUrl: string;
  xp: number;
  level: number;
  rankChange: 'up' | 'down' | 'same';
  changeAmount?: number;
  isUser?: boolean;
  rarestCard?: string;
}
