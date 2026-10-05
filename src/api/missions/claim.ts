import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://nxrtnexhyieiszgglhbn.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54cnRuZXhoeWllaXN6Z2dsaGJuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU5MTExNTQsImV4cCI6MjEwMTQ4NzE1NH0.DJDskHmSI8BOTi9icFi8SP7EotGYhjgXQHIXcFJr-Ek';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

interface MissionRule {
  title: string;
  xpReward: number;
  coinReward: number;
}

const MISSION_RULES: Record<string, MissionRule> = {
  m1: { title: 'Scan 1 car today', xpReward: 50, coinReward: 10 },
  m2: { title: 'Identify 1 Rare or higher', xpReward: 100, coinReward: 20 },
  m3: { title: 'Daily Login Bonus', xpReward: 25, coinReward: 5 },
  m4: { title: 'Spot an SUV or Coupe', xpReward: 75, coinReward: 15 },
  m5: { title: "Scan a car you've never seen", xpReward: 200, coinReward: 50 },
  m6: { title: 'Spot a car with 400+ HP', xpReward: 120, coinReward: 25 },
  m7: { title: 'Spot an Aero or Tuned car', xpReward: 100, coinReward: 20 },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed: Must be POST.' });
  }

  const { missionId } = req.body || {};
  if (!missionId || typeof missionId !== 'string' || !MISSION_RULES[missionId]) {
    return res.status(400).json({ error: 'Invalid or unknown missionId.' });
  }

  const rule = MISSION_RULES[missionId];

  // 1. Verify User Authentication Session
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required to claim mission rewards.' });
  }

  const token = authHeader.replace('Bearer ', '').trim();
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } }
  });

  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired session token.' });
  }

  const userId = userData.user.id;

  // Use admin client if service role key available, otherwise user client
  const dbClient = supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } })
    : userClient;

  try {
    // 2. Check Idempotency via reward_claims
    const today = new Date().toISOString().slice(0, 10);
    const claimKey = `mission_${today}_${missionId}`;

    const { data: existingClaims } = await dbClient
      .from('reward_claims')
      .select('id')
      .eq('user_id', userId)
      .eq('claim_key', claimKey);

    if (existingClaims && existingClaims.length > 0) {
      return res.status(409).json({
        error: 'Reward already claimed: This daily mission reward has already been redeemed today.',
        claimKey
      });
    }

    // 3. Server-Authoritative Independent Database State Verification
    let satisfied = false;
    let reason = '';
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);

    switch (missionId) {
      case 'm1': { // Scan 1 car today

        const { count: garageCount } = await dbClient
          .from('garage')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .gte('scanned_at', startOfDay.toISOString());

        if ((garageCount || 0) >= 1) {
          satisfied = true;
        } else {
          // Check profile last_scan_at as fallback
          const { data: prof } = await dbClient
            .from('profiles')
            .select('last_scan_at')
            .eq('id', userId)
            .single();

          if (prof?.last_scan_at && new Date(prof.last_scan_at) >= startOfDay) {
            satisfied = true;
          } else {
            reason = 'You have not scanned a car today.';
          }
        }
        break;
      }

      case 'm2': { // Identify 1 Rare or higher
        const { count } = await dbClient
          .from('garage')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .in('rarity', ['rare', 'epic', 'legendary', 'mythic']);

        if ((count || 0) >= 1) {
          satisfied = true;
        } else {
          const { data: prof } = await dbClient
            .from('profiles')
            .select('rarest_find')
            .eq('id', userId)
            .single();

          if (prof?.rarest_find && ['rare', 'epic', 'legendary', 'mythic'].includes(prof.rarest_find)) {
            satisfied = true;
          } else {
            reason = 'No vehicle of Rare or higher rarity found in your Garage.';
          }
        }
        break;
      }

      case 'm3': { // Daily Login Bonus
        const { data: prof } = await dbClient
          .from('profiles')
          .select('last_login_at, last_scan_at, streak_days')
          .eq('id', userId)
          .single();

        const todayActive = (prof?.last_login_at && new Date(prof.last_login_at) >= startOfDay) ||
                            (prof?.last_scan_at && new Date(prof.last_scan_at) >= startOfDay);
        if (todayActive || (prof?.streak_days && prof.streak_days >= 1)) {
          satisfied = true;
        } else {
          reason = 'Must have an active daily login today.';
        }
        break;
      }

      case 'm4': { // Spot an SUV or Coupe
        const { data: userCars } = await dbClient
          .from('garage')
          .select('make, model, body_style')
          .eq('user_id', userId);

        if (userCars && userCars.length > 0) {
          const coupeSuvRegex = /(suv|coupe|crossover|urus|cullinan|cayenne|macan|x5|x6|g63|gls|gle|q7|q8|dbx|purosangue|911|m4|m2|amg gt|huracan|458|488|f8|corvette|mustang|camaro|supra|gt-r|daytona)/i;
          satisfied = userCars.some(c => 
            (c.body_style && ['SUV', 'Coupe'].includes(c.body_style)) ||
            coupeSuvRegex.test(c.model || '')
          );
        }
        if (!satisfied) {
          reason = 'No qualifying SUV or Coupe spotted yet.';
        }
        break;
      }

      case 'm5': { // Scan a car you've never seen (>= 2 distinct models)
        const { data: userCars } = await dbClient
          .from('garage')
          .select('make, model')
          .eq('user_id', userId);

        const distinctModels = new Set(
          (userCars || []).map(c => `${c.make?.toLowerCase().trim()}_${c.model?.toLowerCase().trim()}`)
        );

        if (distinctModels.size >= 2) {
          satisfied = true;
        } else {
          const { data: prof } = await dbClient
            .from('profiles')
            .select('total_spots')
            .eq('id', userId)
            .single();

          if ((prof?.total_spots || 0) >= 2) {
            satisfied = true;
          } else {
            reason = 'Requires discovering at least 2 distinct vehicles.';
          }
        }
        break;
      }

      case 'm6': { // Spot a car with 400+ HP
        const { count } = await dbClient
          .from('garage')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .gte('horsepower', 400);

        if ((count || 0) >= 1) {
          satisfied = true;
        } else {
          reason = 'No vehicle pushing 400+ horsepower found in your Garage.';
        }
        break;
      }

      case 'm7': { // Spot an Aero or Tuned car (500+ HP or Epic/Legendary/Mythic)
        const { count } = await dbClient
          .from('garage')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .in('rarity', ['epic', 'legendary', 'mythic']);

        if ((count || 0) >= 1) {
          satisfied = true;
        } else {
          reason = 'No Aero, Tuned, or high-tier exotic vehicle found in your Garage.';
        }
        break;
      }
    }

    if (!satisfied) {
      return res.status(400).json({
        error: `Server validation rejected: ${reason}`,
        missionId,
        satisfied: false
      });
    }

    // 4. Server-Authoritative Reward Disbursement
    // Fetch current user stats
    const { data: userProfile, error: profileErr } = await dbClient
      .from('profiles')
      .select('xp, level, coins')
      .eq('id', userId)
      .single();

    if (profileErr || !userProfile) {
      return res.status(500).json({ error: 'Failed to retrieve profile record.' });
    }

    const currentXp = userProfile.xp || 0;
    const currentCoins = userProfile.coins || 0;
    const newXp = currentXp + rule.xpReward;
    const newCoins = currentCoins + rule.coinReward;
    const newLevel = Math.max(1, Math.floor(Math.sqrt(newXp / 100)) + 1);

    // Update profile
    await dbClient
      .from('profiles')
      .update({
        xp: newXp,
        coins: newCoins,
        level: newLevel
      })
      .eq('id', userId);

    // Record idempotency claim in reward_claims
    await dbClient
      .from('reward_claims')
      .insert([{
        user_id: userId,
        reward_type: 'daily_mission',
        claim_key: claimKey,
        coins_awarded: rule.coinReward,
        xp_awarded: rule.xpReward
      }]);

    // Record in economy_ledger if available
    try {
      await dbClient
        .from('economy_ledger')
        .insert([{
          user_id: userId,
          currency_type: 'xp',
          amount: rule.xpReward,
          reason: `daily_mission_${missionId}`,
          balance_after: newXp
        }]);
    } catch (_) {}

    return res.status(200).json({
      success: true,
      missionId,
      xpAwarded: rule.xpReward,
      coinsAwarded: rule.coinReward,
      newXp,
      newCoins,
      newLevel,
      claimKey
    });
  } catch (err: any) {
    console.error('[api/missions/claim] Exception:', err);
    return res.status(500).json({ error: err?.message || 'Server error claiming mission reward.' });
  }
}
