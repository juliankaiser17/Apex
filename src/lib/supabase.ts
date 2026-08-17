import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder-project.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-anon-key';

if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
  console.info('APEX: Running in Standalone/Offline mode. To connect live cloud sync, add credentials to .env');
}

// Determine the correct redirect origin for OAuth flows
const isLocalhost = typeof window !== 'undefined' && window.location.hostname === 'localhost';
export const OAUTH_REDIRECT_URL = isLocalhost
  ? window.location.origin
  : 'https://apex-spotter.vercel.app';

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
    },
  }
);
