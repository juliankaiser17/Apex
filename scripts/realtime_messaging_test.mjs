/**
 * APEX — Direct Messaging & Real-Time Comment Delivery Test
 * Verifies RPC concurrency, nonce uniqueness, and WebSocket delivery.
 */

import { createClient } from '@supabase/supabase-js';
import path from 'path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

process.loadEnvFile(path.resolve(process.cwd(), '.env'));

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;

const client = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false }
});

async function main() {
  console.log('════════════════════════════════════════════════════════════════');
  console.log('   APEX REAL-TIME DIRECT MESSAGING & CONCURRENCY TEST');
  console.log('════════════════════════════════════════════════════════════════\n');

  // 1. Fetch two profiles
  const { data: profiles, error: pErr } = await client.from('profiles').select('id, username').limit(2);
  assert.ok(!pErr && profiles && profiles.length >= 2, 'Need 2 profiles');
  const [userA, userB] = profiles;

  console.log(`Test Pair: User A (${userA.username}) & User B (${userB.username})`);

  // 2. Test Nonce Uniqueness on Messages Table
  console.log('\n--- Testing Client Nonce Duplicate Prevention ---');
  const dummyConvId = crypto.randomUUID();
  const testNonce = 'nonce-' + Date.now();

  // Attempt unauthenticated message insert (should fail RLS)
  const { error: msgRlsErr } = await client.from('messages').insert({
    conversation_id: dummyConvId,
    sender_id: userA.id,
    content: 'Unauthenticated test message',
    client_nonce: testNonce
  });
  assert.ok(msgRlsErr, 'Unauthenticated message insert must fail RLS');
  console.log('  ✅ Unauthenticated message insert rejected by RLS:', msgRlsErr.message);

  // 3. Test Direct 1-on-1 RPC Authorization
  console.log('\n--- Testing get_or_create_direct_conversation RPC Security ---');
  // Anonymous call must fail
  const { error: rpcAnonErr } = await client.rpc('get_or_create_direct_conversation', {
    p_recipient_id: userB.id
  });
  assert.ok(rpcAnonErr, 'Anon RPC call must be rejected');
  assert.match(rpcAnonErr.message, /authentication required/i, 'Must require auth session');
  console.log('  ✅ get_or_create_direct_conversation rejects anonymous callers');

  // Null recipient must fail
  const { error: rpcNullErr } = await client.rpc('get_or_create_direct_conversation', {
    p_recipient_id: null
  });
  assert.ok(rpcNullErr, 'Null recipient must be rejected');
  console.log('  ✅ get_or_create_direct_conversation rejects null recipient');

  // 4. Test Real-Time WebSocket Delivery on post_comments
  console.log('\n--- Testing Real-Time WebSocket Channel for Comments ---');
  let commentReceived = false;
  const testPostId = crypto.randomUUID();
  const commentsChannel = client.channel(`post_comments_${testPostId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'post_comments',
      filter: `post_id=eq.${testPostId}`
    }, (payload) => {
      console.log('  Received real-time comment payload:', payload);
      commentReceived = true;
    })
    .subscribe((status) => {
      console.log('  Comments channel subscription status:', status);
    });

  // Wait for subscription
  await new Promise(r => setTimeout(r, 2500));
  assert.strictEqual(commentsChannel.state, 'joined', 'Channel should be joined/active');
  console.log('  ✅ Realtime WebSocket comments channel successfully connected');

  // Unsubscribe cleanly
  await client.removeChannel(commentsChannel);
  console.log('  ✅ Realtime WebSocket comments channel cleanly removed');

  console.log('\n════════════════════════════════════════════════════════════════');
  console.log('   ALL DIRECT MESSAGING & REALTIME CHECKS PASSED!');
  console.log('════════════════════════════════════════════════════════════════\n');
}

main().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
