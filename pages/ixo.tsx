import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';

import GuestGuard from '@components/GuestGuard';
import { LogInIcon } from '@components/Icons/icons';
import { loginViaAuthHub } from 'lib/authHub/redirect';
import { rememberSignInPage } from 'lib/authHub/signInFlow';
import { peekYref } from '@utils/yomaLink';
import { saveReturnTo } from '@utils/returnTo';

/**
 * Sign-in for IXO team accounts: the hub's normal login (Google / Apple /
 * email code), without Yoma. Not linked from anywhere in the app: IXO people
 * are given the address. Everyone else signs in on /auth, which only offers
 * Yoma. The sign-in itself is exactly the one /auth starts (state, PKCE, the
 * saved deep link, /auth/callback); an IXO account that logs out comes back
 * here (providers/auth.tsx).
 */
export default function IxoSignInPage() {
  const router = useRouter();
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [startFailed, setStartFailed] = useState(false);
  // Restored from the back-forward cache with the button still disabled: re-enable (see /auth).
  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) setIsRedirecting(false);
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, []);
  // sessionStorage is browser-only — read after mount to keep SSR happy.
  const [fromYoma, setFromYoma] = useState(false);
  useEffect(() => {
    setFromYoma(peekYref() !== null);
  }, []);
  // Same as /auth: another app on this domain may send people here with a way back.
  useEffect(() => {
    if (!router.isReady) return;
    const back = router.query.returnTo;
    if (typeof back === 'string') saveReturnTo(back);
  }, [router.isReady, router.query.returnTo]);

  function handleSignIn() {
    setIsRedirecting(true);
    setStartFailed(false);
    rememberSignInPage('/ixo');
    loginViaAuthHub({ viaYoma: false }).catch(() => {
      setIsRedirecting(false);
      setStartFailed(true);
    });
  }

  return (
    <GuestGuard>
      <div
        aria-hidden
        style={{
          position: 'fixed',
          inset: 0,
          pointerEvents: 'none',
          background: 'radial-gradient(30rem 24rem at 50% 18%, rgba(231, 212, 237, 0.85), transparent 65%)',
        }}
      />
      <div className='screen' style={{ position: 'relative' }}>
        <div className='onboard'>
          <div className='onboard__center'>
            <div className='anim-rise' style={{ textAlign: 'center' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src='/images/yoma-logo.png'
                alt='Yoma — Impacts Exchange'
                style={{ width: 199, height: 'auto', margin: '0 auto', display: 'block' }}
              />
              <p
                style={{
                  marginTop: 26,
                  fontSize: 17,
                  lineHeight: 1.5,
                  color: 'var(--text-primary)',
                  maxWidth: 260,
                  marginInline: 'auto',
                  textWrap: 'balance',
                }}
              >
                Sign in with your IXO account.
              </p>
              {startFailed && (
                <p role='alert' style={{ color: 'var(--error-color)', fontSize: 14, marginTop: 16, lineHeight: 1.5 }}>
                  Sign-in couldn&apos;t start in this browser. Please try again, or use another browser.
                </p>
              )}
              {fromYoma && (
                <p
                  style={{
                    color: 'var(--text-secondary)',
                    fontSize: 14,
                    marginTop: 16,
                    lineHeight: 1.5,
                    maxWidth: 300,
                    marginInline: 'auto',
                  }}
                >
                  This sign-in is for IXO team accounts. Coming from Yoma? Use the{' '}
                  <Link href='/auth'>
                    <a style={{ color: 'var(--accent-color)', fontWeight: 600 }}>Yoma sign-in</a>
                  </Link>{' '}
                  instead, so your progress counts towards your Yoma rewards.
                </p>
              )}
            </div>
          </div>
          <div
            className='anim-rise'
            style={{ display: 'flex', flexDirection: 'column', gap: 12, animationDelay: '0.12s' }}
          >
            <button className='btn btn--primary btn--block' onClick={handleSignIn} disabled={isRedirecting}>
              <LogInIcon size={18} /> {isRedirecting ? 'Redirecting...' : 'Sign in with IXO'}
            </button>
          </div>
        </div>
      </div>
    </GuestGuard>
  );
}
