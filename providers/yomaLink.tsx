import { HTMLAttributes, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';

import { useAuth } from '@hooks/useAuth';
import { successToast } from '@components/Toast/Toast';
import { bindLink, getLinkStatus } from 'lib/yomaSync/client';
import { track } from 'lib/analytics/client';
import { AnalyticsEvents } from 'lib/analytics/events';
import {
  clearYref,
  getCachedLink,
  markCheckedThisSession,
  markHandOffBound,
  peekHandOff,
  saveHandOff,
  setCachedLink,
  shouldBind,
  takeHandOffFromUrl,
  wasCheckedThisSession,
  wasHandOffBound,
  type YomaLinkState,
} from '@utils/yomaLink';

/**
 * Root-mounted DID ↔ Yoma link flow. Two responsibilities:
 *
 * 1. Capture the hand-off the yoma worker appends to its redirect into the
 *    entity page (`?yref=<partnerUserId>&ysig=…&yexp=…`, logged in or not):
 *    stash the three together in sessionStorage (it survives the auth-hub
 *    round trip), replacing any earlier hand-off whole. Only that route is
 *    a hand-off; on every page the three are stripped from the URL so a
 *    copied/shared link doesn't carry someone's marker.
 * 2. Once logged in: silently verify the account's email with the yoma
 *    worker (UCAN bind, once per DID ever — the worker caches it) and match
 *    it to a Yoma account. Then, if a hand-off marker is present, compare it
 *    with the account's own yomaId:
 *      - match    → "Yoma account connected" toast, marker cleared
 *      - mismatch → modal offering "switch account" logout or continue
 *
 * Everything is soft-fail: any error is swallowed and retried next session —
 * this flow must never disturb a youth completing an opportunity.
 */

export const YomaLinkProvider = ({ children }: HTMLAttributes<HTMLDivElement>) => {
  const { isLoggedIn, isLoading, did, authProvider, logout } = useAuth();
  const router = useRouter();
  const [mismatch, setMismatch] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const runningRef = useRef(false);

  // 1. Capture (entry route only) + strip (everywhere) the hand-off on every route change.
  useEffect(() => {
    if (!router.isReady) return;
    const { handOff, cleaned } = takeHandOffFromUrl(window.location.href, router.pathname);
    if (handOff) saveHandOff(handOff);
    if (cleaned !== null) window.history.replaceState(window.history.state, '', cleaned);
  }, [router.isReady, router.asPath, router.pathname]);

  // 2. Silent link check after login (and on arrival with a live session).
  useEffect(() => {
    if (isLoading || !isLoggedIn || !did || !router.isReady) return;
    if (runningRef.current) return;

    const handOff = peekHandOff();
    const yref = handOff?.yref ?? null;
    const checkedThisSession = wasCheckedThisSession(did);
    // Once per browser session unless a hand-off marker demands a comparison.
    if (!yref && checkedThisSession) return;

    runningRef.current = true;
    (async () => {
      try {
        let link: YomaLinkState | null = getCachedLink(did);

        // A completed link is permanent — only hit the network when we don't
        // know of one yet. status is a cheap D1 read; bind costs one
        // rate-limited auth-hub read (email, or phone for a phone-only Yoma
        // account) only while the worker has no verified contact for this DID.
        if (!link?.yomaId) {
          const status = await getLinkStatus(did);
          link = status;
          // Bind while the worker has no verified contact for this DID (the
          // hub is read only then), or to hand it the signed hand-off: on a
          // DID already bound but unmatched, the worker uses it (D1 only) to
          // settle a match its contact alone left ambiguous. The same
          // hand-off is sent once per DID per tab: a `yomaId: null` answer
          // (unsigned, expired or not this account) is not re-sent on every
          // page load. Marked before the call, so a failing call is not
          // retried in a loop either. A phone-only account that is not linked
          // binds once per session as well (shouldBind): the worker reports
          // it to Yoma by its phone and refreshes that phone from the hub.
          const handOffSent = !!handOff && wasHandOffBound(did, handOff);
          if (shouldBind(status, { handOff, handOffSent, checkedThisSession })) {
            if (handOff) markHandOffBound(did, handOff);
            link = await bindLink(did, { authProvider, handOff });
          }
          setCachedLink(did, link);
        }
        markCheckedThisSession(did);

        if (yref) {
          if (link.yomaId && link.yomaId === yref) {
            clearYref();
            successToast('Yoma account connected');
            track(AnalyticsEvents.YomaAccountLinked);
          } else {
            // Wrong account, or one that matches no Yoma profile (by email,
            // or by phone for a phone-only Yoma account) — either way this
            // sign-in isn't the account the hand-off was for.
            setMismatch(true);
            track(AnalyticsEvents.YomaAccountMismatchShown);
          }
        }
      } catch (err) {
        // Soft-fail by design (worker down, hub rate-limited, legacy dev
        // account) — the check re-runs next session.
        console.warn('Yoma link check failed (will retry next session):', err);
      } finally {
        runningRef.current = false;
      }
    })();
  }, [isLoading, isLoggedIn, did, authProvider, router.isReady]);

  function handleContinue() {
    // The user owns the decision — drop the marker so it never nags again.
    clearYref();
    setMismatch(false);
  }

  function handleSwitchAccount() {
    setLoggingOut(true);
    // preserveReturnTo keeps the deep link AND the yref marker, so after
    // signing in with the right account the user lands back here and the
    // comparison re-runs (and connects). A Yoma account is signed out at the
    // hub and at Yoma first, then sent to a fresh Yoma login (providers/auth).
    void logout({ preserveReturnTo: true });
  }

  return (
    <>
      {children}
      {mismatch && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 2200,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(30, 22, 38, 0.44)',
            backdropFilter: 'blur(4px)',
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--surface, #fff)',
              borderRadius: 26,
              padding: '32px 28px',
              maxWidth: 360,
              width: '90%',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <p
              style={{
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-display)',
                fontSize: 21,
                fontWeight: 700,
                letterSpacing: '-0.01em',
                margin: 0,
              }}
            >
              Not the right account
            </p>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, margin: 0, lineHeight: 1.5 }}>
              You came here from Yoma, but you&apos;re signed in with a different account from the Yoma account this
              link was made for. To earn your Yoma reward, log out and sign in with that Yoma account.
            </p>
            <button
              onClick={handleSwitchAccount}
              disabled={loggingOut}
              style={{
                padding: '15px 24px',
                borderRadius: 999,
                border: 'none',
                backgroundColor: 'var(--green-primary)',
                boxShadow: 'var(--shadow-btn)',
                color: '#fff',
                cursor: 'pointer',
                fontSize: 16,
                fontWeight: 700,
                opacity: loggingOut ? 0.45 : 1,
              }}
            >
              {loggingOut ? 'Signing out…' : 'Log out and switch account'}
            </button>
            <button
              onClick={handleContinue}
              disabled={loggingOut}
              style={{
                padding: '12px 20px',
                borderRadius: 999,
                border: 'none',
                boxShadow: 'inset 0 0 0 1.5px var(--border-color)',
                background: 'none',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                fontSize: 15,
                fontWeight: 700,
              }}
            >
              Continue with this account
            </button>
          </div>
        </div>
      )}
    </>
  );
};
