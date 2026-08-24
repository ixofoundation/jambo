import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

import GuestGuard from '@components/GuestGuard';
import { LogOutIcon, UserRoundPlusIcon } from '@components/Icons/icons';
import { loginViaAuthHub } from 'lib/authHub/redirect';
import { isDevBypass } from 'lib/authHub/devBypass';
import { peekYref } from '@utils/yomaLink';

export default function AuthPage() {
  const router = useRouter();
  const [isRedirecting, setIsRedirecting] = useState(false);
  // sessionStorage is browser-only — read after mount to keep SSR happy.
  const [fromYoma, setFromYoma] = useState(false);
  useEffect(() => {
    setFromYoma(peekYref() !== null);
  }, []);

  function handleSignIn() {
    setIsRedirecting(true);
    loginViaAuthHub();
  }

  function handleDevLogin() {
    router.push('/auth/callback?bypass=true');
  }

  const hasError = !!router.query.error;
  const primaryLabel = isRedirecting ? 'Redirecting...' : hasError ? 'Try Again' : 'Sign in';

  return (
    <GuestGuard>
      {/* Viewport-level glow — painting it inside the 400px column leaves a hard seam on desktop. */}
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
              <img src='/images/yoma-logo.png' alt='Yoma — Impacts Exchange' style={{ width: 199, height: 'auto', margin: '0 auto', display: 'block' }} />
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
                Real tasks. Real pay. A CV that proves it.
              </p>
              {hasError && (
                <p style={{ color: 'var(--error-color)', fontSize: 14, marginTop: 16, lineHeight: 1.5 }}>
                  {router.query.error_description?.toString() || router.query.error?.toString()}
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
                  You&apos;re joining from Yoma — please sign in with the <strong>same email</strong> you use on Yoma
                  so your progress counts towards your Yoma rewards.
                </p>
              )}
            </div>
          </div>
          <div className='anim-rise' style={{ display: 'flex', flexDirection: 'column', gap: 12, animationDelay: '0.12s' }}>
            <button className='btn btn--primary btn--block' onClick={handleSignIn} disabled={isRedirecting}>
              <LogOutIcon size={18} style={{ transform: 'scaleX(-1)' }} /> {primaryLabel}
            </button>
            <button className='btn btn--ghost btn--block' onClick={handleSignIn} disabled={isRedirecting}>
              <UserRoundPlusIcon size={18} /> Create account
            </button>
            {isDevBypass() && (
              <button className='btn btn--light btn--block' onClick={handleDevLogin}>
                Dev Login (bypass)
              </button>
            )}
          </div>
        </div>
      </div>
    </GuestGuard>
  );
}
