import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';

import { useAuth } from '@hooks/useAuth';
import { AuthHubCallbackError, completeAuthHubCallback } from 'lib/authHub/callback';
import { isDevBypass, getDevBypassSession } from 'lib/authHub/devBypass';
import { lastSignInPage } from 'lib/authHub/signInFlow';
import { takeReturnTo } from '@utils/returnTo';
import { persistor } from '@store/index';
import GradientBand from '@components/GradientBand/GradientBand';
import AuthHeader from '@components/AuthHeader/AuthHeader';
import { GRADIENT_COLORS } from '@constants/gradientColors';

/** A fixed line per failure. Hub `error_description` text is never shown. */
function callbackErrorMessage(err: unknown): string {
  if (err instanceof AuthHubCallbackError) {
    switch (err.reason) {
      case 'cancelled':
        return 'Sign-in was cancelled. Tap Try Again to sign in.';
      case 'provider_unavailable':
        return "We couldn't reach the sign-in service just now. Wait a moment, then tap Try Again.";
      case 'session_expired':
        return 'Your sign-in took too long or finished in another tab. Tap Try Again to sign in.';
      case 'rate_limited':
        return 'There were too many sign-in attempts. Wait a minute, then tap Try Again.';
      case 'account_deleted':
        return 'This account has been deleted, so you can no longer sign in with it.';
      case 'state_mismatch':
      case 'missing_verifier':
        return 'This sign-in was not started in this browser, or it was already used. Tap Try Again to sign in.';
      case 'exchange_failed':
        return 'This sign-in expired or was already used. Tap Try Again to sign in.';
      default:
        break;
    }
  }
  return "Sign-in didn't complete. Tap Try Again to sign in.";
}

export default function AuthCallbackPage() {
  const router = useRouter();
  const auth = useAuth();
  const [error, setError] = useState<string | null>(null);
  const ranRef = useRef(false);

  useEffect(() => {
    // The exchange code and its stored sign-in are single-use — guard against
    // React's double-invoke (StrictMode), whose second run would otherwise
    // find nothing and bounce away while the first run's exchange is still
    // succeeding.
    if (ranRef.current) return;
    ranRef.current = true;

    // The hub's code / state / error parameters were already removed from the
    // address bar by the inline capture script in _document, before Next or
    // analytics could record them (lib/authHub/callbackUrl). The local dev
    // bypass marker is stripped here.
    const bypass = new URLSearchParams(window.location.search).get('bypass');
    if (bypass) {
      window.history.replaceState(window.history.state, '', window.location.pathname);
    }

    (async () => {
      try {
        let sessionData;
        let pendingReturnTo: string | null = null;

        if (isDevBypass() && bypass === 'true') {
          sessionData = await getDevBypassSession();
        } else {
          // Refuses (throws) unless this browser started this sign-in; the
          // stored state is single-use, so a reload or replay finds nothing.
          const result = await completeAuthHubCallback();
          if (result.kind === 'none') {
            // Opened directly with nothing to exchange (bookmark, stale tab,
            // reload after the URL was cleaned) — not a failure, just bounce
            // to the sign-in page.
            window.location.replace('/auth');
            return;
          }
          sessionData = result.session;
          pendingReturnTo = result.returnTo;
        }
        // The tab's own copy is always cleared; the copy kept with the
        // sign-in wins (it also survives a finish in another tab).
        const tabReturnTo = takeReturnTo();

        auth.loginWithAuthHub(sessionData);

        // Wait for Redux persist to flush to storage before navigating,
        // otherwise the home page may see stale auth state and redirect back to /auth
        await persistor.flush();

        // Use full page navigation (not router.replace) to ensure the target page
        // re-initializes from persisted state — avoids client-side routing race
        // conditions. Lands on the deep link saved before the auth redirect
        // (e.g. a Yoma hand-off to /entities/<did>), or home when there is none.
        window.location.replace(pendingReturnTo ?? tabReturnTo ?? '/');
      } catch (err) {
        // The reason only: never the code, the verifier or hub text.
        console.error('Auth callback failed:', err instanceof AuthHubCallbackError ? err.reason : 'unexpected');
        setError(callbackErrorMessage(err));
      }
    })();
  }, []);

  if (error) {
    return (
      <div
        style={{
          position: 'relative',
          minHeight: '100vh',
          padding: '20px',
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <GradientBand {...GRADIENT_COLORS.auth} fullScreen />
        <AuthHeader />
        <div
          style={{
            position: 'relative',
            zIndex: 1,
            width: '100%',
            maxWidth: '400px',
            marginTop: 'calc(30vh - 50px)',
          }}
        >
          <div
            style={{
              borderRadius: '12px',
              padding: '24px',
              backgroundColor: 'var(--bg-secondary)',
              textAlign: 'center',
            }}
          >
            <h2 style={{ color: 'var(--text-primary)', marginBottom: '16px' }}>Authentication Failed</h2>
            <p role='alert' style={{ color: 'var(--error-color, red)', marginBottom: '24px', fontSize: '14px' }}>
              {error}
            </p>
            <button
              data-testid='auth-callback-restart'
              onClick={() => router.push(lastSignInPage())}
              style={{
                width: '100%',
                padding: '12px 20px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: 'var(--green-primary)',
                color: 'white',
                cursor: 'pointer',
                fontSize: '15px',
                fontWeight: 600,
              }}
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'relative',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <GradientBand {...GRADIENT_COLORS.auth} fullScreen />
      <div style={{ textAlign: 'center', zIndex: 1 }}>
        <div
          style={{
            width: 48,
            height: 48,
            border: '3px solid var(--border-color)',
            borderTopColor: 'var(--accent-color)',
            borderRadius: '50%',
            animation: 'callbackSpinner 0.8s linear infinite',
            margin: '0 auto 16px',
          }}
        />
        <p style={{ color: 'var(--text-primary)', fontSize: 16 }}>Completing sign in...</p>
        <style>{`
          @keyframes callbackSpinner {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  );
}
