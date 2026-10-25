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
export const RELEASE_KEYSTORE_SHA1 = '4D:2F:D5:24:2B:63:2E:D8:EC:5C:F8:E6:DA:33:B1:D6:9F:DE:9F:31';
export const ANDROID_PACKAGE_NAME = 'org.juliankaiser.apex';
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
let isNativeGoogleInitialized = false;

async function ensureNativeGoogleInitialized(clientId: string): Promise<void> {
  if (!isNativeGoogleInitialized) {
    console.log('[AuthDiag:Google] 1. Initializing native GoogleSignIn plugin (scopes: [])...');
    await GoogleSignIn.initialize({
      clientId,
      scopes: []
    });
    isNativeGoogleInitialized = true;
    console.log('[AuthDiag:Google] 2. Native GoogleSignIn plugin initialized successfully.');
  }
}

export interface AuthDiagnosticInfo {
  stage: 'PICKER_CANCELED' | 'TOKEN_RETRIEVAL_FAILED' | 'SUPABASE_REJECTED' | 'NAVIGATION_FAILED';
  title: string;
  code: string;
  message: string;
  resolution?: string;
}

export async function triggerGoogleSignIn(
  onSuccess: (userData: GoogleUserData) => void,
  onError?: (errMessage: string, diag?: AuthDiagnosticInfo) => void
): Promise<void> {
  const clientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string) || DEFAULT_GOOGLE_CLIENT_ID;

  // ══════════════════════════════════════════════════════════════════════════
  // 1. NATIVE ANDROID / IOS IN-APP SIGN-IN (Capacitor Google Sign-In)
  // ══════════════════════════════════════════════════════════════════════════
  if (Capacitor.isNativePlatform()) {
    console.log('[AuthDiag:Google] Native platform detected. Opening in-app Credential Manager dialog...');
    try {
      await ensureNativeGoogleInitialized(clientId);

      console.log('[AuthDiag:Google] 3. Calling GoogleSignIn.signIn(). Awaiting account selection...');
      const result = await GoogleSignIn.signIn();

      if (!result) {
        console.log('[AuthDiag:Google] Account picker returned null (user cancelled).');
        onError?.('Google Sign-In was cancelled.', {
          stage: 'PICKER_CANCELED',
          title: 'Account Picker Dismissed',
          code: 'USER_CANCELED',
          message: 'The Google account selector was closed without selecting an account.'
        });
        return;
      }

      console.log('[AuthDiag:Google] 4. Account picker result received.', {
        hasIdToken: Boolean(result.idToken),
        hasEmail: Boolean(result.email),
        hasDisplayName: Boolean(result.displayName)
      });

      // If user cancelled or no credentials returned
      if (!result.idToken && !result.email) {
        console.log('[AuthDiag:Google] User cancelled or no credentials returned.');
        onError?.('No Google account selected.', {
          stage: 'PICKER_CANCELED',
          title: 'No Account Selected',
          code: 'NO_CREDENTIAL_SELECTED',
          message: 'The Google account dialog was closed without choosing credentials.'
        });
        return;
      }

      // Exchange ID Token with Supabase — this is MANDATORY for real auth
      if (result.idToken) {
        console.log('[AuthDiag:Google] 5. Exchanging Google ID token with Supabase auth...');
        try {
          const { data: supabaseSession, error: supabaseError } = await supabase.auth.signInWithIdToken({
            provider: 'google',
            token: result.idToken,
            access_token: result.accessToken || undefined
          });

          if (supabaseError || !supabaseSession?.user) {
            console.error('[AuthDiag:Google] Supabase signInWithIdToken error:', supabaseError?.message);
            const statusStr = (supabaseError as any)?.status ? ` (Status ${(supabaseError as any).status})` : '';
            onError?.((supabaseError?.message || 'Server authentication failed.') + statusStr, {
              stage: 'SUPABASE_REJECTED',
              title: 'Supabase Auth Rejected',
              code: (supabaseError as any)?.code || String((supabaseError as any)?.status || 'SUPABASE_AUTH_ERROR'),
              message: supabaseError?.message || 'Supabase server rejected the Google ID token.',
              resolution: 'Check that Web Client ID is configured in Supabase Dashboard -> Authentication -> Providers -> Google.'
            });
            return;
          }

          const supabaseUserId = supabaseSession.user.id;
          console.log('[AuthDiag:Google] 6. Supabase session created successfully. User ID prefix:', supabaseUserId.substring(0, 8));

          const userData: GoogleUserData = {
            id: supabaseUserId,
            email: result.email || supabaseSession.user.email || '',
            name: result.displayName || result.givenName || (result.email ? result.email.split('@')[0] : 'User'),
            givenName: result.givenName || undefined,
            familyName: result.familyName || undefined,
            picture: result.imageUrl || ''
          };

          console.log('[AuthDiag:Google] 7. Invoking onSuccess callback to complete app onboarding...');
          onSuccess(userData);
          return;
        } catch (supabaseErr: any) {
          console.error('[AuthDiag:Google] Supabase signInWithIdToken exception:', supabaseErr?.message || supabaseErr);
          onError?.('Server authentication failed. Please try again or use email sign in.', {
            stage: 'SUPABASE_REJECTED',
            title: 'Supabase Server Exception',
            code: 'SUPABASE_EXCEPTION',
            message: supabaseErr?.message || 'Exception occurred during Supabase token exchange.',
            resolution: 'Verify network connection and Supabase endpoint availability.'
          });
          return;
        }
      } else {
        console.warn('[AuthDiag:Google] No ID token in GoogleSignIn result.');
        onError?.('Google did not provide an authentication token. Please try again or use email sign in.', {
          stage: 'TOKEN_RETRIEVAL_FAILED',
          title: 'Missing Google ID Token',
          code: 'NO_ID_TOKEN_RETURNED',
          message: 'Account was selected, but Google Play Services did not return an ID token.',
          resolution: 'Ensure the Web Client ID is configured as serverClientId in Google Cloud Console.'
        });
        return;
      }
    } catch (nativeErr: any) {
      console.warn('[AuthDiag:Google] Native Google Sign-In caught error:', nativeErr);
      const errMessage = nativeErr?.message || String(nativeErr);
      const errCode = nativeErr?.code || '';

      // Check if this error is an internal credential error containing numbers or standard exception types
      const hasSpecificErrorCode = 
        Boolean(errMessage.match(/\[\d+\]/)) ||
        errMessage.includes('Cannot find a matching credential') ||
        errMessage.includes('DEVELOPER_ERROR') ||
        errMessage.includes('12500') ||
        errMessage.includes('10:') ||
        errMessage.includes('16:');

      // True cancellation only occurs when the user actively dismisses the picker
      const isExplicitCancel = 
        !hasSpecificErrorCode && (
          errCode === 'SIGN_IN_CANCELED' ||
          errMessage === 'The user canceled the sign-in flow.' ||
          errMessage.includes('12501') ||
          (errMessage.includes('GetCredentialCancellationException') && !errMessage.includes('[16]'))
        );

      if (isExplicitCancel) {
        console.log('[AuthDiag:Google] Native account picker was cancelled by user.');
        onError?.('Google Sign-In was cancelled.', {
          stage: 'PICKER_CANCELED',
          title: 'Sign-In Cancelled',
          code: 'USER_CANCELED',
          message: 'The account picker dialog was dismissed.'
        });
        return;
      }

      // Extract numeric code if present (e.g. [16], [10], etc.)
      const codeMatch = errMessage.match(/\[(\d+)\]/) || errMessage.match(/\b(10|16|12500|12502)\b/);
      const numericCode = codeMatch ? codeMatch[1] : null;
      let extractedCode = numericCode ? `PLAY_SERVICES_CODE_${numericCode}` : (errCode || 'PLAY_SERVICES_ERROR');
      let title = 'Token Retrieval Failed';
      let userFriendlyMessage = 'Google Sign-In failed.';
      let resolution = `Verify that the APK signing certificate SHA-1 fingerprint (${RELEASE_KEYSTORE_SHA1}) is registered under an Android OAuth Client in Google Cloud Console (Project 708398928493).`;

      if (numericCode === '16' || errMessage.includes('Cannot find a matching credential')) {
        extractedCode = 'PLAY_SERVICES_CODE_16';
        title = 'No Matching OAuth Credential (Code 16)';
        userFriendlyMessage = 'Google Play Services cannot find a matching OAuth client credential for this release APK.';
        resolution = `Google Cloud Console must have an Android OAuth Client configured for package "${ANDROID_PACKAGE_NAME}" with release SHA-1 (${RELEASE_KEYSTORE_SHA1}).`;
      } else if (numericCode === '10' || errMessage.includes('DEVELOPER_ERROR')) {
        extractedCode = 'PLAY_SERVICES_CODE_10';
        title = 'OAuth Developer Configuration Error (Code 10)';
        userFriendlyMessage = 'Google Play Services rejected the app configuration.';
        resolution = `Check Google Cloud Console OAuth Client: verify package "${ANDROID_PACKAGE_NAME}" matches release SHA-1 (${RELEASE_KEYSTORE_SHA1}) and Web Client ID (${clientId}) is correct.`;
      }

      onError?.(userFriendlyMessage, {
        stage: 'TOKEN_RETRIEVAL_FAILED',
        title,
        code: extractedCode,
        message: errMessage || 'Google Play Services was unable to issue credentials for this app.',
        resolution
      });
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
