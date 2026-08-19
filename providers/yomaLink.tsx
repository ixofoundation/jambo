import { HTMLAttributes, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';

import { useAuth } from '@hooks/useAuth';
import { successToast } from '@components/Toast/Toast';
import { bindLink, getLinkStatus } from 'lib/yomaSync/client';
import {
  clearYref,
  getCachedLink,
  markCheckedThisSession,
  peekYref,
  saveYref,
  setCachedLink,
  wasCheckedThisSession,
  type YomaLinkState,
} from '@utils/yomaLink';

/**
 * Root-mounted DID ↔ Yoma link flow. Two responsibilities:
 *
 * 1. Capture the `?yref=<partnerUserId>` hand-off marker the yoma worker
 *    appends to its redirect — on ANY page, logged in or not — stash it in
 *    sessionStorage (it survives the auth-hub round trip) and strip it from
 *    the URL so a copied/shared link doesn't carry someone's marker.
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
  const { isLoggedIn, isLoading, did, logout } = useAuth();
  const router = useRouter();
  const [mismatch, setMismatch] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const runningRef = useRef(false);

  // 1. Capture + strip the hand-off marker on every route change.
  useEffect(() => {
    if (!router.isReady) return;
    const url = new URL(window.location.href);
    const yref = url.searchParams.get('yref');
    if (!yref) return;
    saveYref(yref);
    url.searchParams.delete('yref');
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
  }, [router.isReady, router.asPath]);

  // 2. Silent link check after login (and on arrival with a live session).
  useEffect(() => {
    if (isLoading || !isLoggedIn || !did || !router.isReady) return;
    if (runningRef.current) return;

    const yref = peekYref();
    // Once per browser session unless a hand-off marker demands a comparison.
    if (!yref && wasCheckedThisSession(did)) return;

    runningRef.current = true;
    (async () => {
      try {
        let link: YomaLinkState | null = getCachedLink(did);

        // A completed link is permanent — only hit the network when we don't
        // know of one yet. status is a cheap D1 read; bind (which costs one
        // rate-limited auth-hub email read, once per DID ever) only runs
        // while the worker has no verified email for this DID.
        if (!link?.yomaId) {
          link = await getLinkStatus(did);
          if (!link.email) link = await bindLink(did);
          setCachedLink(did, link);
        }
        markCheckedThisSession(did);

        if (yref) {
          if (link.yomaId && link.yomaId === yref) {
            clearYref();
            successToast('Yoma account connected');
          } else {
            // Wrong account OR an email that matches no Yoma profile — either
            // way this sign-in isn't the account the hand-off was for.
            setMismatch(true);
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
  }, [isLoading, isLoggedIn, did, router.isReady]);

  function handleContinue() {
    // The user owns the decision — drop the marker so it never nags again.
    clearYref();
    setMismatch(false);
  }

  function handleSwitchAccount() {
    setLoggingOut(true);
    // preserveReturnTo keeps the deep link AND the yref marker, so after
    // signing in with the right account the user lands back here and the
    // comparison re-runs (and connects).
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
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(4px)',
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--bg-primary, #1a1a2e)',
              borderRadius: 16,
              padding: '32px 28px',
              maxWidth: 360,
              width: '90%',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
            }}
          >
            <p style={{ color: 'var(--text-primary)', fontSize: 16, fontWeight: 600, margin: 0 }}>
              Different Yoma account
            </p>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, margin: 0, lineHeight: 1.5 }}>
              You came here from Yoma, but the account you&apos;re signed in with uses a different email than your Yoma
              account. To earn your Yoma reward, sign in with the same email you use on Yoma.
            </p>
            <button
              onClick={handleSwitchAccount}
              disabled={loggingOut}
              style={{
                padding: '12px 20px',
                borderRadius: 8,
                border: 'none',
                backgroundColor: '#3E9B4F',
                color: 'white',
                cursor: 'pointer',
                fontSize: 15,
                fontWeight: 600,
              }}
            >
              {loggingOut ? 'Signing out…' : 'Log out and switch account'}
            </button>
            <button
              onClick={handleContinue}
              disabled={loggingOut}
              style={{
                padding: '10px 20px',
                borderRadius: 8,
                border: '1px solid var(--border-color)',
                background: 'none',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                fontSize: 14,
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
