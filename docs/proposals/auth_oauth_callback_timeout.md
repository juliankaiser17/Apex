# Proposal: Graceful OAuth Exchange Handling and Timeout Recovery (Gate G7)

**Author:** Track R (Stability & Release Engineering)  
**Date:** October 2026  
**Status:** PROPOSED (Awaiting Owner Review - Gate G7)  
**Lane:** Lane 2 (Authentication & Session State)  
**Target File:** `src/App.tsx`

---

## 1. Cost & Operation Transparency Statement
> **"One user action can cause at most 1 expensive operation (Supabase session resolution)."**
> - **Expected operation count**: 1 local/network token exchange via `supabase.auth.onAuthStateChange` on successful redirect.
> - **Worst-case operation count**: 1 session exchange retry upon network degradation; 0 server database writes.
> - **Failure behavior**: If network stalls or OAuth token is malformed, displays "Finishing sign-in is taking longer than usual" with an explicit "Retry" button. Never silently marks `isAuthReady(true)` with empty credentials or prematurely drops the user to `GUEST`.
> - **Rollback strategy**: Revert the `OAuthCallbackTimeoutGuard` component or restore previous `OAUTH_CALLBACK_PENDING` state.
> - **Regression test**: `scripts/test_auth_methods.ts` with delayed OAuth response mock.

---

## 2. Problem Statement & Root Cause

When a user completes Google Sign-In or deep-link OAuth redirect, the URL contains hash or search parameters (e.g., `#access_token=...` or `?code=...`).
In `src/App.tsx`:
```typescript
} else if (hasAuthCallback) {
  // Wait for onAuthStateChange to process OAuth callback tokens, don't flash guest
  logAuthTransition('OAUTH_CALLBACK_PENDING');
}
```
A previously proposed quick-fix was to attach a `setTimeout(() => setIsAuthReady(true), 3500)` during `OAUTH_CALLBACK_PENDING`.
**Why that quick-fix was rejected:**
Forcing `setIsAuthReady(true)` after 3.5s while the Supabase client is still exchanging the PKCE code or parsing access tokens immediately forces the React shell to evaluate `authStatus`. Since `session` has not yet resolved, `authStatus` defaults to `GUEST` or `AUTH_LOADING`, routing the user to the guest onboarding screen. When Supabase finishes 500ms later with `SIGNED_IN`, the UI flashes violently and forces an unmounted/remounted state transition, corrupting user trust.

---

## 3. Proposed Solution (Lane 2 Diff)

Instead of forcing `isAuthReady(true)` into a false `GUEST` state, introduce a dedicated "Finishing sign-in" status in the bootloader overlay with a calm 6-second timeout offering an interactive "Retry" and "Return to Sign-In" action:

```diff
--- a/src/App.tsx
+++ b/src/App.tsx
@@ -75,6 +75,17 @@ export const App: React.FC = () => {
       } else if (hasAuthCallback) {
         // Wait for onAuthStateChange to process OAuth callback tokens, don't flash guest
         logAuthTransition('OAUTH_CALLBACK_PENDING');
+        // Lane 2 Gate G7: Do NOT force setIsAuthReady(true) to GUEST.
+        // Start a 6-second watchdog that presents a calm retry UI if the network stalls.
+        const oauthTimeout = setTimeout(() => {
+          const currentStatus = useApexStore.getState().authStatus;
+          if (currentStatus !== 'AUTHENTICATED') {
+            setOAuthExchangeStalled(true);
+          }
+        }, 6000);
+        return () => clearTimeout(oauthTimeout);
       } else {
```

And in the UI overlay rendered when `isOAuthExchangeStalled`:
- Display: `"Finishing sign-in is taking longer than usual. Please check your connection."`
- Action 1: `[Retry Connection]` (invokes `supabase.auth.getSession()`)
- Action 2: `[Cancel & Back to Login]` (clears URL hash and sets `GUEST` state without dropping existing storage)

---

## 4. Verification & Gate Status
- **Owner Action Required (Gate G7)**: Owner must review and approve this authentication lifecycle change before it is merged into `src/App.tsx`.
- **Current Behavior Maintained**: `fix/stability` leaves `src/App.tsx` completely untouched, abiding by Operating Rule 7.
