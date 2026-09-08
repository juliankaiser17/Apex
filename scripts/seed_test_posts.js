import { createClient } from '@supabase/supabase-js';
import path from 'path';

// Load env using built-in node loader
process.loadEnvFile(path.resolve(process.cwd(), '.env'));

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing Supabase credentials in .env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const DUMMY_CARS = [
  {
    make: 'Porsche',
    model: '911 GT3 RS',
    year_estimate: '2023',
    color: 'Guards Red',
    rarity: 'mythic',
    image_url: 'https://images.unsplash.com/photo-1503376713919-4809bb453303?q=80&w=1200',
    city: 'Los Angeles',
    country: 'USA',
    latitude: 34.0522,
    longitude: -118.2437,
    horsepower: 518,
    top_speed_kmh: 296,
    xp_earned: 1200,
    is_minted: false,
    card_number: '#APX-8821'
  },
  {
    make: 'Lamborghini',
    model: 'Huracán STO',
    year_estimate: '2022',
    color: 'Verde Mantis',
    rarity: 'legendary',
    image_url: 'https://images.unsplash.com/photo-1629897148530-5eb867451a44?q=80&w=1200',
    city: 'Miami',
    country: 'USA',
    latitude: 25.7617,
    longitude: -80.1918,
    horsepower: 631,
    top_speed_kmh: 310,
    xp_earned: 850,
    is_minted: false,
    card_number: '#APX-9142'
  }
];

async function seed() {
  console.log("Starting seed script...");
  
  // 1. Fetch real profiles from the database since we can't create them due to RLS 
  // (Profiles must be created by the actual authenticated user id from auth.users)
  const { data: profiles, error: pError } = await supabase.from('profiles').select('*').limit(2);
  
  if (pError) {
    console.error("Error fetching profiles:", pError);
    return;
  }
  
  if (!profiles || profiles.length === 0) {
    console.error("No profiles exist in the database! Please login into the app first to create your profile.");
    return;
  }
  
  console.log(`Found ${profiles.length} profiles to use for mock posting...`);
  
  // Use the first profile for post 1, and the second (or first again) for post 2
  const profile1 = profiles[0];
  const profile2 = profiles.length > 1 ? profiles[1] : profiles[0];
  
  // 2. We can't insert into garage or posts if RLS checks `auth.uid() = user_id` because we are using anon key.
  // Wait, if RLS is on, the anon key CANNOT insert into garage or posts on behalf of another user!
  // Let me check if I can insert into `garage` with anon key...
  
  const { data: car1, error: c1Err } = await supabase.from('garage').insert({
    ...DUMMY_CARS[0],
    user_id: profile1.id
  }).select().single();
  
  if (c1Err) {
    console.error("Failed to insert car 1 (RLS is likely blocking anon inserts):", c1Err.message);
    console.log("Since RLS blocks the anon key from seeding data for other users, you need to test by actually logging in on multiple devices (or using multiple Google accounts) and scanning cars to create real posts!");
    return;
  }
  
  const { data: car2, error: c2Err } = await supabase.from('garage').insert({
    ...DUMMY_CARS[1],
    user_id: profile2.id
  }).select().single();
  
  if (c1Err || c2Err) {
     console.error("Error inserting cars.");
     return;
  }
  
  // 3. Insert Posts
  const { error: post1Err } = await supabase.from('posts').insert({
    user_id: profile1.id,
    car_id: car1.id,
    caption: 'Check out this beauty in LA!',
    likes_count: 42,
    comments_count: 5
  });
  
  const { error: post2Err } = await supabase.from('posts').insert({
    user_id: profile2.id,
    car_id: car2.id,
    caption: 'Miami spotting hits different 🔥',
    likes_count: 128,
    comments_count: 12
  });
  
  if (post1Err || post2Err) {
    console.error("Error inserting posts.", post1Err, post2Err);
  } else {
    console.log("SUCCESSFULLY seeded fake posts into Supabase!");
  }
}

seed();
