import { useApexStore } from '../../store/useApexStore';

declare const process: any;

async function testAccountDeletion() {
  console.log('Testing Account Deletion Flow...');

  // Setup simulated authenticated test state
  const testUserId = 'test-disposable-' + Date.now();
  useApexStore.setState({
    authStatus: 'AUTHENTICATED',
    authUser: { id: testUserId, email: 'disposable@apex-test.app' },
    user: {
      id: testUserId,
      username: 'disposable_user',
      displayName: 'Disposable User',
      level: 5,
      xp: 1200,
      coins: 250,
      streakDays: 4,
      city: 'Berlin',
      country: 'Germany',
      totalSpots: 12,
      rarestFind: 'Porsche 911 GT3 RS',
      allowHunts: true,
      defaultPrivacyLevel: 'public_blurred',
      createdAt: new Date().toISOString()
    } as any,
    garage: [
      {
        id: 'car-test-1',
        make: 'Porsche',
        model: '911 GT3 RS',
        yearEstimate: '2023',
        rarity: 'mythic',
        imageUrl: 'https://example.com/porsche.jpg',
        cardNumber: '001',
        hp: 518,
        topSpeedKmh: 296,
        scannedAt: new Date().toISOString()
      } as any
    ]
  });

  // Verify precondition
  const stateBefore = useApexStore.getState();
  if (stateBefore.authStatus !== 'AUTHENTICATED' || stateBefore.garage.length !== 1) {
    throw new Error('Precondition failed: State not authenticated before deletion');
  }

  // Execute deleteAccount
  await useApexStore.getState().deleteAccount();

  // Verify postcondition
  const stateAfter = useApexStore.getState();
  if (stateAfter.authStatus !== 'GUEST') {
    throw new Error(`Expected authStatus to be GUEST, got ${stateAfter.authStatus}`);
  }
  if (stateAfter.authUser !== null) {
    throw new Error('Expected authUser to be null after deletion');
  }
  if (stateAfter.garage.length !== 0) {
    throw new Error(`Expected garage to be empty after deletion, got ${stateAfter.garage.length}`);
  }
  if (stateAfter.user.id === testUserId) {
    throw new Error('Expected user ID to be reset, got original user ID');
  }

  console.log('PASS: Account Deletion Flow correctly purged local session, cleared garage, and returned to GUEST.');
}

testAccountDeletion().catch(e => {
  console.error('FAIL: Account Deletion Test Failed:', e);
  process.exit(1);
});
