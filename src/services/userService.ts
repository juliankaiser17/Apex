import type { UserProfile, FriendUser, FriendRequest } from '../types/apex';
import { supabase } from '../lib/supabase';
import { capacitorStorage, persistItem } from '../lib/capacitorStorage';

const REGISTERED_USERS_KEY = 'apex_registered_users';
const FRIEND_REQUESTS_KEY = 'apex_friend_requests';
const FRIENDS_KEY_PREFIX = 'apex_user_friends_';

/**
 * Normalizes a username for case-insensitive lookup.
 */
export const normalizeUsername = (username: string): string => {
  return username.trim().toLowerCase().replace(/^@+/, '').replace(/[^a-z0-9_]/g, '');
};

/**
 * Get all registered user profiles stored in local persistence.
 */
export const getRegisteredUsers = (): UserProfile[] => {
  try {
    const raw = capacitorStorage.getItemSync(REGISTERED_USERS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.warn('Error reading registered users:', e);
  }
  return [];
};

/**
 * Saves the list of registered users.
 */
const saveRegisteredUsers = (users: UserProfile[]): void => {
  try {
    persistItem(REGISTERED_USERS_KEY, JSON.stringify(users));
  } catch (e) {
    console.warn('Error saving registered users:', e);
  }
};

/**
 * Register or update a real user profile in the persistent registry.
 */
export const registerOrUpdateUser = async (profile: UserProfile): Promise<void> => {
  if (!profile.username || !profile.id) return;
  const cleanHandle = normalizeUsername(profile.username);
  const users = getRegisteredUsers();
  
  const existingIdx = users.findIndex(u => u.id === profile.id);

  const updatedProfile: UserProfile = {
    ...profile,
    username: cleanHandle
  };

  if (existingIdx >= 0) {
    users[existingIdx] = { ...users[existingIdx], ...updatedProfile };
  } else {
    users.push(updatedProfile);
  }

  saveRegisteredUsers(users);

  // Sync to Supabase if available
  try {
    await supabase.from('profiles').upsert([{
      id: updatedProfile.id,
      username: updatedProfile.username,
      display_name: updatedProfile.displayName || updatedProfile.username,
      avatar_url: updatedProfile.avatarUrl,
      level: updatedProfile.level || 1,
      xp: updatedProfile.xp || 0,
      coins: updatedProfile.coins || 0,
      total_spots: updatedProfile.totalSpots || 0,
      rarest_find: updatedProfile.rarestFind || 'None',
      streak_days: updatedProfile.streakDays || 0,
      last_scan_at: updatedProfile.streakLastAt || new Date().toISOString()
    }], { onConflict: 'id' });
  } catch (err) {
    // Graceful offline fallback
  }
};

/**
 * Check if a username is already taken by another registered user.
 */
export const isUsernameTaken = async (username: string, excludeUserId?: string): Promise<boolean> => {
  const clean = normalizeUsername(username);
  if (!clean) return false;

  // 1. Check local device registry
  const localUsers = getRegisteredUsers();
  const localTaken = localUsers.some(
    u => normalizeUsername(u.username) === clean && (!excludeUserId || u.id !== excludeUserId)
  );
  if (localTaken) return true;

  // 2. Check Supabase profiles database
  try {
    const { data } = await supabase
      .from('profiles')
      .select('id, username')
      .ilike('username', clean);

    if (data && data.length > 0) {
      const remoteTaken = data.some(p => !excludeUserId || p.id !== excludeUserId);
      if (remoteTaken) return true;
    }
  } catch (e) {
    // Supabase unreachable, fallback to local check
  }

  return false;
};

/**
 * Find a registered user by username.
 */
export const findUserByUsername = async (username: string): Promise<UserProfile | null> => {
  const clean = normalizeUsername(username);
  if (!clean) return null;

  // 1. Check local registry
  const localUsers = getRegisteredUsers();
  const foundLocal = localUsers.find(u => normalizeUsername(u.username) === clean);
  if (foundLocal) return foundLocal;

  // 2. Check Supabase
  try {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .ilike('username', clean)
      .maybeSingle();

    if (data) {
      const userProfile: UserProfile = {
        id: data.id,
        username: data.username,
        displayName: data.display_name || data.username,
        email: data.email || '',
        avatarUrl: data.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=400',
        persona: data.persona || 'unspecified',
        level: data.level || 1,
        xp: data.xp || 0,
        coins: data.coins || 0,
        streakDays: data.streak_days || 0,
        streakLastAt: (data.streak_days && data.streak_days > 0) ? (data.streak_last_at || data.last_scan_at) : undefined,
        rankGlobal: 1,
        rankCountry: 1,
        rankCity: 1,
        city: data.city || '',
        country: data.country || '',
        latitude: data.latitude || 0,
        longitude: data.longitude || 0,
        countryCode: 'GLOBAL',
        isPremium: false,
        totalSpots: data.total_spots || 0,
        rarestFind: data.rarest_find || 'common',
        badgesUnlocked: 0,
        citiesExplored: 0,
        allowHunts: true,
        defaultPrivacyLevel: 'public_blurred'
      };
      // Cache locally
      await registerOrUpdateUser(userProfile);
      return userProfile;
    }
  } catch (e) {}

  return null;
};

/**
 * Get all friend requests from storage.
 */
export const getAllFriendRequests = (): FriendRequest[] => {
  try {
    const raw = localStorage.getItem(FRIEND_REQUESTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {}
  return [];
};

/**
 * Save friend requests list.
 */
const saveFriendRequests = (requests: FriendRequest[]): void => {
  try {
    localStorage.setItem(FRIEND_REQUESTS_KEY, JSON.stringify(requests));
  } catch (e) {}
};

/**
 * Get incoming pending friend requests for a specific username.
 */
export const getIncomingRequests = (username: string): FriendRequest[] => {
  const clean = normalizeUsername(username);
  if (!clean) return [];
  return getAllFriendRequests().filter(
    r => normalizeUsername(r.toUsername) === clean && r.status === 'pending'
  );
};

/**
 * Get outgoing pending friend requests sent by a user.
 */
export const getOutgoingRequests = (username: string): FriendRequest[] => {
  const clean = normalizeUsername(username);
  if (!clean) return [];
  return getAllFriendRequests().filter(
    r => normalizeUsername(r.fromUsername) === clean && r.status === 'pending'
  );
};

/**
 * Get friends for a user.
 */
export const getUserFriends = (usernameOrId: string): FriendUser[] => {
  const clean = normalizeUsername(usernameOrId);
  try {
    const specificRaw = localStorage.getItem(`${FRIENDS_KEY_PREFIX}${clean}`);
    if (specificRaw) {
      const parsed = JSON.parse(specificRaw);
      if (Array.isArray(parsed)) return parsed;
    }
    // Fallback to generic friends key for backward compatibility
    const genericRaw = localStorage.getItem('apex_user_friends');
    if (genericRaw) {
      const parsed = JSON.parse(genericRaw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {}
  return [];
};

/**
 * Save friends list for a user.
 */
export const saveUserFriends = (usernameOrId: string, friends: FriendUser[]): void => {
  const clean = normalizeUsername(usernameOrId);
  try {
    localStorage.setItem(`${FRIENDS_KEY_PREFIX}${clean}`, JSON.stringify(friends));
    localStorage.setItem('apex_user_friends', JSON.stringify(friends));
  } catch (e) {}
};

/**
 * Send a friend request to a real registered user.
 */
export const sendFriendRequest = async (
  fromUser: UserProfile,
  targetUsername: string
): Promise<{ success: boolean; message: string; error?: string }> => {
  const cleanFrom = normalizeUsername(fromUser.username);
  const cleanTarget = normalizeUsername(targetUsername);

  if (!cleanTarget) {
    return { success: false, message: 'Please enter a username to add as friend.' };
  }

  if (cleanFrom === cleanTarget) {
    return { success: false, message: 'You cannot send a friend request to yourself.' };
  }

  // Verify target user actually exists in the real user registry
  const targetUser = await findUserByUsername(cleanTarget);
  if (!targetUser) {
    return {
      success: false,
      message: `@${cleanTarget} is not a registered user. You can only send requests to real users.`
    };
  }

  // Check if they are already friends
  const currentFriends = getUserFriends(cleanFrom);
  if (currentFriends.some(f => normalizeUsername(f.username) === cleanTarget)) {
    return {
      success: false,
      message: `You are already friends with @${targetUser.username}.`
    };
  }

  // Check existing friend requests
  const allRequests = getAllFriendRequests();
  
  // Check if current user already sent a pending request
  const alreadySent = allRequests.find(
    r => normalizeUsername(r.fromUsername) === cleanFrom &&
         normalizeUsername(r.toUsername) === cleanTarget &&
         r.status === 'pending'
  );
  if (alreadySent) {
    return {
      success: false,
      message: `A friend request to @${targetUser.username} is already pending.`
    };
  }

  // Check if target user already sent us a request
  const reversePending = allRequests.find(
    r => normalizeUsername(r.fromUsername) === cleanTarget &&
         normalizeUsername(r.toUsername) === cleanFrom &&
         r.status === 'pending'
  );
  if (reversePending) {
    return {
      success: false,
      message: `@${targetUser.username} has already sent you a friend request! Check your incoming requests to accept.`
    };
  }

  // Create new real friend request
  const newRequest: FriendRequest = {
    id: `freq-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    fromUserId: fromUser.id,
    fromUsername: fromUser.username,
    fromDisplayName: fromUser.displayName || fromUser.username,
    fromAvatarUrl: fromUser.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=400',
    fromLevel: fromUser.level || 1,
    toUserId: targetUser.id,
    toUsername: targetUser.username,
    status: 'pending',
    createdAt: new Date().toISOString()
  };

  saveFriendRequests([...allRequests, newRequest]);

  return {
    success: true,
    message: `Friend request sent to @${targetUser.username}! They can now accept or deny it.`
  };
};

/**
 * Accept a friend request.
 */
export const acceptFriendRequest = async (
  requestId: string,
  currentUser: UserProfile
): Promise<{ success: boolean; friend?: FriendUser; error?: string }> => {
  const allRequests = getAllFriendRequests();
  const requestIdx = allRequests.findIndex(r => r.id === requestId);

  if (requestIdx === -1) {
    return { success: false, error: 'Friend request not found.' };
  }

  const req = allRequests[requestIdx];
  const cleanFrom = normalizeUsername(req.fromUsername);
  const cleanCurrent = normalizeUsername(currentUser.username);

  // Update request status
  allRequests.splice(requestIdx, 1);
  saveFriendRequests(allRequests);

  // 1. Add sender to current user's friends
  const senderProfile = await findUserByUsername(cleanFrom);
  const newFriendForCurrent: FriendUser = {
    id: req.fromUserId,
    username: req.fromUsername,
    displayName: req.fromDisplayName,
    avatarUrl: req.fromAvatarUrl,
    level: req.fromLevel,
    city: senderProfile?.city || 'Local Area',
    country: senderProfile?.country || 'Global',
    totalSpots: senderProfile?.totalSpots || 0,
    isFollowing: true,
    friendsSince: new Date().toISOString()
  };

  const currentFriends = getUserFriends(cleanCurrent).filter(
    f => normalizeUsername(f.username) !== cleanFrom
  );
  currentFriends.push(newFriendForCurrent);
  saveUserFriends(cleanCurrent, currentFriends);

  // 2. Add current user to sender's friends (reciprocal friendship)
  const newFriendForSender: FriendUser = {
    id: currentUser.id,
    username: currentUser.username,
    displayName: currentUser.displayName || currentUser.username,
    avatarUrl: currentUser.avatarUrl,
    level: currentUser.level || 1,
    city: currentUser.city || 'Local Area',
    country: currentUser.country || 'Global',
    totalSpots: currentUser.totalSpots || 0,
    isFollowing: true,
    friendsSince: new Date().toISOString()
  };

  const senderFriends = getUserFriends(cleanFrom).filter(
    f => normalizeUsername(f.username) !== cleanCurrent
  );
  senderFriends.push(newFriendForSender);
  saveUserFriends(cleanFrom, senderFriends);

  return { success: true, friend: newFriendForCurrent };
};

/**
 * Deny a friend request.
 */
export const denyFriendRequest = async (requestId: string): Promise<{ success: boolean }> => {
  const allRequests = getAllFriendRequests();
  const filtered = allRequests.filter(r => r.id !== requestId);
  saveFriendRequests(filtered);
  return { success: true };
};

/**
 * Cancel an outgoing friend request.
 */
export const cancelFriendRequest = async (requestId: string): Promise<{ success: boolean }> => {
  const allRequests = getAllFriendRequests();
  const filtered = allRequests.filter(r => r.id !== requestId);
  saveFriendRequests(filtered);
  return { success: true };
};

/**
 * Remove friendship between two users.
 */
export const removeFriendship = (userA: string, userB: string): void => {
  const cleanA = normalizeUsername(userA);
  const cleanB = normalizeUsername(userB);

  // Remove B from A's list
  const friendsA = getUserFriends(cleanA).filter(f => normalizeUsername(f.username) !== cleanB);
  saveUserFriends(cleanA, friendsA);

  // Remove A from B's list
  const friendsB = getUserFriends(cleanB).filter(f => normalizeUsername(f.username) !== cleanA);
  saveUserFriends(cleanB, friendsB);
};
