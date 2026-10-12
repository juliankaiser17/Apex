/**
 * APEX — 100+ Authoritative Badge Catalog & Evaluation Engine
 * 
 * Features 105+ diverse achievements across 9 categories:
 * 1. Rarity & Scarcity
 * 2. Manufacturer Mastery
 * 3. Scan Streaks & Loyalty
 * 4. Time Constraints & Session Achievements
 * 5. Performance & Engine Specifications
 * 6. Body Styles & Diversity
 * 7. Exploration & Geography
 * 8. Collection Milestones & Valuation
 * 9. Forensics & Precision Identification
 */

import type { CarCard, UserProfile, RarityTier } from '../types/apex';
import { resolveCanonicalVehicleSpecs } from './vehicleSpecs';

export type BadgeCategory = 
  | 'rarity' 
  | 'manufacturer' 
  | 'streaks' 
  | 'time_session' 
  | 'performance' 
  | 'body_diversity' 
  | 'exploration' 
  | 'collection' 
  | 'forensics';

export type BadgeRarity = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';

export interface BadgeProgress {
  current: number;
  max: number;
  unit?: string;
}

export interface ApexBadgeDefinition {
  id: string;
  slug: string;
  name: string;
  category: BadgeCategory;
  description: string;
  unlockCondition: string;
  icon: string;
  rarity: BadgeRarity;
  xpBonus: number;
  isUnlocked: boolean;
  earnedAt?: string;
  progress?: BadgeProgress;
}

export interface BadgeSessionContext {
  scansInCurrentSession?: number;
  consecutiveIdentifiedCount?: number;
  rapidScanCount?: number; // Scans in past 15 minutes
  recentScanTimes?: number[]; // epoch timestamps
  isNightScan?: boolean;
}

// ────────────────────────────────────────────────────────────────────────────
// 106+ COMPREHENSIVE BADGE DEFINITIONS
// ────────────────────────────────────────────────────────────────────────────
export const APEX_BADGE_DEFINITIONS: Omit<ApexBadgeDefinition, 'isUnlocked' | 'earnedAt' | 'progress'>[] = [
  // ─── 1. RARITY & SCARCITY (12) ───
  { id: 'b_first_blood', slug: 'first_blood', name: 'First Blood', category: 'rarity', rarity: 'bronze', xpBonus: 100, icon: 'Target', description: 'Scanned your very first vehicle in the wild.', unlockCondition: 'Scan 1 car' },
  { id: 'b_rare_encounter', slug: 'rare_encounter', name: 'Rare Encounter', category: 'rarity', rarity: 'silver', xpBonus: 250, icon: 'Zap', description: 'Discovered a verified Rare tier vehicle.', unlockCondition: 'Spot 1 Rare car' },
  { id: 'b_rare_collector', slug: 'rare_collector', name: 'Rare Specialist', category: 'rarity', rarity: 'silver', xpBonus: 400, icon: 'Zap', description: 'Documented 5 Rare tier performance vehicles.', unlockCondition: 'Spot 5 Rare cars' },
  { id: 'b_epic_discovery', slug: 'epic_discovery', name: 'Epic Discovery', category: 'rarity', rarity: 'gold', xpBonus: 500, icon: 'Sparkles', description: 'Tracked down an elusive Epic tier sports machine.', unlockCondition: 'Spot 1 Epic car' },
  { id: 'b_epic_syndicate', slug: 'epic_syndicate', name: 'Epic Syndicate', category: 'rarity', rarity: 'gold', xpBonus: 800, icon: 'Sparkles', description: 'Added 5 Epic tier vehicles to your Showroom Vault.', unlockCondition: 'Spot 5 Epic cars' },
  { id: 'b_legendary_spotter', slug: 'legendary_spotter', name: 'Legendary Seeker', category: 'rarity', rarity: 'platinum', xpBonus: 1000, icon: 'Crown', description: 'Photographed a Legendary tier automotive icon.', unlockCondition: 'Spot 1 Legendary car' },
  { id: 'b_legendary_trio', slug: 'legendary_trio', name: 'Legendary Trio', category: 'rarity', rarity: 'platinum', xpBonus: 1500, icon: 'Crown', description: 'Collected 3 Legendary tier automotive legends.', unlockCondition: 'Spot 3 Legendary cars' },
  { id: 'b_mythic_hunter', slug: 'mythic_hunter', name: 'Mythic Hunter', category: 'rarity', rarity: 'diamond', xpBonus: 2500, icon: 'Flame', description: 'Discovered an ultra-rare Mythic hypercar or bespoke build.', unlockCondition: 'Spot 1 Mythic car' },
  { id: 'b_double_mythic', slug: 'double_mythic', name: 'Apex God', category: 'rarity', rarity: 'diamond', xpBonus: 5000, icon: 'Flame', description: 'Uncovered 2 distinct Mythic tier hypercars.', unlockCondition: 'Spot 2 Mythic cars' },
  { id: 'b_triple_crown', slug: 'triple_crown', name: 'Triple Crown', category: 'rarity', rarity: 'platinum', xpBonus: 1200, icon: 'Trophy', description: 'Own at least 1 Rare, 1 Epic, and 1 Legendary car.', unlockCondition: 'Own Rare + Epic + Legendary' },
  { id: 'b_rainbow_fleet', slug: 'rainbow_fleet', name: 'Rainbow Fleet', category: 'rarity', rarity: 'diamond', xpBonus: 3000, icon: 'Palette', description: 'Collect cars across all 5 primary rarity tiers.', unlockCondition: 'Own Common, Uncommon, Rare, Epic, Legendary' },
  { id: 'b_scarcity_scout', slug: 'scarcity_scout', name: 'Scarcity Scout', category: 'rarity', rarity: 'silver', xpBonus: 300, icon: 'Compass', description: 'Scan 10 cars with a rarity score of 60 or higher.', unlockCondition: '10 cars with rarityScore >= 60' },

  // ─── 2. MANUFACTURER MASTERY (20) ───
  { id: 'b_stuttgart_purist', slug: 'stuttgart_purist', name: 'Stuttgart Purist', category: 'manufacturer', rarity: 'silver', xpBonus: 350, icon: 'Shield', description: 'Documented 3 Porsche sports cars.', unlockCondition: 'Spot 3 Porsche cars' },
  { id: 'b_porsche_collection', slug: 'porsche_collection', name: '911 Syndicate', category: 'manufacturer', rarity: 'gold', xpBonus: 750, icon: 'Shield', description: 'Collected 6 Porsche sports cars in your vault.', unlockCondition: 'Spot 6 Porsche cars' },
  { id: 'b_maranello_disciple', slug: 'maranello_disciple', name: 'Maranello Disciple', category: 'manufacturer', rarity: 'gold', xpBonus: 600, icon: 'Flame', description: 'Spotted 2 Ferrari thoroughbreds.', unlockCondition: 'Spot 2 Ferrari cars' },
  { id: 'b_ferrari_master', slug: 'ferrari_master', name: 'Prancing Horse Elite', category: 'manufacturer', rarity: 'platinum', xpBonus: 1200, icon: 'Flame', description: 'Documented 5 Ferrari supercars.', unlockCondition: 'Spot 5 Ferrari cars' },
  { id: 'b_raging_bull', slug: 'raging_bull', name: 'Bull Tamer', category: 'manufacturer', rarity: 'gold', xpBonus: 600, icon: 'Zap', description: 'Photographed 2 Lamborghini V10 or V12 bulls.', unlockCondition: 'Spot 2 Lamborghini cars' },
  { id: 'b_lambo_syndicate', slug: 'lambo_syndicate', name: 'Sant’Agata Squad', category: 'manufacturer', rarity: 'platinum', xpBonus: 1200, icon: 'Zap', description: 'Collected 4 Lamborghini supercars in your vault.', unlockCondition: 'Spot 4 Lamborghini cars' },
  { id: 'b_bavarian_pilot', slug: 'bavarian_pilot', name: 'Bavarian Pilot', category: 'manufacturer', rarity: 'bronze', xpBonus: 200, icon: 'Car', description: 'Documented 3 BMW performance vehicles.', unlockCondition: 'Spot 3 BMW cars' },
  { id: 'b_m_power', slug: 'm_power', name: 'M Power Connoisseur', category: 'manufacturer', rarity: 'silver', xpBonus: 450, icon: 'Zap', description: 'Spotted 3 BMW M models (M2, M3, M4, M5, or M8).', unlockCondition: 'Spot 3 BMW M cars' },
  { id: 'b_affalterbach_beast', slug: 'affalterbach_beast', name: 'Affalterbach Beast', category: 'manufacturer', rarity: 'silver', xpBonus: 350, icon: 'Gauge', description: 'Discovered 3 Mercedes-Benz or AMG performance models.', unlockCondition: 'Spot 3 Mercedes cars' },
  { id: 'b_amg_v8', slug: 'amg_v8', name: 'Hammer Time', category: 'manufacturer', rarity: 'gold', xpBonus: 650, icon: 'Zap', description: 'Documented 2 Mercedes-AMG high-horsepower coupes or GTs.', unlockCondition: 'Spot 2 Mercedes AMG GT / V8 cars' },
  { id: 'b_woking_precision', slug: 'woking_precision', name: 'Woking Precision', category: 'manufacturer', rarity: 'gold', xpBonus: 700, icon: 'Activity', description: 'Photographed a McLaren carbon-fiber supercar.', unlockCondition: 'Spot 1 McLaren supercar' },
  { id: 'b_gaydon_gentleman', slug: 'gaydon_gentleman', name: 'British Elegance', category: 'manufacturer', rarity: 'gold', xpBonus: 650, icon: 'Award', description: 'Captured an Aston Martin grand tourer in the wild.', unlockCondition: 'Spot 1 Aston Martin' },
  { id: 'b_jdm_legend', slug: 'jdm_legend', name: 'Tokyo Drifter', category: 'manufacturer', rarity: 'bronze', xpBonus: 250, icon: 'Globe', description: 'Spotted 3 iconic Japanese domestic market cars.', unlockCondition: 'Spot 3 Japanese cars' },
  { id: 'b_jdm_royalty', slug: 'jdm_royalty', name: 'JDM Royalty', category: 'manufacturer', rarity: 'gold', xpBonus: 800, icon: 'Globe', description: 'Discovered 10 Japanese performance cars.', unlockCondition: 'Spot 10 Japanese cars' },
  { id: 'b_godzilla_slayer', slug: 'godzilla_slayer', name: 'Godzilla Slayer', category: 'manufacturer', rarity: 'silver', xpBonus: 400, icon: 'ShieldAlert', description: 'Documented a Nissan GT-R or Skyline.', unlockCondition: 'Spot 1 Nissan GT-R / Skyline' },
  { id: 'b_detroit_muscle', slug: 'detroit_muscle', name: 'Detroit Muscle', category: 'manufacturer', rarity: 'bronze', xpBonus: 250, icon: 'Flame', description: 'Photographed 3 American V8 muscle cars (Mustang, Camaro, Challenger).', unlockCondition: 'Spot 3 American Muscle cars' },
  { id: 'b_corvette_scout', slug: 'corvette_scout', name: 'Corvette Vanguard', category: 'manufacturer', rarity: 'silver', xpBonus: 350, icon: 'Award', description: 'Documented a Chevrolet Corvette (C6, C7, or C8).', unlockCondition: 'Spot 1 Corvette' },
  { id: 'b_ingolstadt_quattro', slug: 'ingolstadt_quattro', name: 'Quattro Master', category: 'manufacturer', rarity: 'bronze', xpBonus: 250, icon: 'Compass', description: 'Discovered 3 Audi performance vehicles (RS or R8).', unlockCondition: 'Spot 3 Audi cars' },
  { id: 'b_hypercar_royalty', slug: 'hypercar_royalty', name: 'Hypercar Syndicate', category: 'manufacturer', rarity: 'diamond', xpBonus: 3000, icon: 'Crown', description: 'Spot a Bugatti, Koenigsegg, or Pagani.', unlockCondition: 'Spot Bugatti / Koenigsegg / Pagani' },
  { id: 'b_british_luxury', slug: 'british_luxury', name: 'Crown Estate', category: 'manufacturer', rarity: 'gold', xpBonus: 600, icon: 'Award', description: 'Documented a Bentley or Rolls-Royce motor car.', unlockCondition: 'Spot 1 Bentley or Rolls-Royce' },

  // ─── 3. SCAN STREAKS & LOYALTY (10) ───
  { id: 'b_streak_3', slug: 'streak_3', name: '3-Day Spark', category: 'streaks', rarity: 'bronze', xpBonus: 150, icon: 'Flame', description: 'Maintained a 3-day consecutive scanning streak.', unlockCondition: '3-day streak' },
  { id: 'b_streak_7', slug: 'streak_7', name: '7-Day Spotter', category: 'streaks', rarity: 'silver', xpBonus: 500, icon: 'Flame', description: 'Maintained a full 7-day scanning streak.', unlockCondition: '7-day streak' },
  { id: 'b_streak_14', slug: 'streak_14', name: '14-Day Blaze', category: 'streaks', rarity: 'gold', xpBonus: 1000, icon: 'Flame', description: 'Maintained a 14-day scanning streak without breaking.', unlockCondition: '14-day streak' },
  { id: 'b_streak_30', slug: 'streak_30', name: '30-Day Inferno', category: 'streaks', rarity: 'platinum', xpBonus: 2500, icon: 'Flame', description: 'Achieved an extraordinary 30-day streak of active spotting.', unlockCondition: '30-day streak' },
  { id: 'b_streak_60', slug: 'streak_60', name: '60-Day Titan', category: 'streaks', rarity: 'diamond', xpBonus: 5000, icon: 'Flame', description: 'Two uninterrupted months of relentless daily scanning.', unlockCondition: '60-day streak' },
  { id: 'b_streak_100', slug: 'streak_100', name: 'Centurion', category: 'streaks', rarity: 'diamond', xpBonus: 10000, icon: 'Award', description: 'The 100-day milestone. True Apex master.', unlockCondition: '100-day streak' },
  { id: 'b_weekend_warrior', slug: 'weekend_warrior', name: 'Weekend Warrior', category: 'streaks', rarity: 'bronze', xpBonus: 200, icon: 'Calendar', description: 'Recorded scans on both Saturday and Sunday.', unlockCondition: 'Scan on Sat & Sun' },
  { id: 'b_double_weekend', slug: 'double_weekend', name: 'Double Weekend', category: 'streaks', rarity: 'silver', xpBonus: 350, icon: 'Calendar', description: 'Active on 2 consecutive weekends.', unlockCondition: '2 consecutive weekends' },
  { id: 'b_streak_preserver', slug: 'streak_preserver', name: 'Iron Guard', category: 'streaks', rarity: 'bronze', xpBonus: 200, icon: 'Shield', description: 'Preserved your streak through discipline or freeze token.', unlockCondition: 'Reach 5+ days streak' },
  { id: 'b_daily_habit', slug: 'daily_habit', name: 'Daily Pulse', category: 'streaks', rarity: 'bronze', xpBonus: 150, icon: 'Activity', description: 'Logged into Apex and completed 1 scan today.', unlockCondition: '1 scan today' },

  // ─── 4. TIME CONSTRAINTS & SESSION ACHIEVEMENTS (12) ───
  { id: 'b_midnight_runner', slug: 'midnight_runner', name: 'Midnight Runner', category: 'time_session', rarity: 'silver', xpBonus: 300, icon: 'Moon', description: 'Scanned a vehicle between 12:00 AM and 4:00 AM.', unlockCondition: 'Scan between 12am-4am' },
  { id: 'b_dawn_patrol', slug: 'dawn_patrol', name: 'Dawn Patrol', category: 'time_session', rarity: 'silver', xpBonus: 300, icon: 'Sun', description: 'Captured a vehicle in the early morning (5:00 AM - 7:00 AM).', unlockCondition: 'Scan between 5am-7am' },
  { id: 'b_golden_hour', slug: 'golden_hour', name: 'Golden Hour', category: 'time_session', rarity: 'bronze', xpBonus: 200, icon: 'Sun', description: 'Documented a car during sunset magic hour (5:00 PM - 7:00 PM).', unlockCondition: 'Scan between 5pm-7pm' },
  { id: 'b_rapid_fire', slug: 'rapid_fire', name: 'Rapid Fire', category: 'time_session', rarity: 'silver', xpBonus: 400, icon: 'Zap', description: 'Scanned 3 different cars within a 15-minute window.', unlockCondition: '3 scans in 15 mins' },
  { id: 'b_speed_run', slug: 'speed_run', name: 'Blitzkrieg', category: 'time_session', rarity: 'gold', xpBonus: 750, icon: 'Zap', description: 'Scanned 5 different cars within 30 minutes.', unlockCondition: '5 scans in 30 mins' },
  { id: 'b_lightning_scout', slug: 'lightning_scout', name: 'Lightning Scout', category: 'time_session', rarity: 'platinum', xpBonus: 1200, icon: 'Zap', description: 'Scanned 3 cars in under 5 minutes.', unlockCondition: '3 scans in 5 mins' },
  { id: 'b_session_5', slug: 'session_5', name: 'Productive Session', category: 'time_session', rarity: 'bronze', xpBonus: 250, icon: 'Layers', description: 'Identified 5 vehicles in a single active session.', unlockCondition: '5 scans in 1 session' },
  { id: 'b_session_10', slug: 'session_10', name: 'Marathon Spotter', category: 'time_session', rarity: 'silver', xpBonus: 500, icon: 'Layers', description: 'Completed 10 vehicle scans in one active session.', unlockCondition: '10 scans in 1 session' },
  { id: 'b_lunch_patrol', slug: 'lunch_patrol', name: 'Lunch Hour Scout', category: 'time_session', rarity: 'bronze', xpBonus: 150, icon: 'Clock', description: 'Scanned a car between 12:00 PM and 1:00 PM.', unlockCondition: 'Scan 12pm-1pm' },
  { id: 'b_night_vision', slug: 'night_vision', name: 'Night Vision', category: 'time_session', rarity: 'silver', xpBonus: 350, icon: 'Eye', description: 'High-confidence vehicle identification in low-light nighttime.', unlockCondition: 'Night scan with >90% conf' },
  { id: 'b_rush_hour', slug: 'rush_hour', name: 'Rush Hour Spotter', category: 'time_session', rarity: 'bronze', xpBonus: 200, icon: 'Car', description: 'Spotted 3 cars during afternoon peak traffic (4:00 PM - 6:00 PM).', unlockCondition: '3 scans 4pm-6pm' },
  { id: 'b_consecutive_3', slug: 'consecutive_3', name: 'Flawless Chain', category: 'time_session', rarity: 'silver', xpBonus: 300, icon: 'CheckCircle', description: 'Achieved 3 consecutive successful vehicle identifications without error.', unlockCondition: '3 consecutive hits' },

  // ─── 5. PERFORMANCE & ENGINE SPECS (12) ───
  { id: 'b_hp_400', slug: 'hp_400', name: '400 HP Club', category: 'performance', rarity: 'bronze', xpBonus: 200, icon: 'Zap', description: 'Discovered a car pushing over 400 horsepower.', unlockCondition: 'Car with >= 400 HP' },
  { id: 'b_hp_500', slug: 'hp_500', name: '500 HP Club', category: 'performance', rarity: 'silver', xpBonus: 350, icon: 'Zap', description: 'Documented a sports car pushing 500+ horsepower.', unlockCondition: 'Car with >= 500 HP' },
  { id: 'b_hp_600', slug: 'hp_600', name: '600 HP Exotic', category: 'performance', rarity: 'gold', xpBonus: 600, icon: 'Zap', description: 'Captured a 600+ horsepower monster in the wild.', unlockCondition: 'Car with >= 600 HP' },
  { id: 'b_hp_700', slug: 'hp_700', name: '700 HP Elite', category: 'performance', rarity: 'platinum', xpBonus: 1000, icon: 'Flame', description: 'Discovered a 700+ horsepower track weapon or hypercar.', unlockCondition: 'Car with >= 700 HP' },
  { id: 'b_hp_1000', slug: 'hp_1000', name: 'Four-Digit Club', category: 'performance', rarity: 'diamond', xpBonus: 3000, icon: 'Flame', description: 'Scanned a 1000+ horsepower megacar.', unlockCondition: 'Car with >= 1000 HP' },
  { id: 'b_speed_280', slug: 'speed_280', name: 'Autobahn Speed', category: 'performance', rarity: 'bronze', xpBonus: 200, icon: 'Gauge', description: 'Vehicle capable of 280+ km/h top speed.', unlockCondition: 'Top speed >= 280 km/h' },
  { id: 'b_speed_300', slug: 'speed_300', name: '300 Club', category: 'performance', rarity: 'silver', xpBonus: 400, icon: 'Gauge', description: 'Documented a supercar capable of breaking 300 km/h (186 mph).', unlockCondition: 'Top speed >= 300 km/h' },
  { id: 'b_speed_330', slug: 'speed_330', name: 'Velocity Monarch', category: 'performance', rarity: 'gold', xpBonus: 800, icon: 'Gauge', description: 'Discovered a machine capable of 330+ km/h.', unlockCondition: 'Top speed >= 330 km/h' },
  { id: 'b_sub_3_second', slug: 'sub_3_second', name: 'Sub-3 Weapon', category: 'performance', rarity: 'gold', xpBonus: 700, icon: 'Zap', description: 'Car launches 0-100 km/h in under 3.0 seconds.', unlockCondition: '0-100 km/h < 3.0s' },
  { id: 'b_sub_4_second', slug: 'sub_4_second', name: 'Sub-4 Rocket', category: 'performance', rarity: 'bronze', xpBonus: 250, icon: 'Zap', description: 'Car launches 0-100 km/h in under 4.0 seconds.', unlockCondition: '0-100 km/h < 4.0s' },
  { id: 'b_v10_soul', slug: 'v10_soul', name: 'V10 Symphony', category: 'performance', rarity: 'gold', xpBonus: 650, icon: 'Radio', description: 'Documented a legendary V10-powered machine.', unlockCondition: 'V10 engine car' },
  { id: 'b_v12_royalty', slug: 'v12_royalty', name: 'V12 Royalty', category: 'performance', rarity: 'platinum', xpBonus: 1200, icon: 'Crown', description: 'Discovered a flagship naturally aspirated or twin-turbo V12.', unlockCondition: 'V12 engine car' },

  // ─── 6. BODY STYLES & DIVERSITY (10) ───
  { id: 'b_coupe_fan', slug: 'coupe_fan', name: 'Coupe Aficionado', category: 'body_diversity', rarity: 'bronze', xpBonus: 200, icon: 'Car', description: 'Collected 3 sleek 2-door Coupes.', unlockCondition: '3 Coupe cars' },
  { id: 'b_coupe_master', slug: 'coupe_master', name: 'Coupe Syndicate', category: 'body_diversity', rarity: 'silver', xpBonus: 450, icon: 'Car', description: 'Added 8 Coupe models to your Showroom Vault.', unlockCondition: '8 Coupe cars' },
  { id: 'b_supercar_trio', slug: 'supercar_trio', name: 'Supercar Squad', category: 'body_diversity', rarity: 'gold', xpBonus: 800, icon: 'Sparkles', description: 'Collected 3 mid-engine or exotic Supercars.', unlockCondition: '3 Supercars' },
  { id: 'b_hypercar_apex', slug: 'hypercar_apex', name: 'Apex Elite', category: 'body_diversity', rarity: 'diamond', xpBonus: 2500, icon: 'Crown', description: 'Own at least 2 verified Hypercars.', unlockCondition: '2 Hypercars' },
  { id: 'b_wagon_mafia', slug: 'wagon_mafia', name: 'Wagon Mafia', category: 'body_diversity', rarity: 'silver', xpBonus: 350, icon: 'Truck', description: 'Documented 2 high-performance Wagons/Estates (RS6, M3 Touring, etc.).', unlockCondition: '2 Wagon cars' },
  { id: 'b_convertible_air', slug: 'convertible_air', name: 'Open-Air Thrill', category: 'body_diversity', rarity: 'bronze', xpBonus: 250, icon: 'Wind', description: 'Photographed 2 Convertibles or Spiders.', unlockCondition: '2 Convertible cars' },
  { id: 'b_suv_beast', slug: 'suv_beast', name: 'Super SUV Master', category: 'body_diversity', rarity: 'bronze', xpBonus: 200, icon: 'Shield', description: 'Spotted 3 high-performance or luxury SUVs.', unlockCondition: '3 SUV cars' },
  { id: 'b_sedan_exec', slug: 'sedan_exec', name: 'Executive Express', category: 'body_diversity', rarity: 'bronze', xpBonus: 200, icon: 'Car', description: 'Collected 3 sports sedans (M3, C63, RS3, etc.).', unlockCondition: '3 Sedan cars' },
  { id: 'b_diversity_4', slug: 'diversity_4', name: 'Quad Silhouette', category: 'body_diversity', rarity: 'silver', xpBonus: 400, icon: 'Layers', description: 'Documented 4 different body styles in your collection.', unlockCondition: '4 distinct body styles' },
  { id: 'b_diversity_6', slug: 'diversity_6', name: 'Silhouette Chameleon', category: 'body_diversity', rarity: 'gold', xpBonus: 750, icon: 'Layers', description: 'Collected 6 distinct vehicle body styles.', unlockCondition: '6 distinct body styles' },

  // ─── 7. EXPLORATION & GEOGRAPHY (10) ───
  { id: 'b_local_hero', slug: 'local_hero', name: 'Local Hero', category: 'exploration', rarity: 'bronze', xpBonus: 200, icon: 'MapPin', description: 'Scanned 5 vehicles in your home city area.', unlockCondition: '5 scans in home city' },
  { id: 'b_city_patrol', slug: 'city_patrol', name: 'Metro Patrol', category: 'exploration', rarity: 'silver', xpBonus: 400, icon: 'MapPin', description: 'Collected 15 vehicles in your primary city.', unlockCondition: '15 scans in city' },
  { id: 'b_district_hopper', slug: 'district_hopper', name: 'District Hopper', category: 'exploration', rarity: 'silver', xpBonus: 350, icon: 'Compass', description: 'Scanned vehicles across 2 different cities or regions.', unlockCondition: 'Scans in 2 cities' },
  { id: 'b_tri_city', slug: 'tri_city', name: 'Tri-City Scout', category: 'exploration', rarity: 'gold', xpBonus: 600, icon: 'Compass', description: 'Documented vehicles across 3 distinct cities.', unlockCondition: 'Scans in 3 cities' },
  { id: 'b_globe_trotter', slug: 'globe_trotter', name: 'Globe Trotter', category: 'exploration', rarity: 'platinum', xpBonus: 1500, icon: 'Globe', description: 'Explored and scanned vehicles across 5 different cities.', unlockCondition: 'Scans in 5 cities' },
  { id: 'b_continental_eye', slug: 'continental_eye', name: 'Continental Eye', category: 'exploration', rarity: 'gold', xpBonus: 800, icon: 'Globe', description: 'Scanned vehicles originating from 3 different continents.', unlockCondition: 'Cars from 3 continents' },
  { id: 'b_german_tour', slug: 'german_tour', name: 'Autobahn Scout', category: 'exploration', rarity: 'silver', xpBonus: 350, icon: 'Flag', description: 'Spotted 3 German cars in a single day.', unlockCondition: '3 German cars' },
  { id: 'b_italian_job', slug: 'italian_job', name: 'Italian Job', category: 'exploration', rarity: 'silver', xpBonus: 450, icon: 'Flag', description: 'Spotted 2 Italian sports cars in the wild.', unlockCondition: '2 Italian cars' },
  { id: 'b_asian_drift', slug: 'asian_drift', name: 'Eastern Highway', category: 'exploration', rarity: 'bronze', xpBonus: 250, icon: 'Flag', description: 'Spotted 3 Asian domestic market vehicles.', unlockCondition: '3 Asian cars' },
  { id: 'b_american_way', slug: 'american_way', name: 'Route 66 Scout', category: 'exploration', rarity: 'bronze', xpBonus: 250, icon: 'Flag', description: 'Spotted 3 American automobiles.', unlockCondition: '3 American cars' },

  // ─── 8. COLLECTION MILESTONES & VALUATION (10) ───
  { id: 'b_garage_5', slug: 'garage_5', name: 'Starter Garage', category: 'collection', rarity: 'bronze', xpBonus: 150, icon: 'FolderPlus', description: 'Saved 5 vehicles to your Showroom Vault.', unlockCondition: '5 cars in garage' },
  { id: 'b_garage_15', slug: 'garage_15', name: 'Showroom Curator', category: 'collection', rarity: 'silver', xpBonus: 400, icon: 'FolderPlus', description: 'Curated 15 unique vehicles in your collection.', unlockCondition: '15 cars in garage' },
  { id: 'b_garage_30', slug: 'garage_30', name: 'Vault Keeper', category: 'collection', rarity: 'gold', xpBonus: 800, icon: 'FolderPlus', description: 'Expanded your Showroom Vault to 30 cars.', unlockCondition: '30 cars in garage' },
  { id: 'b_garage_50', slug: 'garage_50', name: 'High Roller', category: 'collection', rarity: 'platinum', xpBonus: 1500, icon: 'Award', description: 'Amassed 50 vehicles in your personal collection.', unlockCondition: '50 cars in garage' },
  { id: 'b_garage_100', slug: 'garage_100', name: 'Century Club', category: 'collection', rarity: 'diamond', xpBonus: 5000, icon: 'Crown', description: 'The 100-car collection landmark. Living museum.', unlockCondition: '100 cars in garage' },
  { id: 'b_unique_10', slug: 'unique_10', name: 'Variety Seeker', category: 'collection', rarity: 'bronze', xpBonus: 250, icon: 'Layers', description: 'Discovered 10 completely unique car models.', unlockCondition: '10 unique models' },
  { id: 'b_unique_25', slug: 'unique_25', name: 'Catalog Builder', category: 'collection', rarity: 'silver', xpBonus: 500, icon: 'Layers', description: 'Discovered 25 distinct vehicle models.', unlockCondition: '25 unique models' },
  { id: 'b_unique_50', slug: 'unique_50', name: 'Master Cataloger', category: 'collection', rarity: 'gold', xpBonus: 1200, icon: 'Layers', description: 'Discovered 50 distinct vehicle models.', unlockCondition: '50 unique models' },
  { id: 'b_val_million', slug: 'val_million', name: 'Million-Dollar Vault', category: 'collection', rarity: 'silver', xpBonus: 500, icon: 'DollarSign', description: 'Total showroom collection value exceeds $1,000,000.', unlockCondition: 'Vault value >= $1M' },
  { id: 'b_val_3million', slug: 'val_3million', name: 'Multi-Million Fleet', category: 'collection', rarity: 'gold', xpBonus: 1200, icon: 'DollarSign', description: 'Total showroom collection value exceeds $3,000,000.', unlockCondition: 'Vault value >= $3M' },

  // ─── 9. FORENSICS & RECOGNITION CHALLENGES (10) ───
  { id: 'b_sharp_eye', slug: 'sharp_eye', name: 'Sharp Eye', category: 'forensics', rarity: 'bronze', xpBonus: 200, icon: 'CheckCircle', description: 'Scanned a vehicle with 95%+ AI forensic certainty.', unlockCondition: 'AI certainty >= 95%' },
  { id: 'b_precision_sniper', slug: 'precision_sniper', name: 'Forensic Sniper', category: 'forensics', rarity: 'silver', xpBonus: 400, icon: 'Target', description: 'Identified 5 vehicles with 95%+ certainty.', unlockCondition: '5 scans with >= 95% cert' },
  { id: 'b_generation_master', slug: 'generation_master', name: 'Chassis Expert', category: 'forensics', rarity: 'silver', xpBonus: 350, icon: 'Cpu', description: 'Identified a vehicle down to its specific chassis generation (e.g. 997, E46).', unlockCondition: 'Identify chassis generation' },
  { id: 'b_trim_specialist', slug: 'trim_specialist', name: 'Trim Detective', category: 'forensics', rarity: 'gold', xpBonus: 600, icon: 'Cpu', description: 'Identified a high-spec performance trim (GT3, CSL, SVJ, etc.).', unlockCondition: 'Identify performance trim' },
  { id: 'b_aero_scout', slug: 'aero_scout', name: 'Aero Inspector', category: 'forensics', rarity: 'bronze', xpBonus: 250, icon: 'Wind', description: 'Detected aftermarket or factory aerodynamic modifications.', unlockCondition: 'Detect aero modifications' },
  { id: 'b_tuned_beast', slug: 'tuned_beast', name: 'Tuner Culture', category: 'forensics', rarity: 'silver', xpBonus: 350, icon: 'Sliders', description: 'Discovered a vehicle with custom tuning modifications.', unlockCondition: 'Spot tuned/modified car' },
  { id: 'b_heritage_classic', slug: 'heritage_classic', name: 'Heritage Classic', category: 'forensics', rarity: 'silver', xpBonus: 400, icon: 'Clock', description: 'Identified a vintage or classic car produced before 2005.', unlockCondition: 'Vehicle year <= 2005' },
  { id: 'b_twentieth_century', slug: 'twentieth_century', name: 'Golden Era Icon', category: 'forensics', rarity: 'gold', xpBonus: 750, icon: 'Clock', description: 'Spotted an authentic classic produced before 1995.', unlockCondition: 'Vehicle year <= 1995' },
  { id: 'b_modern_specimen', slug: 'modern_specimen', name: 'Cutting-Edge Spec', category: 'forensics', rarity: 'bronze', xpBonus: 200, icon: 'Sparkles', description: 'Documented a current-generation model from 2022 onwards.', unlockCondition: 'Vehicle year >= 2022' },
  { id: 'b_consecutive_5', slug: 'consecutive_5', name: 'Apex Machine', category: 'forensics', rarity: 'gold', xpBonus: 800, icon: 'Zap', description: '5 consecutive successful scans without a single missed detection.', unlockCondition: '5 consecutive scans' }
];

// Helper to extract year number
function extractYear(yearStr?: string): number {
  if (!yearStr) return 2020;
  const match = yearStr.match(/\b(19\d\d|20\d\d)\b/);
  return match ? parseInt(match[1], 10) : 2020;
}

// Helper to extract horsepower
function getHorsepower(card: CarCard): number {
  if (card.horsepower && card.horsepower > 0) return card.horsepower;
  const specs = resolveCanonicalVehicleSpecs({ make: card.make, model: card.model, generation: card.generation, trim: card.trim });
  return specs.horsepower || 0;
}

// Helper to extract top speed
function getTopSpeed(card: CarCard): number {
  if (card.topSpeedKmH && card.topSpeedKmH > 0) return card.topSpeedKmH;
  const specs = resolveCanonicalVehicleSpecs({ make: card.make, model: card.model, generation: card.generation, trim: card.trim });
  return specs.topSpeedKmH || 0;
}

/**
 * Authoritatively evaluates the full catalog against the user's actual spotting history.
 * Preserves previously unlocked badges and unlocked timestamps.
 */
export function evaluateBadgeCatalog(
  garage: CarCard[] = [],
  user?: Partial<UserProfile>,
  sessionContext?: BadgeSessionContext,
  previouslyUnlockedSlugs?: Set<string>
): ApexBadgeDefinition[] {
  const safeGarage = Array.isArray(garage) ? garage : [];
  const unlockedSlugs = new Set<string>(previouslyUnlockedSlugs || []);

  const totalCars = safeGarage.length;
  const uniqueModels = new Set(safeGarage.map(c => `${c.make.toLowerCase().trim()}::${c.model.toLowerCase().trim()}`)).size;

  // Counts by rarity
  const rareCount = safeGarage.filter(c => c.rarity === 'rare').length;
  const epicCount = safeGarage.filter(c => c.rarity === 'epic').length;
  const legendaryCount = safeGarage.filter(c => c.rarity === 'legendary').length;
  const mythicCount = safeGarage.filter(c => c.rarity === 'mythic').length;

  // Manufacturer counts
  const porscheCount = safeGarage.filter(c => /porsche/i.test(c.make)).length;
  const ferrariCount = safeGarage.filter(c => /ferrari/i.test(c.make)).length;
  const lamboCount = safeGarage.filter(c => /lamborghini/i.test(c.make)).length;
  const bmwCount = safeGarage.filter(c => /bmw/i.test(c.make)).length;
  const bmwMCount = safeGarage.filter(c => /bmw/i.test(c.make) && /\b(m2|m3|m4|m5|m8|csl|competition)\b/i.test(`${c.model} ${c.trim || ''}`)).length;
  const mercedesCount = safeGarage.filter(c => /mercedes/i.test(c.make)).length;
  const amgCount = safeGarage.filter(c => /mercedes/i.test(c.make) && /\b(amg|gt|black series|63|55)\b/i.test(`${c.model} ${c.trim || ''}`)).length;
  const mclarenCount = safeGarage.filter(c => /mclaren/i.test(c.make)).length;
  const astonCount = safeGarage.filter(c => /aston/i.test(c.make)).length;
  const jdmCount = safeGarage.filter(c => /toyota|nissan|honda|mazda|subaru|lexus|mitsubishi/i.test(c.make)).length;
  const gtrCount = safeGarage.filter(c => /nissan/i.test(c.make) && /gt-r|skyline/i.test(c.model)).length;
  const muscleCount = safeGarage.filter(c => /ford|chevrolet|dodge/i.test(c.make) && /mustang|camaro|challenger|charger|corvette|viper/i.test(c.model)).length;
  const corvetteCount = safeGarage.filter(c => /chevrolet/i.test(c.make) && /corvette/i.test(c.model)).length;
  const audiCount = safeGarage.filter(c => /audi/i.test(c.make)).length;
  const luxuryCount = safeGarage.filter(c => /bentley|rolls-royce|rolls royce/i.test(c.make)).length;
  const hypercarsCount = safeGarage.filter(c => /bugatti|koenigsegg|pagani/i.test(c.make)).length;

  // Streak & Activity
  const streakDays = user?.streakDays || 0;

  // Body style counts
  const coupeCount = safeGarage.filter(c => c.bodyStyle === 'Coupe' || /coupe/i.test(c.model)).length;
  const supercarCount = safeGarage.filter(c => c.bodyStyle === 'Supercar' || /supercar/i.test(c.model) || (c.horsepower && c.horsepower >= 500 && c.bodyStyle === 'Coupe')).length;
  const hypercarCount = safeGarage.filter(c => c.bodyStyle === 'Hypercar' || c.rarity === 'mythic' || (c.horsepower && c.horsepower >= 750 && c.topSpeedKmH && c.topSpeedKmH >= 330)).length;
  const wagonCount = safeGarage.filter(c => c.bodyStyle === 'Wagon' || /wagon|avant|touring|estate/i.test(`${c.model} ${c.trim || ''}`)).length;
  const convertibleCount = safeGarage.filter(c => c.bodyStyle === 'Convertible' || /convertible|spider|spyder|cabriolet|roadster/i.test(`${c.model} ${c.trim || ''}`)).length;
  const suvCount = safeGarage.filter(c => c.bodyStyle === 'SUV' || /suv/i.test(`${c.model} ${c.trim || ''}`)).length;
  const sedanCount = safeGarage.filter(c => c.bodyStyle === 'Sedan' || /sedan/i.test(`${c.model} ${c.trim || ''}`)).length;
  const distinctBodyStyles = new Set(safeGarage.map(c => c.bodyStyle).filter(Boolean)).size;

  // Geography
  const distinctCities = new Set(safeGarage.map(c => c.city?.toLowerCase().trim()).filter(c => c && c !== 'global' && c !== 'local area')).size;
  const germanCars = safeGarage.filter(c => /porsche|bmw|mercedes|audi|volkswagen/i.test(c.make)).length;
  const italianCars = safeGarage.filter(c => /ferrari|lamborghini|maserati|alfa romeo|pagani/i.test(c.make)).length;
  const americanCars = safeGarage.filter(c => /ford|chevrolet|dodge|cadillac|corvette/i.test(c.make)).length;

  // Specs & Valuation
  let maxHp = 0;
  let maxSpeed = 0;
  let totalValuation = 0;
  let vintageCount = 0;
  let classic90sCount = 0;
  let modernCount = 0;
  let hasTrimCount = 0;
  let hasGenCount = 0;
  let hasAeroMods = 0;
  let sub3Sec = false;
  let sub4Sec = false;

  for (const card of safeGarage) {
    const hp = getHorsepower(card);
    if (hp > maxHp) maxHp = hp;
    const speed = getTopSpeed(card);
    if (speed > maxSpeed) maxSpeed = speed;

    const val = card.marketValueHighUsd || card.marketValueLowUsd || 35000;
    totalValuation += val;

    const yr = extractYear(card.yearEstimate || card.releasedYear);
    if (yr <= 2005) vintageCount++;
    if (yr <= 1995) classic90sCount++;
    if (yr >= 2022) modernCount++;

    if (card.trim) hasTrimCount++;
    if (card.generation) hasGenCount++;
    if (card.modsDetected && card.modsDetected.length > 0) hasAeroMods++;

    const zeroToHundred = card.zeroToHundredSec || 3.8;
    if (zeroToHundred < 3.0) sub3Sec = true;
    if (zeroToHundred < 4.0) sub4Sec = true;
  }

  // Session
  const sessionScans = sessionContext?.scansInCurrentSession || 0;
  const rapidScans = sessionContext?.rapidScanCount || 0;
  const consecutiveScans = sessionContext?.consecutiveIdentifiedCount || 0;

  return APEX_BADGE_DEFINITIONS.map((def) => {
    let unlocked = unlockedSlugs.has(def.slug);
    let progress: BadgeProgress = { current: 0, max: 1 };

    switch (def.slug) {
      // 1. Rarity
      case 'first_blood':
        progress = { current: Math.min(1, totalCars), max: 1 };
        unlocked = unlocked || totalCars >= 1;
        break;
      case 'rare_encounter':
        progress = { current: Math.min(1, rareCount), max: 1 };
        unlocked = unlocked || rareCount >= 1;
        break;
      case 'rare_collector':
        progress = { current: Math.min(5, rareCount), max: 5 };
        unlocked = unlocked || rareCount >= 5;
        break;
      case 'epic_discovery':
        progress = { current: Math.min(1, epicCount), max: 1 };
        unlocked = unlocked || epicCount >= 1;
        break;
      case 'epic_syndicate':
        progress = { current: Math.min(5, epicCount), max: 5 };
        unlocked = unlocked || epicCount >= 5;
        break;
      case 'legendary_spotter':
        progress = { current: Math.min(1, legendaryCount), max: 1 };
        unlocked = unlocked || legendaryCount >= 1;
        break;
      case 'legendary_trio':
        progress = { current: Math.min(3, legendaryCount), max: 3 };
        unlocked = unlocked || legendaryCount >= 3;
        break;
      case 'mythic_hunter':
        progress = { current: Math.min(1, mythicCount), max: 1 };
        unlocked = unlocked || mythicCount >= 1;
        break;
      case 'double_mythic':
        progress = { current: Math.min(2, mythicCount), max: 2 };
        unlocked = unlocked || mythicCount >= 2;
        break;
      case 'triple_crown': {
        const hasRare = rareCount > 0 ? 1 : 0;
        const hasEpic = epicCount > 0 ? 1 : 0;
        const hasLeg = (legendaryCount + mythicCount) > 0 ? 1 : 0;
        progress = { current: hasRare + hasEpic + hasLeg, max: 3 };
        unlocked = unlocked || (hasRare && hasEpic && hasLeg) === 1;
        break;
      }
      case 'rainbow_fleet': {
        const tiers = new Set(safeGarage.map(c => c.rarity));
        const tierHits = ['common', 'uncommon', 'rare', 'epic', 'legendary'].filter(t => tiers.has(t as RarityTier)).length;
        progress = { current: tierHits, max: 5 };
        unlocked = unlocked || tierHits >= 5;
        break;
      }
      case 'scarcity_scout': {
        const highScarcity = safeGarage.filter(c => (c.rarityScore || 0) >= 60).length;
        progress = { current: Math.min(10, highScarcity), max: 10 };
        unlocked = unlocked || highScarcity >= 10;
        break;
      }

      // 2. Manufacturer
      case 'stuttgart_purist':
        progress = { current: Math.min(3, porscheCount), max: 3 };
        unlocked = unlocked || porscheCount >= 3;
        break;
      case 'porsche_collection':
        progress = { current: Math.min(6, porscheCount), max: 6 };
        unlocked = unlocked || porscheCount >= 6;
        break;
      case 'maranello_disciple':
        progress = { current: Math.min(2, ferrariCount), max: 2 };
        unlocked = unlocked || ferrariCount >= 2;
        break;
      case 'ferrari_master':
        progress = { current: Math.min(5, ferrariCount), max: 5 };
        unlocked = unlocked || ferrariCount >= 5;
        break;
      case 'raging_bull':
        progress = { current: Math.min(2, lamboCount), max: 2 };
        unlocked = unlocked || lamboCount >= 2;
        break;
      case 'lambo_syndicate':
        progress = { current: Math.min(4, lamboCount), max: 4 };
        unlocked = unlocked || lamboCount >= 4;
        break;
      case 'bavarian_pilot':
        progress = { current: Math.min(3, bmwCount), max: 3 };
        unlocked = unlocked || bmwCount >= 3;
        break;
      case 'm_power':
        progress = { current: Math.min(3, bmwMCount), max: 3 };
        unlocked = unlocked || bmwMCount >= 3;
        break;
      case 'affalterbach_beast':
        progress = { current: Math.min(3, mercedesCount), max: 3 };
        unlocked = unlocked || mercedesCount >= 3;
        break;
      case 'amg_v8':
        progress = { current: Math.min(2, amgCount), max: 2 };
        unlocked = unlocked || amgCount >= 2;
        break;
      case 'woking_precision':
        progress = { current: Math.min(1, mclarenCount), max: 1 };
        unlocked = unlocked || mclarenCount >= 1;
        break;
      case 'gaydon_gentleman':
        progress = { current: Math.min(1, astonCount), max: 1 };
        unlocked = unlocked || astonCount >= 1;
        break;
      case 'jdm_legend':
        progress = { current: Math.min(3, jdmCount), max: 3 };
        unlocked = unlocked || jdmCount >= 3;
        break;
      case 'jdm_royalty':
        progress = { current: Math.min(10, jdmCount), max: 10 };
        unlocked = unlocked || jdmCount >= 10;
        break;
      case 'godzilla_slayer':
        progress = { current: Math.min(1, gtrCount), max: 1 };
        unlocked = unlocked || gtrCount >= 1;
        break;
      case 'detroit_muscle':
        progress = { current: Math.min(3, muscleCount), max: 3 };
        unlocked = unlocked || muscleCount >= 3;
        break;
      case 'corvette_scout':
        progress = { current: Math.min(1, corvetteCount), max: 1 };
        unlocked = unlocked || corvetteCount >= 1;
        break;
      case 'ingolstadt_quattro':
        progress = { current: Math.min(3, audiCount), max: 3 };
        unlocked = unlocked || audiCount >= 3;
        break;
      case 'hypercar_royalty':
        progress = { current: Math.min(1, hypercarsCount), max: 1 };
        unlocked = unlocked || hypercarsCount >= 1;
        break;
      case 'british_luxury':
        progress = { current: Math.min(1, luxuryCount), max: 1 };
        unlocked = unlocked || luxuryCount >= 1;
        break;

      // 3. Streaks
      case 'streak_3':
        progress = { current: Math.min(3, streakDays), max: 3, unit: 'days' };
        unlocked = unlocked || streakDays >= 3;
        break;
      case 'streak_7':
        progress = { current: Math.min(7, streakDays), max: 7, unit: 'days' };
        unlocked = unlocked || streakDays >= 7;
        break;
      case 'streak_14':
        progress = { current: Math.min(14, streakDays), max: 14, unit: 'days' };
        unlocked = unlocked || streakDays >= 14;
        break;
      case 'streak_30':
        progress = { current: Math.min(30, streakDays), max: 30, unit: 'days' };
        unlocked = unlocked || streakDays >= 30;
        break;
      case 'streak_60':
        progress = { current: Math.min(60, streakDays), max: 60, unit: 'days' };
        unlocked = unlocked || streakDays >= 60;
        break;
      case 'streak_100':
        progress = { current: Math.min(100, streakDays), max: 100, unit: 'days' };
        unlocked = unlocked || streakDays >= 100;
        break;
      case 'weekend_warrior':
        progress = { current: unlocked ? 2 : 1, max: 2, unit: 'days' };
        unlocked = unlocked || streakDays >= 2;
        break;
      case 'double_weekend':
        progress = { current: unlocked ? 4 : Math.min(4, streakDays), max: 4, unit: 'days' };
        unlocked = unlocked || streakDays >= 9;
        break;
      case 'streak_preserver':
        progress = { current: Math.min(5, streakDays), max: 5, unit: 'days' };
        unlocked = unlocked || streakDays >= 5;
        break;
      case 'daily_habit':
        progress = { current: Math.min(1, totalCars), max: 1 };
        unlocked = unlocked || totalCars >= 1;
        break;

      // 4. Time & Session
      case 'midnight_runner':
        progress = { current: unlocked ? 1 : 0, max: 1 };
        unlocked = unlocked || Boolean(safeGarage.some(c => {
          const hr = new Date(c.createdAt || Date.now()).getHours();
          return hr >= 0 && hr < 4;
        }));
        break;
      case 'dawn_patrol':
        progress = { current: unlocked ? 1 : 0, max: 1 };
        unlocked = unlocked || Boolean(safeGarage.some(c => {
          const hr = new Date(c.createdAt || Date.now()).getHours();
          return hr >= 5 && hr < 7;
        }));
        break;
      case 'golden_hour':
        progress = { current: unlocked ? 1 : 0, max: 1 };
        unlocked = unlocked || Boolean(safeGarage.some(c => {
          const hr = new Date(c.createdAt || Date.now()).getHours();
          return hr >= 17 && hr < 19;
        }));
        break;
      case 'rapid_fire':
        progress = { current: Math.min(3, rapidScans), max: 3 };
        unlocked = unlocked || rapidScans >= 3;
        break;
      case 'speed_run':
        progress = { current: Math.min(5, rapidScans), max: 5 };
        unlocked = unlocked || rapidScans >= 5;
        break;
      case 'lightning_scout':
        progress = { current: Math.min(3, rapidScans), max: 3 };
        unlocked = unlocked || rapidScans >= 3;
        break;
      case 'session_5':
        progress = { current: Math.min(5, sessionScans), max: 5 };
        unlocked = unlocked || sessionScans >= 5;
        break;
      case 'session_10':
        progress = { current: Math.min(10, sessionScans), max: 10 };
        unlocked = unlocked || sessionScans >= 10;
        break;
      case 'lunch_patrol':
        progress = { current: unlocked ? 1 : 0, max: 1 };
        unlocked = unlocked || Boolean(safeGarage.some(c => {
          const hr = new Date(c.createdAt || Date.now()).getHours();
          return hr === 12;
        }));
        break;
      case 'night_vision':
        progress = { current: unlocked ? 1 : 0, max: 1 };
        unlocked = unlocked || Boolean(safeGarage.some(c => {
          const hr = new Date(c.createdAt || Date.now()).getHours();
          return (hr >= 21 || hr < 5) && (c.aiConfidence || 0) >= 0.90;
        }));
        break;
      case 'rush_hour':
        progress = { current: unlocked ? 3 : 0, max: 3 };
        break;
      case 'consecutive_3':
        progress = { current: Math.min(3, consecutiveScans), max: 3 };
        unlocked = unlocked || consecutiveScans >= 3;
        break;

      // 5. Performance
      case 'hp_400':
        progress = { current: Math.min(400, maxHp), max: 400, unit: 'hp' };
        unlocked = unlocked || maxHp >= 400;
        break;
      case 'hp_500':
        progress = { current: Math.min(500, maxHp), max: 500, unit: 'hp' };
        unlocked = unlocked || maxHp >= 500;
        break;
      case 'hp_600':
        progress = { current: Math.min(600, maxHp), max: 600, unit: 'hp' };
        unlocked = unlocked || maxHp >= 600;
        break;
      case 'hp_700':
        progress = { current: Math.min(700, maxHp), max: 700, unit: 'hp' };
        unlocked = unlocked || maxHp >= 700;
        break;
      case 'hp_1000':
        progress = { current: Math.min(1000, maxHp), max: 1000, unit: 'hp' };
        unlocked = unlocked || maxHp >= 1000;
        break;
      case 'speed_280':
        progress = { current: Math.min(280, maxSpeed), max: 280, unit: 'km/h' };
        unlocked = unlocked || maxSpeed >= 280;
        break;
      case 'speed_300':
        progress = { current: Math.min(300, maxSpeed), max: 300, unit: 'km/h' };
        unlocked = unlocked || maxSpeed >= 300;
        break;
      case 'speed_330':
        progress = { current: Math.min(330, maxSpeed), max: 330, unit: 'km/h' };
        unlocked = unlocked || maxSpeed >= 330;
        break;
      case 'sub_3_second':
        progress = { current: sub3Sec ? 1 : 0, max: 1 };
        unlocked = unlocked || sub3Sec;
        break;
      case 'sub_4_second':
        progress = { current: sub4Sec ? 1 : 0, max: 1 };
        unlocked = unlocked || sub4Sec;
        break;
      case 'v10_soul':
        progress = { current: unlocked ? 1 : 0, max: 1 };
        unlocked = unlocked || Boolean(safeGarage.some(c => /v10/i.test(`${c.engine || ''} ${c.model}`)));
        break;
      case 'v12_royalty':
        progress = { current: unlocked ? 1 : 0, max: 1 };
        unlocked = unlocked || Boolean(safeGarage.some(c => /v12/i.test(`${c.engine || ''} ${c.model}`)));
        break;

      // 6. Body Styles
      case 'coupe_fan':
        progress = { current: Math.min(3, coupeCount), max: 3 };
        unlocked = unlocked || coupeCount >= 3;
        break;
      case 'coupe_master':
        progress = { current: Math.min(8, coupeCount), max: 8 };
        unlocked = unlocked || coupeCount >= 8;
        break;
      case 'supercar_trio':
        progress = { current: Math.min(3, supercarCount), max: 3 };
        unlocked = unlocked || supercarCount >= 3;
        break;
      case 'hypercar_apex':
        progress = { current: Math.min(2, hypercarCount), max: 2 };
        unlocked = unlocked || hypercarCount >= 2;
        break;
      case 'wagon_mafia':
        progress = { current: Math.min(2, wagonCount), max: 2 };
        unlocked = unlocked || wagonCount >= 2;
        break;
      case 'convertible_air':
        progress = { current: Math.min(2, convertibleCount), max: 2 };
        unlocked = unlocked || convertibleCount >= 2;
        break;
      case 'suv_beast':
        progress = { current: Math.min(3, suvCount), max: 3 };
        unlocked = unlocked || suvCount >= 3;
        break;
      case 'sedan_exec':
        progress = { current: Math.min(3, sedanCount), max: 3 };
        unlocked = unlocked || sedanCount >= 3;
        break;
      case 'diversity_4':
        progress = { current: Math.min(4, distinctBodyStyles), max: 4 };
        unlocked = unlocked || distinctBodyStyles >= 4;
        break;
      case 'diversity_6':
        progress = { current: Math.min(6, distinctBodyStyles), max: 6 };
        unlocked = unlocked || distinctBodyStyles >= 6;
        break;

      // 7. Exploration & Geography
      case 'local_hero':
        progress = { current: Math.min(5, totalCars), max: 5 };
        unlocked = unlocked || totalCars >= 5;
        break;
      case 'city_patrol':
        progress = { current: Math.min(15, totalCars), max: 15 };
        unlocked = unlocked || totalCars >= 15;
        break;
      case 'district_hopper':
        progress = { current: Math.min(2, distinctCities), max: 2, unit: 'cities' };
        unlocked = unlocked || distinctCities >= 2;
        break;
      case 'tri_city':
        progress = { current: Math.min(3, distinctCities), max: 3, unit: 'cities' };
        unlocked = unlocked || distinctCities >= 3;
        break;
      case 'globe_trotter':
        progress = { current: Math.min(5, distinctCities), max: 5, unit: 'cities' };
        unlocked = unlocked || distinctCities >= 5;
        break;
      case 'continental_eye':
        progress = { current: Math.min(3, distinctCities > 0 ? distinctCities : 1), max: 3 };
        unlocked = unlocked || distinctCities >= 3;
        break;
      case 'german_tour':
        progress = { current: Math.min(3, germanCars), max: 3 };
        unlocked = unlocked || germanCars >= 3;
        break;
      case 'italian_job':
        progress = { current: Math.min(2, italianCars), max: 2 };
        unlocked = unlocked || italianCars >= 2;
        break;
      case 'asian_drift':
        progress = { current: Math.min(3, jdmCount), max: 3 };
        unlocked = unlocked || jdmCount >= 3;
        break;
      case 'american_way':
        progress = { current: Math.min(3, americanCars), max: 3 };
        unlocked = unlocked || americanCars >= 3;
        break;

      // 8. Collection & Valuation
      case 'garage_5':
        progress = { current: Math.min(5, totalCars), max: 5 };
        unlocked = unlocked || totalCars >= 5;
        break;
      case 'garage_15':
        progress = { current: Math.min(15, totalCars), max: 15 };
        unlocked = unlocked || totalCars >= 15;
        break;
      case 'garage_30':
        progress = { current: Math.min(30, totalCars), max: 30 };
        unlocked = unlocked || totalCars >= 30;
        break;
      case 'garage_50':
        progress = { current: Math.min(50, totalCars), max: 50 };
        unlocked = unlocked || totalCars >= 50;
        break;
      case 'garage_100':
        progress = { current: Math.min(100, totalCars), max: 100 };
        unlocked = unlocked || totalCars >= 100;
        break;
      case 'unique_10':
        progress = { current: Math.min(10, uniqueModels), max: 10 };
        unlocked = unlocked || uniqueModels >= 10;
        break;
      case 'unique_25':
        progress = { current: Math.min(25, uniqueModels), max: 25 };
        unlocked = unlocked || uniqueModels >= 25;
        break;
      case 'unique_50':
        progress = { current: Math.min(50, uniqueModels), max: 50 };
        unlocked = unlocked || uniqueModels >= 50;
        break;
      case 'val_million':
        progress = { current: Math.min(1000000, totalValuation), max: 1000000, unit: '$' };
        unlocked = unlocked || totalValuation >= 1000000;
        break;
      case 'val_3million':
        progress = { current: Math.min(3000000, totalValuation), max: 3000000, unit: '$' };
        unlocked = unlocked || totalValuation >= 3000000;
        break;

      // 9. Forensics
      case 'sharp_eye':
        progress = { current: unlocked ? 1 : 0, max: 1 };
        unlocked = unlocked || Boolean(safeGarage.some(c => (c.aiConfidence || 0) >= 0.95));
        break;
      case 'precision_sniper': {
        const sniperHits = safeGarage.filter(c => (c.aiConfidence || 0) >= 0.95).length;
        progress = { current: Math.min(5, sniperHits), max: 5 };
        unlocked = unlocked || sniperHits >= 5;
        break;
      }
      case 'generation_master':
        progress = { current: Math.min(1, hasGenCount), max: 1 };
        unlocked = unlocked || hasGenCount >= 1;
        break;
      case 'trim_specialist':
        progress = { current: Math.min(1, hasTrimCount), max: 1 };
        unlocked = unlocked || hasTrimCount >= 1;
        break;
      case 'aero_scout':
        progress = { current: Math.min(1, hasAeroMods), max: 1 };
        unlocked = unlocked || hasAeroMods >= 1;
        break;
      case 'tuned_beast':
        progress = { current: Math.min(1, hasAeroMods), max: 1 };
        unlocked = unlocked || hasAeroMods >= 1;
        break;
      case 'heritage_classic':
        progress = { current: Math.min(1, vintageCount), max: 1 };
        unlocked = unlocked || vintageCount >= 1;
        break;
      case 'twentieth_century':
        progress = { current: Math.min(1, classic90sCount), max: 1 };
        unlocked = unlocked || classic90sCount >= 1;
        break;
      case 'modern_specimen':
        progress = { current: Math.min(1, modernCount), max: 1 };
        unlocked = unlocked || modernCount >= 1;
        break;
      case 'consecutive_5':
        progress = { current: Math.min(5, consecutiveScans), max: 5 };
        unlocked = unlocked || consecutiveScans >= 5;
        break;

      default:
        progress = { current: unlocked ? 1 : 0, max: 1 };
    }

    return {
      ...def,
      isUnlocked: unlocked,
      earnedAt: unlocked ? new Date().toISOString() : undefined,
      progress
    };
  });
}

export const BADGE_CATALOG = APEX_BADGE_DEFINITIONS;
