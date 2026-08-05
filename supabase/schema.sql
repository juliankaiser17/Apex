-- APEX SUPABASE SCHEMA

-- 1. Profiles Table (extends Supabase Auth Users)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  level INTEGER DEFAULT 1,
  xp INTEGER DEFAULT 0,
  coins INTEGER DEFAULT 0,
  streak_days INTEGER DEFAULT 0,
  last_scan_at TIMESTAMP WITH TIME ZONE,
  total_spots INTEGER DEFAULT 0,
  rarest_find TEXT DEFAULT 'None',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Garage (Scanned Cars)
CREATE TABLE garage (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) NOT NULL,
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  year_estimate TEXT NOT NULL,
  color TEXT NOT NULL,
  rarity TEXT NOT NULL,
  image_url TEXT NOT NULL,
  city TEXT NOT NULL,
  country TEXT NOT NULL,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  horsepower INTEGER,
  top_speed_kmh INTEGER,
  xp_earned INTEGER DEFAULT 0,
  is_minted BOOLEAN DEFAULT false,
  card_number TEXT,
  scanned_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Social Feed Posts
CREATE TABLE posts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) NOT NULL,
  car_id UUID REFERENCES garage(id) NOT NULL,
  caption TEXT,
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Turn on Row Level Security (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE garage ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

-- Profiles: Anyone can read profiles, but users can only update their own
CREATE POLICY "Public profiles are viewable by everyone." ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile." ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile." ON profiles FOR UPDATE USING (auth.uid() = id);

-- Garage: Public can view cars, but only owners can insert/update
CREATE POLICY "Garage is viewable by everyone." ON garage FOR SELECT USING (true);
CREATE POLICY "Users can insert own cars." ON garage FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own cars." ON garage FOR UPDATE USING (auth.uid() = user_id);

-- Posts: Public can view, only owners can insert
CREATE POLICY "Posts are viewable by everyone." ON posts FOR SELECT USING (true);
CREATE POLICY "Users can create posts." ON posts FOR INSERT WITH CHECK (auth.uid() = user_id);
