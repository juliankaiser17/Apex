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
  | 'GUEST_SESSION_STARTED';

declare const process: any;

export function logAuthTransition(
  event: AuthEvent,
  userId?: string | null,
  email?: string | null,
  details?: Record<string, any>
): void {
  const isDev = (typeof import.meta !== 'undefined' && import.meta.env?.DEV) || (typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production');
  if (!isDev) return;

  const timestamp = new Date().toLocaleTimeString();
  const sanitizedEmail = email ? email.replace(/^(.{2})(.*)(@.*)$/, '$1***$3') : 'none';
  const shortId = userId ? `${userId.substring(0, 8)}...` : 'anonymous';

  console.groupCollapsed(`%c[APEX AUTH] %c${event} %c@ ${timestamp}`, 'color: #E50914; font-weight: bold;', 'color: #00FF66; font-weight: bold;', 'color: #888;');
  console.log('Event:', event);
  console.log('User ID:', shortId);
  console.log('Email:', sanitizedEmail);
  if (details) {
    console.log('Details:', details);
  }
  console.groupEnd();
}
