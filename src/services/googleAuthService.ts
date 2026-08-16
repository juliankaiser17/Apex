/**
 * Real Google OAuth Authentication Helper for APEX
 * Dynamically initializes Google Identity Services (GIS)
 */

export interface GoogleUserData {
  id: string;
  email: string;
  name: string;
  givenName?: string;
  familyName?: string;
  picture: string;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: { client_id: string; callback: (response: { credential: string }) => void; auto_select?: boolean }) => void;
          prompt: (notification?: (notification: unknown) => void) => void;
          renderButton: (element: HTMLElement, config: Record<string, unknown>) => void;
        };
      };
    };
  }
}

/**
 * Load Google GIS Script dynamically
 */
export function loadGoogleGisScript(): Promise<void> {
  return new Promise((resolve) => {
    if (window.google?.accounts?.id) {
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
      name: payload.name,
      givenName: payload.given_name,
      familyName: payload.family_name,
      picture: payload.picture
    };
  } catch (e) {
    console.error('Failed to decode Google OAuth JWT token:', e);
    return null;
  }
}

/**
 * Trigger Real Google Sign-In Prompt or Popup
 */
export async function triggerGoogleSignIn(
  onSuccess: (userData: GoogleUserData) => void,
  onError?: (errMessage: string) => void
): Promise<void> {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '708398928493-8qkjhla9p00kkjrse5f0l4d8spo9pj6c.apps.googleusercontent.com';

  await loadGoogleGisScript();

  if (clientId && window.google?.accounts?.id) {
    try {
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (response) => {
          if (response.credential) {
            const userData = decodeJwtToken(response.credential);
            if (userData) {
              // Store user authentication session in localStorage
              localStorage.setItem('apex_user_session', JSON.stringify(userData));
              onSuccess(userData);
            } else {
              onError?.('Invalid authentication token returned from Google.');
            }
          }
        }
      });

      window.google.accounts.id.prompt((notification: unknown) => {
        console.log('Google One Tap notification:', notification);
      });
      onError?.('Google Sign-In prompt failed. Please try again.');
      return;
    } catch (err: any) {
      console.warn('Google GIS prompt failed:', err);
      onError?.(err?.message || 'Google Sign-In failed.');
      return;
    }
  }

  onError?.('Google Sign-In client configuration is unavailable. Please sign in with Email.');
}
