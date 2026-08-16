-- ════════════════════════════════════════════════════════════════════════════
-- APEX SUPABASE HARDENED PRODUCTION SCHEMA & AUTHORIZATION POLICIES
-- Zero-Trust Server-Side Authority Architecture & Immutable Ledger
-- ════════════════════════════════════════════════════════════════════════════

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ────────────────────────────────────────────────────────────────────────────
-- 1. PROFILES TABLE
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  level INTEGER DEFAULT 1 NOT NULL CHECK (level >= 1 AND level <= 100),
  xp INTEGER DEFAULT 0 NOT NULL CHECK (xp >= 0),
  coins INTEGER DEFAULT 50 NOT NULL CHECK (coins >= 0),
  streak_days INTEGER DEFAULT 0 NOT NULL CHECK (streak_days >= 0),
  last_scan_at TIMESTAMP WITH TIME ZONE,
  daily_scans_count INTEGER DEFAULT 0 NOT NULL CHECK (daily_scans_count >= 0),
  daily_scans_reset_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  total_spots INTEGER DEFAULT 0 NOT NULL CHECK (total_spots >= 0),
  rarest_find TEXT DEFAULT 'None' NOT NULL,
  city TEXT DEFAULT 'Local Area',
  country TEXT DEFAULT 'Global',
  latitude DOUBLE PRECISION DEFAULT 0,
  longitude DOUBLE PRECISION DEFAULT 0,
  allow_hunts BOOLEAN DEFAULT true NOT NULL,
  default_privacy_level TEXT DEFAULT 'public_blurred' NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ────────────────────────────────────────────────────────────────────────────
-- 2. GARAGE TABLE (Scanned & Minted Cars — Immutable Collectibles)
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS garage (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  year_estimate TEXT NOT NULL,
  color TEXT NOT NULL,
  rarity TEXT NOT NULL CHECK (rarity IN ('common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic')),
  image_url TEXT NOT NULL,
  image_hash TEXT, -- SHA-256 / Perceptual hash for replay detection
  city TEXT NOT NULL,
  country TEXT NOT NULL,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  horsepower INTEGER DEFAULT 0 CHECK (horsepower >= 0 AND horsepower <= 2500),
  top_speed_kmh INTEGER DEFAULT 0 CHECK (top_speed_kmh >= 0 AND top_speed_kmh <= 600),
  xp_earned INTEGER DEFAULT 0 NOT NULL CHECK (xp_earned >= 0 AND xp_earned <= 5000),
  is_minted BOOLEAN DEFAULT false NOT NULL,
  card_number TEXT NOT NULL,
  scanned_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ────────────────────────────────────────────────────────────────────────────
-- 3. SOCIAL FEED POSTS TABLE
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS posts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  car_id UUID REFERENCES garage(id) ON DELETE CASCADE NOT NULL,
  caption TEXT,
  likes_count INTEGER DEFAULT 0 NOT NULL CHECK (likes_count >= 0),
  comments_count INTEGER DEFAULT 0 NOT NULL CHECK (comments_count >= 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ────────────────────────────────────────────────────────────────────────────
-- 4. SCAN RECEIPTS AUDIT TABLE (Anti-Cheat & Replay Protection)
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS scan_receipts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  image_hash TEXT NOT NULL,
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  rarity TEXT NOT NULL,
  xp_awarded INTEGER NOT NULL,
  client_ip TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_scan_receipts_user_hash ON scan_receipts(user_id, image_hash);
CREATE INDEX IF NOT EXISTS idx_scan_receipts_user_time ON scan_receipts(user_id, created_at DESC);

-- ────────────────────────────────────────────────────────────────────────────
-- 5. IMMUTABLE XP & COIN LEDGER (Double-Entry Accounting)
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS economy_ledger (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  currency_type TEXT NOT NULL CHECK (currency_type IN ('xp', 'coins')),
  amount INTEGER NOT NULL, -- Positive for rewards/earnings, negative for spends
  reason TEXT NOT NULL, -- e.g. 'car_scan', 'quest_reward', 'level_up_bonus', 'mint_fee'
  reference_id UUID, -- References garage(id) or quest_claim(id)
  balance_after INTEGER NOT NULL CHECK (balance_after >= 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_economy_ledger_user ON economy_ledger(user_id, created_at DESC);

-- ────────────────────────────────────────────────────────────────────────────
-- 6. REWARD & QUEST CLAIMS (Idempotency Table)
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reward_claims (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  reward_type TEXT NOT NULL, -- 'daily_quest', 'level_up', 'streak_milestone', 'daily_mission'
  claim_key TEXT NOT NULL, -- e.g. 'quest_2026-08-16_supercar_hunter', 'level_10_unlock'
  coins_awarded INTEGER DEFAULT 0 NOT NULL CHECK (coins_awarded >= 0),
  xp_awarded INTEGER DEFAULT 0 NOT NULL CHECK (xp_awarded >= 0),
  claimed_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT uq_user_reward_claim UNIQUE (user_id, reward_type, claim_key)
);

-- ────────────────────────────────────────────────────────────────────────────
-- 7. DYNAMIC LEADERBOARD VIEWS
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW leaderboard_global_view AS
SELECT 
  id AS user_id,
  username,
  display_name,
  avatar_url,
  level,
  xp,
  total_spots,
  rarest_find,
  city,
  country,
  DENSE_RANK() OVER (ORDER BY xp DESC, total_spots DESC, created_at ASC) AS rank_global
FROM profiles;

-- ────────────────────────────────────────────────────────────────────────────
-- 8. ROW LEVEL SECURITY (RLS) POLICIES
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE garage ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE scan_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE economy_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE reward_claims ENABLE ROW LEVEL SECURITY;

-- 8.1 Profiles RLS
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON profiles;
CREATE POLICY "Public profiles are viewable by everyone." 
  ON profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert their own profile." ON profiles;
CREATE POLICY "Users can insert their own profile." 
  ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile." ON profiles;
CREATE POLICY "Users can update own profile." 
  ON profiles FOR UPDATE USING (auth.uid() = id);

-- 8.2 Garage RLS (Public read, client insert/update completely blocked)
DROP POLICY IF EXISTS "Garage is viewable by everyone." ON garage;
CREATE POLICY "Garage is viewable by everyone." 
  ON garage FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert own cars." ON garage;
DROP POLICY IF EXISTS "Users can update own cars." ON garage;
DROP POLICY IF EXISTS "Users can delete own cars." ON garage;

-- 8.3 Posts RLS
DROP POLICY IF EXISTS "Posts are viewable by everyone." ON posts;
CREATE POLICY "Posts are viewable by everyone." 
  ON posts FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can create posts." ON posts;
CREATE POLICY "Users can create posts." 
  ON posts FOR INSERT WITH CHECK (
    auth.uid() = user_id 
    AND likes_count = 0 
    AND comments_count = 0
    AND EXISTS (SELECT 1 FROM garage WHERE id = car_id AND user_id = auth.uid())
  );

-- 8.4 Ledger & Claims RLS (Users can only view their own records)
DROP POLICY IF EXISTS "Users view own scan receipts." ON scan_receipts;
CREATE POLICY "Users view own scan receipts." 
  ON scan_receipts FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users view own economy ledger." ON economy_ledger;
CREATE POLICY "Users view own economy ledger." 
  ON economy_ledger FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users view own reward claims." ON reward_claims;
CREATE POLICY "Users view own reward claims." 
  ON reward_claims FOR SELECT USING (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────────────────────
-- 9. SECURITY TRIGGERS: PREVENT CLIENT MANIPULATION OF SENSITIVE STATS
-- ────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION protect_profile_stats_trigger()
RETURNS TRIGGER AS $$
BEGIN
  -- If invoked directly via PostgREST client update (non-security definer context)
  -- prevent tampering with XP, level, coins, total_spots, and rarest_find
  IF current_setting('apex.internal_authorized_call', true) IS DISTINCT FROM 'true' THEN
    IF NEW.xp IS DISTINCT FROM OLD.xp THEN
      RAISE EXCEPTION 'Unauthorized column modification: xp cannot be updated directly by client.';
    END IF;
    IF NEW.level IS DISTINCT FROM OLD.level THEN
      RAISE EXCEPTION 'Unauthorized column modification: level cannot be updated directly by client.';
    END IF;
    IF NEW.coins IS DISTINCT FROM OLD.coins THEN
      RAISE EXCEPTION 'Unauthorized column modification: coins cannot be updated directly by client.';
    END IF;
    IF NEW.total_spots IS DISTINCT FROM OLD.total_spots THEN
      RAISE EXCEPTION 'Unauthorized column modification: total_spots cannot be updated directly by client.';
    END IF;
    IF NEW.rarest_find IS DISTINCT FROM OLD.rarest_find THEN
      RAISE EXCEPTION 'Unauthorized column modification: rarest_find cannot be updated directly by client.';
    END IF;
  END IF;

  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_profile_stats ON profiles;
CREATE TRIGGER trg_protect_profile_stats
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION protect_profile_stats_trigger();

-- Trigger on auth.users to automatically provision profile record on registration
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    username,
    display_name,
    avatar_url,
    level,
    xp,
    coins,
    total_spots,
    rarest_find
  ) VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', 'hunter_' || substring(NEW.id::text, 1, 6)),
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', 'Apex Spotter'),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop'),
    1,
    0,
    50,
    0,
    'None'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ────────────────────────────────────────────────────────────────────────────
-- 10. AUTHORITATIVE SERVER FUNCTIONS & RPCs
-- ────────────────────────────────────────────────────────────────────────────

-- Calculate Level from XP
CREATE OR REPLACE FUNCTION calculate_level_from_xp(p_xp INTEGER)
RETURNS INTEGER AS $$
DECLARE
  v_level INTEGER := 1;
  v_target_xp INTEGER;
BEGIN
  FOR lvl IN 2..100 LOOP
    v_target_xp := round((200 * power(lvl, 1.8)) / 50) * 50;
    IF p_xp >= v_target_xp THEN
      v_level := lvl;
    ELSE
      EXIT;
    END IF;
  END LOOP;
  RETURN v_level;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Calculate XP based on server-verified rarity
CREATE OR REPLACE FUNCTION calculate_scan_xp(p_rarity TEXT)
RETURNS INTEGER AS $$
BEGIN
  CASE lower(p_rarity)
    WHEN 'mythic' THEN RETURN 1500;
    WHEN 'legendary' THEN RETURN 750;
    WHEN 'epic' THEN RETURN 400;
    WHEN 'rare' THEN RETURN 200;
    WHEN 'uncommon' THEN RETURN 100;
    ELSE RETURN 50; -- common
  END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Derive Server-Side Authoritative Rarity
CREATE OR REPLACE FUNCTION derive_authoritative_rarity(
  p_make TEXT,
  p_model TEXT,
  p_city TEXT,
  p_country TEXT
) RETURNS TEXT AS $$
DECLARE
  v_make TEXT := upper(trim(p_make));
  v_model TEXT := upper(trim(p_model));
BEGIN
  -- Hypercar overrides (Mythic)
  IF v_make IN ('BUGATTI', 'KOENIGSEGG', 'PAGANI', 'RIMAC') 
     OR (v_make = 'FERRARI' AND v_model IN ('LAFERRARI', 'ENZO', 'F40', 'F50', 'DAYTONA SP3'))
     OR (v_make = 'MCLAREN' AND v_model IN ('P1', 'SENNA', 'SPEEDTAIL', 'ELVA'))
     OR (v_make = 'PORSCHE' AND v_model IN ('918 SPYDER', 'CARRERA GT')) THEN
    RETURN 'mythic';
  END IF;

  -- Elite Supercar overrides (Legendary)
  IF v_make IN ('LAMBORGHINI', 'FERRARI', 'ASTON MARTIN', 'ROLLS-ROYCE', 'BENTLEY')
     OR (v_make = 'PORSCHE' AND (v_model LIKE '%GT3%' OR v_model LIKE '%GT2%' OR v_model LIKE '%TURBO S%'))
     OR (v_make = 'MCLAREN')
     OR (v_make = 'FORD' AND v_model LIKE '%GT%') THEN
    RETURN 'legendary';
  END IF;

  -- High-End Sports Car (Epic)
  IF (v_make = 'PORSCHE')
     OR (v_make = 'AUDI' AND v_model LIKE '%R8%')
     OR (v_make = 'MERCEDES-BENZ' AND (v_model LIKE '%AMG GT%' OR v_model LIKE '%G 63%'))
     OR (v_make = 'CHEVROLET' AND v_model LIKE '%CORVETTE Z06%')
     OR (v_make = 'NISSAN' AND v_model LIKE '%GT-R%') THEN
    RETURN 'epic';
  END IF;

  -- Premium Performance (Rare)
  IF (v_make = 'BMW' AND (v_model LIKE 'M%' OR v_model LIKE '%M3%' OR v_model LIKE '%M4%' OR v_model LIKE '%M5%'))
     OR (v_make = 'AUDI' AND (v_model LIKE 'RS%' OR v_model LIKE '%RS6%'))
     OR (v_make = 'MERCEDES-BENZ' AND v_model LIKE '%AMG%')
     OR (v_make = 'TOYOTA' AND v_model LIKE '%SUPRA%')
     OR (v_make = 'ALFA ROMEO' AND v_model LIKE '%QUADRIFOGLIO%') THEN
    RETURN 'rare';
  END IF;

  -- Popular Sports / Premium (Uncommon)
  IF (v_make IN ('LEXUS', 'GENESIS', 'VOLVO', 'LAND ROVER', 'JAGUAR', 'MASERATI'))
     OR (v_make = 'FORD' AND v_model LIKE '%MUSTANG%')
     OR (v_make = 'CHEVROLET' AND v_model LIKE '%CAMARO%')
     OR (v_make = 'DODGE' AND (v_model LIKE '%CHALLENGER%' OR v_model LIKE '%CHARGER%'))
     OR (v_make = 'SUBARU' AND v_model LIKE '%WRX%') THEN
    RETURN 'uncommon';
  END IF;

  -- Default baseline
  RETURN 'common';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ────────────────────────────────────────────────────────────────────────────
-- 11. CORE RPC: RECORD_CAR_SCAN (Atomic Server-Verified Scan Processing)
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION record_car_scan(
  p_make TEXT,
  p_model TEXT,
  p_year_estimate TEXT,
  p_color TEXT,
  p_image_url TEXT,
  p_city TEXT DEFAULT 'Local Area',
  p_country TEXT DEFAULT 'Global',
  p_latitude DOUBLE PRECISION DEFAULT NULL,
  p_longitude DOUBLE PRECISION DEFAULT NULL,
  p_horsepower INTEGER DEFAULT 0,
  p_top_speed_kmh INTEGER DEFAULT 0,
  p_caption TEXT DEFAULT NULL,
  p_image_hash TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
  v_authoritative_rarity TEXT;
  v_xp_earned INTEGER;
  v_old_xp INTEGER;
  v_new_xp INTEGER;
  v_new_level INTEGER;
  v_card_id UUID;
  v_card_number TEXT;
  v_last_scan_time TIMESTAMP WITH TIME ZONE;
  v_daily_scans INTEGER;
  v_daily_reset TIMESTAMP WITH TIME ZONE;
  v_duplicate_count INTEGER;
  v_user_row profiles%ROWTYPE;
BEGIN
  -- 1. Verify User Authentication
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required: User must be signed in to record a scan.';
  END IF;

  -- 2. Lock User Row for Concurrency Protection (Prevents Race Conditions)
  SELECT * INTO v_user_row 
  FROM profiles 
  WHERE id = v_user_id 
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User profile not found.';
  END IF;

  -- 3. Anti-Spam & Rate Limiting (Minimum 3 seconds between consecutive scans)
  v_last_scan_time := v_user_row.last_scan_at;
  IF v_last_scan_time IS NOT NULL AND (timezone('utc'::text, now()) - v_last_scan_time) < interval '3 seconds' THEN
    RAISE EXCEPTION 'Rate limit exceeded: Please wait before scanning another vehicle.';
  END IF;

  -- 4. Daily Scan Quota Enforcement (Max 50 scans per day per account)
  v_daily_scans := v_user_row.daily_scans_count;
  v_daily_reset := v_user_row.daily_scans_reset_at;

  IF v_daily_reset IS NULL OR (timezone('utc'::text, now()) - v_daily_reset) >= interval '24 hours' THEN
    v_daily_scans := 0;
    v_daily_reset := timezone('utc'::text, now());
  END IF;

  IF v_daily_scans >= 50 THEN
    RAISE EXCEPTION 'Daily scan limit reached: Free accounts can scan a maximum of 50 vehicles per 24 hours.';
  END IF;

  -- 5. Duplicate Image / Replay Detection
  IF p_image_hash IS NOT NULL AND length(p_image_hash) > 8 THEN
    SELECT count(*) INTO v_duplicate_count 
    FROM scan_receipts 
    WHERE user_id = v_user_id AND image_hash = p_image_hash;

    IF v_duplicate_count > 0 THEN
      RAISE EXCEPTION 'Duplicate scan detected: You have already scanned and claimed this image.';
    END IF;
  END IF;

  -- 6. Server-Side Authoritative Rarity & XP Derivation
  v_authoritative_rarity := derive_authoritative_rarity(p_make, p_model, p_city, p_country);
  v_xp_earned := calculate_scan_xp(v_authoritative_rarity);
  v_card_id := uuid_generate_v4();
  v_card_number := 'APX-' || upper(substring(v_card_id::text, 1, 4)) || '-' || lpad((floor(random() * 9000 + 1000))::text, 4, '0');

  -- 7. Insert Collectible Car into Garage
  INSERT INTO garage (
    id,
    user_id,
    make,
    model,
    year_estimate,
    color,
    rarity,
    image_url,
    image_hash,
    city,
    country,
    latitude,
    longitude,
    horsepower,
    top_speed_kmh,
    xp_earned,
    is_minted,
    card_number,
    scanned_at
  ) VALUES (
    v_card_id,
    v_user_id,
    trim(p_make),
    trim(p_model),
    COALESCE(p_year_estimate, 'Unknown'),
    COALESCE(p_color, 'Unknown'),
    v_authoritative_rarity,
    p_image_url,
    p_image_hash,
    COALESCE(p_city, 'Local Area'),
    COALESCE(p_country, 'Global'),
    p_latitude,
    p_longitude,
    LEAST(2500, GREATEST(0, COALESCE(p_horsepower, 0))),
    LEAST(600, GREATEST(0, COALESCE(p_top_speed_kmh, 0))),
    v_xp_earned,
    false,
    v_card_number,
    timezone('utc'::text, now())
  );

  -- 8. Atomically Update User Profile Stats in Security Context
  PERFORM set_config('apex.internal_authorized_call', 'true', true);

  v_old_xp := v_user_row.xp;
  v_new_xp := COALESCE(v_old_xp, 0) + v_xp_earned;
  v_new_level := calculate_level_from_xp(v_new_xp);

  UPDATE profiles SET
    xp = v_new_xp,
    level = v_new_level,
    total_spots = total_spots + 1,
    daily_scans_count = v_daily_scans + 1,
    daily_scans_reset_at = v_daily_reset,
    last_scan_at = timezone('utc'::text, now()),
    rarest_find = CASE 
      WHEN v_authoritative_rarity = 'mythic' THEN 'mythic'
      WHEN v_authoritative_rarity = 'legendary' AND rarest_find NOT IN ('mythic') THEN 'legendary'
      WHEN v_authoritative_rarity = 'epic' AND rarest_find NOT IN ('mythic', 'legendary') THEN 'epic'
      WHEN v_authoritative_rarity = 'rare' AND rarest_find NOT IN ('mythic', 'legendary', 'epic') THEN 'rare'
      ELSE rarest_find
    END
  WHERE id = v_user_id;

  -- 9. Record Immutable Double-Entry Ledger Entry
  INSERT INTO economy_ledger (
    user_id,
    currency_type,
    amount,
    reason,
    reference_id,
    balance_after
  ) VALUES (
    v_user_id,
    'xp',
    v_xp_earned,
    'car_scan',
    v_card_id,
    v_new_xp
  );

  PERFORM set_config('apex.internal_authorized_call', 'false', true);

  -- 10. Audit Log in scan_receipts
  IF p_image_hash IS NOT NULL THEN
    INSERT INTO scan_receipts (
      user_id,
      image_hash,
      make,
      model,
      rarity,
      xp_awarded
    ) VALUES (
      v_user_id,
      p_image_hash,
      p_make,
      p_model,
      v_authoritative_rarity,
      v_xp_earned
    );
  END IF;

  -- 11. Create Post if caption was provided
  IF p_caption IS NOT NULL AND length(trim(p_caption)) > 0 THEN
    INSERT INTO posts (
      user_id,
      car_id,
      caption,
      likes_count,
      comments_count
    ) VALUES (
      v_user_id,
      v_card_id,
      trim(p_caption),
      0,
      0
    );
  END IF;

  -- 12. Return Unified JSON Response
  RETURN jsonb_build_object(
    'success', true,
    'card_id', v_card_id,
    'card_number', v_card_number,
    'make', p_make,
    'model', p_model,
    'rarity', v_authoritative_rarity,
    'xp_earned', v_xp_earned,
    'new_total_xp', v_new_xp,
    'new_level', v_new_level
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ────────────────────────────────────────────────────────────────────────────
-- 12. RPC: CLAIM_REWARD (Atomic Idempotent Reward Disbursement)
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION claim_reward(
  p_reward_type TEXT,
  p_claim_key TEXT,
  p_coins INTEGER DEFAULT 0,
  p_xp INTEGER DEFAULT 0
) RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
  v_new_coins INTEGER;
  v_new_xp INTEGER;
  v_claim_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  -- 1. Insert Idempotency Claim Record (Fails if already claimed)
  BEGIN
    INSERT INTO reward_claims (
      user_id,
      reward_type,
      claim_key,
      coins_awarded,
      xp_awarded
    ) VALUES (
      v_user_id,
      p_reward_type,
      p_claim_key,
      p_coins,
      p_xp
    ) RETURNING id INTO v_claim_id;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'Reward already claimed: This milestone or quest reward has already been redeemed.';
  END;

  -- 2. Atomically Credit Coins and XP to Profile
  PERFORM set_config('apex.internal_authorized_call', 'true', true);

  UPDATE profiles SET
    coins = coins + p_coins,
    xp = xp + p_xp,
    level = calculate_level_from_xp(xp + p_xp)
  WHERE id = v_user_id
  RETURNING coins, xp INTO v_new_coins, v_new_xp;

  -- 3. Record in Ledger
  IF p_coins > 0 THEN
    INSERT INTO economy_ledger (user_id, currency_type, amount, reason, reference_id, balance_after)
    VALUES (v_user_id, 'coins', p_coins, p_reward_type, v_claim_id, v_new_coins);
  END IF;

  IF p_xp > 0 THEN
    INSERT INTO economy_ledger (user_id, currency_type, amount, reason, reference_id, balance_after)
    VALUES (v_user_id, 'xp', p_xp, p_reward_type, v_claim_id, v_new_xp);
  END IF;

  PERFORM set_config('apex.internal_authorized_call', 'false', true);

  RETURN jsonb_build_object(
    'success', true,
    'coins_awarded', p_coins,
    'xp_awarded', p_xp,
    'new_coins', v_new_coins,
    'new_xp', v_new_xp
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
