import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';

import { useAuth } from '@hooks/useAuth';
import { useAppDispatch, useAppSelector } from '@store/hooks';
import { setEmailSubscription, resetEmailSubscription } from '@store/slices/emailSubscriptionSlice';
import { EMAIL_NOTIFIER_URL } from 'lib/emailNotifier/client';
import { readSubscriptionStatus, subscribeLinkedEmail } from 'lib/emailNotifier/subscribe';

const PROMPT_GATE_KEY = 'ixo_email_notif_prompted';

// Local calendar day as YYYY-M-D. Used to gate the prompt to once per day: a
// user who dismisses with "Later" is re-prompted the next day (i.e. after local
// midnight), not again the same day.
function localDay(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

// Whether the activation prompt has already been shown for this wallet TODAY.
// localStorage (not redux-persist / sessionStorage) so the gate survives reloads
// and new browser sessions but naturally lapses when the calendar day rolls over.
function alreadyPromptedToday(address: string): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return window.localStorage.getItem(`${PROMPT_GATE_KEY}:${address}`) === localDay();
  } catch {
    return false;
  }
}

function markPromptedToday(address: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(`${PROMPT_GATE_KEY}:${address}`, localDay());
  } catch {
    /* localStorage unavailable — prompt may reappear, which is acceptable */
  }
}

/**
 * App-level gate that, at most once per calendar day, offers a not-yet-subscribed
 * user the chance to activate email notifications. Mounted globally in `_app`;
 * renders nothing unless the feature is configured, the user is logged in, the
 * status check has completed, and they are not subscribed.
 */
export default function EmailNotificationPrompt() {
  const { isLoggedIn, address, did, onSign } = useAuth();
  const dispatch = useAppDispatch();
  const { checked, subscribed } = useAppSelector((state) => state.emailSubscription);
  const configured = !!EMAIL_NOTIFIER_URL;

  const [open, setOpen] = useState(false);
  const [activating, setActivating] = useState(false);
  const checkAttemptedFor = useRef<string | null>(null);

  // Reset per-wallet guards on logout so the next login re-checks and can prompt.
  useEffect(() => {
    if (!isLoggedIn) {
      checkAttemptedFor.current = null;
      setOpen(false);
      dispatch(resetEmailSubscription());
    }
  }, [isLoggedIn, dispatch]);

  // Verify subscription status once per wallet on login → seeds the global flag.
  useEffect(() => {
    if (!configured || !isLoggedIn || !address || !did) return;
    if (checkAttemptedFor.current === address) return;
    checkAttemptedFor.current = address;

    let cancelled = false;
    (async () => {
      try {
        const sub = await readSubscriptionStatus({ did, address });
        if (!cancelled) {
          dispatch(setEmailSubscription({ subscribed: sub?.status === 'active', status: sub?.status ?? null }));
        }
      } catch {
        // 401/403/404 already map to null; treat any failure as "not subscribed"
        // so the prompt can still offer activation.
        if (!cancelled) dispatch(setEmailSubscription({ subscribed: false, status: null }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [configured, isLoggedIn, address, did, dispatch]);

  // Open the prompt once the check completes, if not subscribed and not yet
  // shown today (re-prompts the next day after a "Later" dismissal).
  useEffect(() => {
    if (!configured || !checked || !address || subscribed) return;
    if (alreadyPromptedToday(address)) return;
    markPromptedToday(address);
    setOpen(true);
  }, [configured, checked, subscribed, address]);

  const handleActivate = useCallback(async () => {
    if (!address || !did) return;
    setActivating(true);
    try {
      await subscribeLinkedEmail({ did, address, onSign });
      dispatch(setEmailSubscription({ subscribed: true, status: 'active' }));
      toast.success('Email notifications activated.');
      setOpen(false);
    } catch (err) {
      toast.error(`Couldn't activate email notifications: ${err instanceof Error ? err.message : 'unknown error'}`);
    } finally {
      setActivating(false);
    }
  }, [address, did, onSign, dispatch]);

  const handleNotNow = useCallback(() => {
    if (activating) return;
    setOpen(false);
  }, [activating]);

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(4px)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleNotNow();
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '360px',
          margin: '0 20px',
          borderRadius: 16,
          padding: '28px 20px 20px',
          backgroundColor: 'var(--bg-secondary)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <MailIcon />
            <h1 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 500, color: 'var(--text-primary)' }}>
              Stay updated
            </h1>
          </div>
          <p style={{ margin: '15px 0px', fontSize: '14px', lineHeight: 1.5, color: 'var(--text-primary)' }}>
            Get email updates when your claims are evaluated or payments are received.
          </p>
          <p style={{ margin: '5px 0', fontSize: '11px', color: 'var(--text-primary)', opacity: 0.6 }}>
            Manage preferences or unsubscribe anytime in Settings.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px' }}>
          <button
            onClick={handleNotNow}
            disabled={activating}
            style={{
              flex: 1,
              padding: '12px',
              border: 'none',
              borderRadius: 'var(--card-border-radius)',
              background: 'none',
              color: 'var(--text-secondary)',
              fontSize: '14px',
              fontWeight: 500,
              cursor: activating ? 'default' : 'pointer',
            }}
          >
            Not now
          </button>
          <button
            onClick={() => void handleActivate()}
            disabled={activating}
            style={{
              flex: 1,
              padding: '12px',
              border: 'none',
              borderRadius: 'var(--card-border-radius)',
              background: 'var(--green-primary)',
              color: '#fff',
              fontSize: '14px',
              fontWeight: 600,
              cursor: activating ? 'default' : 'pointer',
              opacity: activating ? 0.7 : 1,
            }}
          >
            {activating ? 'Loading…' : 'Get updates'}
          </button>
        </div>
      </div>
    </div>
  );
}

function MailIcon() {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '44px',
        height: '44px',
        borderRadius: '50%',
        background: 'color-mix(in srgb, var(--green-primary) 14%, transparent)',
        color: 'var(--green-primary)',
      }}
    >
      <svg
        width='22'
        height='22'
        viewBox='0 0 24 24'
        fill='none'
        stroke='currentColor'
        strokeWidth='2'
        strokeLinecap='round'
        strokeLinejoin='round'
      >
        <rect x='2' y='4' width='20' height='16' rx='2' />
        <path d='m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7' />
      </svg>
    </span>
  );
}
