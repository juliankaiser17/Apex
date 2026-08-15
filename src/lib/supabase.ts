import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Missing Supabase credentials in .env file! Database syncing will fail.');
}

export const supabase = createClient(
  supabaseUrl || 'https://nxrtnexhyieiszgglhbn.supabase.co',
  supabaseAnonKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54cnRuZXhoeWllaXN6Z2dsaGJuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU5MTExNTQsImV4cCI6MjEwMTQ4NzE1NH0.DJDskHmSI8BOTi9icFi8SP7EotGYhjgXQHIXcFJr-Ek'
);
