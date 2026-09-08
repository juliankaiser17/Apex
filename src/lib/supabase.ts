import { createClient } from '@supabase/supabase-js';
import { capacitorStorage } from './capacitorStorage';

declare const process: any;

const supabaseUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) || (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_URL) || 'https://nxrtnexhyieiszgglhbn.supabase.co';
const supabaseAnonKey = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) || (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_ANON_KEY) || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54cnRuZXhoeWllaXN6Z2dsaGJuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU5MTExNTQsImV4cCI6MjEwMTQ4NzE1NH0.DJDskHmSI8BOTi9icFi8SP7EotGYhjgXQHIXcFJr-Ek';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    'APEX FATAL: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set in .env. ' +
    'Authentication and data persistence will not work without valid Supabase credentials.'
  );
}

// Determine the correct redirect origin for OAuth flows
const isLocalhost = typeof window !== 'undefined' && window.location.hostname === 'localhost';
export const OAUTH_REDIRECT_URL = isLocalhost
  ? window.location.origin
  : 'https://apex-spotter.vercel.app';

export const supabase = createClient(
  supabaseUrl || 'https://nxrtnexhyieiszgglhbn.supabase.co',
  supabaseAnonKey || '',
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
      storage: capacitorStorage,
      storageKey: 'sb-nxrtnexhyieiszgglhbn-auth-token',
    },
  }
);

/**
 * Resolves the currently authenticated Supabase identity from the server.
 * Uses supabase.auth.getUser() to verify active identity rather than trusting
 * local session storage.
 */
export async function getAuthoritativeUser() {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return null;
    return user;
  } catch (err) {
    console.warn('Error fetching authoritative user:', err);
    return null;
  }
}
