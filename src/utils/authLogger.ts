/**
 * APEX — Development Auth Transition Logger & Observability
 * 
 * Provides structured logging for authentication state machine transitions.
 * Strips all tokens and credentials for safety.
 */

export type AuthEvent = 
  | 'AUTH_INIT_START'
  | 'SESSION_RESOLVED'
  | 'SIGNED_IN'
  | 'PROFILE_LOADING'
  | 'PROFILE_LOADED'
  | 'TOKEN_REFRESHED'
  | 'SIGNED_OUT'
  | 'ACCOUNT_DELETED'
  | 'AUTH_ERROR'
  | 'GUEST_SESSION_STARTED'
  | 'OAUTH_CALLBACK_PENDING'
  | 'CACHED_SESSION_PRESERVED';

declare const process: any;

export function logAuthTransition(
  event: AuthEvent,
  userId?: string | null,
  email?: string | null,
  details?: Record<string, any>
): void {
  const timestamp = new Date().toLocaleTimeString();
  const sanitizedEmail = email ? email.replace(/^(.{2})(.*)(@.*)$/, '$1***$3') : 'none';
  const shortId = userId ? `${userId.substring(0, 8)}...` : 'anonymous';

  console.log(`[APEX AUTH] ${event} @ ${timestamp} | user: ${shortId} | email: ${sanitizedEmail}`);
  if (details) {
    const sanitizedDetails = { ...details };
    // Redact any possible token / secret fields
    delete sanitizedDetails.token;
    delete sanitizedDetails.access_token;
    delete sanitizedDetails.refresh_token;
    delete sanitizedDetails.idToken;
    delete sanitizedDetails.id_token;
    console.log('  Details:', sanitizedDetails);
  }
}
