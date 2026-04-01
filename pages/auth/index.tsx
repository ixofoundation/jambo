import { useState } from 'react';
import { useRouter } from 'next/router';

import GuestGuard from '@components/GuestGuard';
import AuthLayout from '@components/AuthLayout/AuthLayout';
import Button, { BUTTON_BG_COLOR, BUTTON_COLOR, BUTTON_SIZE } from '@components/Button/Button';
import { loginViaAuthHub } from 'lib/authHub/redirect';
import { isDevBypass } from 'lib/authHub/devBypass';
import LoginIcon from '@icons/login.svg';

export default function AuthPage() {
  const router = useRouter();
  const [isRedirecting, setIsRedirecting] = useState(false);

  function handleSignIn() {
    setIsRedirecting(true);
    loginViaAuthHub();
  }

  function handleDevLogin() {
    router.push('/auth/callback?bypass=true');
  }

  return (
    <GuestGuard>
      <AuthLayout>
        {router.query.error && (
          <p style={{ color: 'var(--error-color)', fontSize: 14, textAlign: 'center' }}>
            {router.query.error_description?.toString() || router.query.error?.toString()}
          </p>
        )}

        <Button
          label={isRedirecting ? 'Redirecting...' : router.query.error ? 'Try Again' : 'Sign in'}
          prefixIcon={!isRedirecting ? <LoginIcon color='var(--text-primary)' /> : undefined}
          onClick={handleSignIn}
          disabled={isRedirecting}
          rounded
          elevated
          fullWidth
          size={BUTTON_SIZE.mediumLarge}
          color={BUTTON_COLOR.grey}
          bgColor={BUTTON_BG_COLOR.white}
        />

        {isDevBypass() && (
          <Button
            label='Dev Login (bypass)'
            onClick={handleDevLogin}
            rounded
            fullWidth
            size={BUTTON_SIZE.mediumLarge}
            color={BUTTON_COLOR.grey}
            bgColor={BUTTON_BG_COLOR.lightGrey}
          />
        )}
      </AuthLayout>
    </GuestGuard>
  );
}
