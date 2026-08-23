import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

/**
 * Real account deletion.
 *
 * The client's deleteAccount() action previously called
 * `supabase.from('profiles').delete().eq('id', ...)` directly — but `profiles`
 * has no DELETE RLS policy, so that call silently deleted zero rows (RLS fails
 * closed by default with no matching policy). Even with a DELETE policy added,
 * a client using only the public anon key can never remove the underlying
 * auth.users record — that requires the service_role key, which must never be
 * shipped to a client. This endpoint holds that key server-side only and
 * performs the actual deletion after verifying the caller's own session token,
 * so a user can only ever delete their own account.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed: Must be POST.' });
  }

  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: A valid session token is required.' });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    return res.status(503).json({ error: 'Account deletion is not configured on this server environment.' });
  }

  // 1. Verify the caller is who they claim to be, using the low-privilege anon client.
  const anonClient = createClient(supabaseUrl, supabaseAnonKey);
  const { data: { user }, error: authError } = await anonClient.auth.getUser(token);

  if (authError || !user) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired session token.' });
  }

  // 2. Only now use the service-role client — scoped to exactly this verified user's id,
  // never to an id supplied by the request body/params.
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  try {
    // Row deletes first (garage/posts cascade from profiles via ON DELETE CASCADE, but
    // being explicit here is cheap and doesn't depend on that cascade being correct).
    await adminClient.from('garage').delete().eq('user_id', user.id);
    await adminClient.from('posts').delete().eq('user_id', user.id);
    await adminClient.from('profiles').delete().eq('id', user.id);

    const { error: deleteUserError } = await adminClient.auth.admin.deleteUser(user.id);
    if (deleteUserError) {
      console.error('Account deletion (auth.users) error:', deleteUserError);
      return res.status(500).json({ error: 'Failed to fully delete account. Please contact support.' });
    }

    return res.status(200).json({ success: true });
  } catch (err: any) {
    console.error('Account deletion error:', err);
    return res.status(500).json({ error: 'Failed to delete account. Please try again or contact support.' });
  }
}
