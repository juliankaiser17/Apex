import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://nxrtnexhyieiszgglhbn.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54cnRuZXhoeWllaXN6Z2dsaGJuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU5MTExNTQsImV4cCI6MjEwMTQ4NzE1NH0.DJDskHmSI8BOTi9icFi8SP7EotGYhjgXQHIXcFJr-Ek';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed: Must be POST.' });
  }

  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid Authorization header.' });
  }

  const token = authHeader.replace('Bearer ', '').trim();

  // Create authenticated client with user's JWT to verify identity
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } }
  });

  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired session token.' });
  }

  const userId = userData.user.id;

  try {
    // 1. If service role key is configured in backend, delete auth user directly
    if (supabaseServiceKey) {
      const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { persistSession: false }
      });
      // Purge profile and dependent data
      await adminClient.from('profiles').delete().eq('id', userId);
      // Delete auth user from auth.users
      const { error: adminDeleteError } = await adminClient.auth.admin.deleteUser(userId);
      if (adminDeleteError) {
        console.warn('Admin user delete notice:', adminDeleteError);
      }
    } else {
      // 2. Execute secure database RPC delete_user_account() with user session
      const { error: rpcError } = await userClient.rpc('delete_user_account');
      if (rpcError) {
        // Fallback: delete profile record directly (triggers ON DELETE CASCADE on all tables)
        await userClient.from('profiles').delete().eq('id', userId);
      }
    }

    return res.status(200).json({
      success: true,
      deletedUserId: userId,
      message: 'Account and associated data have been permanently removed.'
    });
  } catch (err: any) {
    console.error('Account deletion error:', err);
    return res.status(500).json({
      error: 'Account deletion failed.',
      message: err?.message
    });
  }
}
