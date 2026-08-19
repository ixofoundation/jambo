import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

import GuestGuard from '@components/GuestGuard';
import GradientBand from '@components/GradientBand/GradientBand';
import Button, { BUTTON_BG_COLOR, BUTTON_BORDER_COLOR, BUTTON_COLOR, BUTTON_SIZE } from '@components/Button/Button';
import { GRADIENT_COLORS } from '@constants/gradientColors';
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
      <div style={{ position: 'relative', minHeight: '100vh' }}>
        <GradientBand {...GRADIENT_COLORS.auth} />
        <div
          style={{
            position: 'relative',
            height: '30vh',
            maxHeight: '300px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src='/images/logo.png' alt='Jambo' style={{ height: '64px', width: 'auto', objectFit: 'contain' }} />
        </div>

        <div
          style={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'stretch',
            gap: '16px',
            padding: '32px 20px',
            maxWidth: '400px',
            margin: '0 auto',
          }}
        >
          {hasError && (
            <p style={{ color: 'var(--error-color)', fontSize: '14px', textAlign: 'center', margin: 0 }}>
              {router.query.error_description?.toString() || router.query.error?.toString()}
            </p>
          )}

          {fromYoma && (
            <p
              style={{
                color: 'var(--text-secondary)',
                fontSize: '14px',
                textAlign: 'center',
                margin: 0,
                lineHeight: 1.5,
              }}
            >
              You&apos;re joining from Yoma — please sign in with the <strong>same email</strong> you use on Yoma so
              your progress counts towards your Yoma rewards.
            </p>
          )}

          <Button
            label={primaryLabel}
            size={BUTTON_SIZE.mediumLarge}
            onClick={handleSignIn}
            disabled={isRedirecting}
            prefixIcon={<span style={{ marginRight: '10px', fontWeight: 700 }}>→</span>}
            style={{
              width: '100%',
              backgroundColor: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              boxShadow: '0 8px 20px rgba(0, 0, 0, 0.15)',
            }}
          />

          {isDevBypass() && (
            <Button
              label='Dev Login (bypass)'
              color={BUTTON_COLOR.secondary}
              bgColor={BUTTON_BG_COLOR.white}
              borderColor={BUTTON_BORDER_COLOR.lightGrey}
              size={BUTTON_SIZE.medium}
              onClick={handleDevLogin}
              style={{ width: '100%' }}
            />
          )}
        </div>
      </div>
    </GuestGuard>
  );
}
