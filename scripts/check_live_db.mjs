import { createClient } from '@supabase/supabase-js';
import path from 'path';

process.loadEnvFile(path.resolve(process.cwd(), '.env'));

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;

console.log('Connecting to Supabase at:', SUPABASE_URL);

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
  const tables = [
    'profiles',
    'garage',
    'posts',
    'post_comments',
    'follows',
    'friend_requests',
    'conversations',
    'conversation_members',
    'messages',
    'user_blocks',
    'reports'
  ];

  console.log('\n--- Checking Tables on Remote Supabase ---');
  for (const t of tables) {
    const { data, error } = await supabase.from(t).select('*').limit(1);
    if (error) {
      console.log(`❌ Table [${t}]: ERROR ${error.code} - ${error.message}`);
    } else {
      console.log(`✅ Table [${t}]: OK (${data ? data.length : 0} rows sample)`);
    }
  }

  console.log('\n--- Checking Posts Columns ---');
  const { data: posts, error: pErr } = await supabase.from('posts').select('id, user_id, car_id, media_type, media_url, thumbnail_url').limit(1);
  if (pErr) {
    console.log(`❌ Posts columns: ERROR ${pErr.message}`);
  } else {
    console.log(`✅ Posts columns exist:`, posts);
  }

  console.log('\n--- Checking RPC get_or_create_direct_conversation ---');
  const { data: rpcData, error: rpcErr } = await supabase.rpc('get_or_create_direct_conversation', {
    p_recipient_id: '00000000-0000-0000-0000-000000000000'
  });
  if (rpcErr) {
    console.log(`ℹ️ RPC response: ${rpcErr.message} (code: ${rpcErr.code})`);
  } else {
    console.log(`RPC returned:`, rpcData);
  }
}

run().catch(console.error);
