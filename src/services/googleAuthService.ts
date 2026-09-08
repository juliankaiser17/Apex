/**
 * APEX — In-App Native Google Authentication Service
 * 
 * Uses @capawesome/capacitor-google-sign-in on native Android/iOS
 * to open the native bottom-sheet Google Account picker directly INSIDE the app
 * without redirecting to external web browsers.
 * 
 * On Web, uses Google Identity Services in-page popups without full page redirection.
 */

import { GoogleSignIn } from '@capawesome/capacitor-google-sign-in';
import { Capacitor } from '@capacitor/core';
import { supabase } from '../lib/supabase';

export interface GoogleUserData {
  id: string;
  email: string;
  name: string;
  givenName?: string;
  familyName?: string;
  picture: string;
}

export const DEBUG_KEYSTORE_SHA1 = '93:5E:D3:F7:6E:8C:17:6E:34:BB:84:D6:97:44:D0:41:EC:69:55:71';
const DEFAULT_GOOGLE_CLIENT_ID = '708398928493-8qkjhla9p00kkjrse5f0l4d8spo9pj6c.apps.googleusercontent.com';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: { client_id: string; callback: (response: { credential: string }) => void; auto_select?: boolean }) => void;
          prompt: (notification?: (notification: unknown) => void) => void;
          renderButton: (element: HTMLElement, config: Record<string, unknown>) => void;
        };
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: { access_token?: string; error?: string }) => void;
          }) => {
            requestAccessToken: () => void;
          };
        };
      };
    };
  }
}

/**
 * Load Google GIS Script dynamically for Web environments
 */
export function loadGoogleGisScript(): Promise<void> {
  return new Promise((resolve) => {
    if (window.google?.accounts?.oauth2 || window.google?.accounts?.id) {
      resolve();
      return;
    }
    const existing = document.getElementById('google-gis-script');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      return;
    }
    const script = document.createElement('script');
    script.id = 'google-gis-script';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    document.head.appendChild(script);
  });
}

/**
 * Decode JWT ID Token returned by Google OAuth GIS
 */
export function decodeJwtToken(token: string): GoogleUserData | null {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const payload = JSON.parse(jsonPayload);
    return {
      id: payload.sub,
      email: payload.email,
      name: payload.name || payload.given_name || 'User',
      givenName: payload.given_name,
      familyName: payload.family_name,
      picture: payload.picture || ''
    };
  } catch (e) {
    console.error('Failed to decode Google OAuth JWT token:', e);
    return null;
  }
}

/**
 * Trigger In-App Google Sign-In
 * - On Native Android / iOS: Opens native OS Google Account Bottom Sheet dialog inside the app.
 * - On Web: Opens in-page account popup without leaving or redirecting the page.
 */
export async function triggerGoogleSignIn(
  onSuccess: (userData: GoogleUserData) => void,
  onError?: (errMessage: string) => void
): Promise<void> {
  const clientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string) || DEFAULT_GOOGLE_CLIENT_ID;

  // ══════════════════════════════════════════════════════════════════════════
  // 1. NATIVE ANDROID / IOS IN-APP SIGN-IN (Capacitor Google Sign-In)
  // ══════════════════════════════════════════════════════════════════════════
  if (Capacitor.isNativePlatform()) {
    try {
      // Initialize the native Google plugin with the Web Client ID
      await GoogleSignIn.initialize({
        clientId,
        scopes: ['profile', 'email']
      });

      // Reset any previous session so the native account picker opens cleanly
      try {
        await GoogleSignIn.signOut();
      } catch (_) {}

      // Show native Google Play Services Account Picker dialog
      const result = await GoogleSignIn.signIn();

      if (!result) {
        // User closed or cancelled dialog
        return;
      }

      // If user cancelled, graceful return
      if (!result.idToken && !result.email) {
        return;
      }

      // Exchange ID Token with Supabase — this is MANDATORY for real auth
      if (result.idToken) {
        try {
          const { data: supabaseSession, error: supabaseError } = await supabase.auth.signInWithIdToken({
            provider: 'google',
            token: result.idToken,
            access_token: result.accessToken || undefined
          });

          if (supabaseError || !supabaseSession?.user) {
            console.error('Supabase signInWithIdToken failed:', supabaseError);
            onError?.('Failed to authenticate with server. Please try again or use email sign in.');
            return;
          }

          // Use Supabase auth user ID — NOT the Google user ID
          const supabaseUserId = supabaseSession.user.id;

          const userData: GoogleUserData = {
            id: supabaseUserId,
            email: result.email || supabaseSession.user.email || '',
            name: result.displayName || result.givenName || (result.email ? result.email.split('@')[0] : 'User'),
            givenName: result.givenName || undefined,
            familyName: result.familyName || undefined,
            picture: result.imageUrl || ''
          };

          onSuccess(userData);
          return;
        } catch (supabaseErr: any) {
          console.error('Supabase signInWithIdToken exception:', supabaseErr);
          onError?.('Server authentication failed. Please try again or use email sign in.');
          return;
        }
      } else {
        // No ID token — cannot create Supabase session
        onError?.('Google did not provide an authentication token. Please try again or use email sign in.');
        return;
      }
    } catch (nativeErr: any) {
      console.warn('Native Google Sign-In notice:', nativeErr);
      const errMessage = nativeErr?.message || String(nativeErr);
      if (errMessage.includes('12501') || errMessage.toLowerCase().includes('cancel')) {
        // User closed or cancelled native account picker dialog
        return;
      }
      onError?.(errMessage || 'Google Sign-In failed. Please sign in with email and password.');
      return;
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 2. WEB BROWSER IN-PAGE POPUP SIGN-IN (Google Identity Services)
  // ══════════════════════════════════════════════════════════════════════════
  try {
    await loadGoogleGisScript();

    // 2A. In-Page OAuth2 Token Client Popup (Opens Google popup window without redirecting current tab)
    if (window.google?.accounts?.oauth2) {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'email profile openid',
        callback: async (tokenResponse) => {
          if (tokenResponse.error) {
            if (tokenResponse.error !== 'access_denied') {
              onError?.(tokenResponse.error);
            }
            return;
          }
          if (tokenResponse.access_token) {
            try {
              const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: { Authorization: `Bearer ${tokenResponse.access_token}` }
              });
              const info = await res.json();
              if (info.email) {
                // Sign in to Supabase with the Google access token
                let supabaseUserId = info.sub || `google_${Date.now()}`;
                try {
                  const { data: supabaseSession } = await supabase.auth.signInWithIdToken({
                    provider: 'google',
                    token: tokenResponse.access_token,
                  });
                  if (supabaseSession?.user) {
                    supabaseUserId = supabaseSession.user.id;
                  }
                } catch (e) {
                  console.warn('Supabase web Google auth notice:', e);
                }

                const userData: GoogleUserData = {
                  id: supabaseUserId,
                  email: info.email,
                  name: info.name || info.given_name || 'User',
                  givenName: info.given_name,
                  familyName: info.family_name,
                  picture: info.picture || ''
                };
                onSuccess(userData);
                return;
              }
            } catch (err: any) {
              console.warn('Failed to fetch userinfo with token:', err);
              onError?.('Failed to retrieve user info from Google.');
            }
          }
        }
      });
      client.requestAccessToken();
      return;
    }

    // 2B. Fallback in-page GIS ID Token
    if (window.google?.accounts?.id) {
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async (response) => {
          if (response.credential) {
            const userData = decodeJwtToken(response.credential);
            if (userData) {
              try {
                await supabase.auth.signInWithIdToken({
                  provider: 'google',
                  token: response.credential
                });
              } catch (e) {
                console.warn('Supabase ID Token session sync notice:', e);
              }
              onSuccess(userData);
            } else {
              onError?.('Invalid authentication token returned from Google.');
            }
          }
        }
      });

      window.google.accounts.id.prompt();
      return;
    }

    onError?.('Google Sign-In service unavailable. Please sign in with email.');
  } catch (webErr: any) {
    console.warn('Web Google GIS exception:', webErr);
    onError?.('Google Sign-In encountered an error. Please use email sign in.');
  }
}

/**
 * Sign out of Google session natively
 */
export async function triggerGoogleSignOut(): Promise<void> {
  try {
    if (Capacitor.isNativePlatform()) {
      await GoogleSignIn.signOut();
    }
  } catch (e) {
    console.warn('Google sign out notice:', e);
  }
}
