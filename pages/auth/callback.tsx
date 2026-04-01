import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

import { useAuth } from '@hooks/useAuth';
import { exchangeAuthCode } from 'lib/authHub/redirect';
import { isDevBypass, getDevBypassSession } from 'lib/authHub/devBypass';
import { persistor } from '@store/index';
import AuthLayout from '@components/AuthLayout/AuthLayout';
import Loader from '@components/Loader/Loader';
import Button, { BUTTON_BG_COLOR, BUTTON_COLOR, BUTTON_SIZE } from '@components/Button/Button';

export default function AuthCallbackPage() {
  const router = useRouter();
  const auth = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const bypass = params.get('bypass');

    if (code || bypass) {
      window.history.replaceState({}, '', window.location.pathname);
    }

    if (code && sessionStorage.getItem('ixo_code_used') === code) {
      window.location.replace('/');
      return;
    }

    if (!code && !bypass) {
      setError('No authorization code received');
      return;
    }

    if (code) {
      sessionStorage.setItem('ixo_code_used', code);
    }

    (async () => {
      try {
        let sessionData;

        if (isDevBypass() && bypass === 'true') {
          sessionData = getDevBypassSession();
        } else {
          sessionData = await exchangeAuthCode(code!);
        }

        auth.loginWithAuthHub(sessionData);
        await persistor.flush();
        window.location.replace('/');
      } catch (err) {
        console.error('Auth callback failed:', err);
        setError(err instanceof Error ? err.message : 'Authentication failed');
        sessionStorage.removeItem('ixo_code_used');
      }
    })();
  }, []);

  return (
    <AuthLayout>
      {error ? (
        <>
          <p style={{ color: 'var(--error-color)', fontSize: 14, textAlign: 'center' }}>
            {error}
          </p>
          <Button
            label='Try Again'
            onClick={() => router.push('/auth')}
            rounded
            elevated
            fullWidth
            size={BUTTON_SIZE.mediumLarge}
            color={BUTTON_COLOR.grey}
            bgColor={BUTTON_BG_COLOR.white}
          />
        </>
      ) : (
        <>
          <Loader />
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Completing sign in...</p>
        </>
      )}
    </AuthLayout>
  );
}
