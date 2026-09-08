import { createClient } from '@supabase/supabase-js';
import path from 'path';

process.loadEnvFile(path.resolve(process.cwd(), '.env'));

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;

const clientA = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false }
});

const clientB = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false }
});

async function main() {
  console.log('Testing User Creation / Authentication on Supabase...');
  const timestamp = Date.now().toString().slice(-6);
  const emailA = `apex.spotter.alpha.${timestamp}@gmail.com`;
  const emailB = `apex.spotter.beta.${timestamp}@gmail.com`;
  const password = 'ApexTestPassword123!@#';

  console.log('Signing up User A:', emailA);
  const { data: dataA, error: errA } = await clientA.auth.signUp({
    email: emailA,
    password: password,
    options: {
      data: {
        username: 'user_a_' + Date.now().toString().slice(-4),
        full_name: 'Test Spotter Alpha'
      }
    }
  });

  if (errA) {
    console.error('Error signing up User A:', errA.message);
  } else {
    console.log('User A created. Session:', dataA.session ? 'YES' : 'NO (Email confirmation might be required)');
    console.log('User A ID:', dataA.user?.id);
  }
}

main().catch(console.error);
