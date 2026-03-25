import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';

import GradientBand from '@components/GradientBand/GradientBand';
import AuthHeader from '@components/AuthHeader/AuthHeader';
import Button, { BUTTON_BG_COLOR, BUTTON_COLOR, BUTTON_SIZE } from '@components/Button/Button';
import { GRADIENT_COLORS } from '@constants/gradientColors';
import Loader from '@components/Loader/Loader';
import { getCodeVerifier } from 'lib/sso/pkce';
import { exchangeCodeForTokens, validateIdToken } from 'lib/sso/tokens';
import { savePendingSSO } from 'lib/sso/pending';

export default function SSOCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const processedRef = useRef(false);

  useEffect(() => {
    if (!router.isReady || processedRef.current) return;
    processedRef.current = true;

    const { code, state, error: ssoError, error_description } = router.query;

    if (ssoError) {
      setError(error_description?.toString() || ssoError.toString());
      return;
    }

    if (!code || !state) {
      setError('Missing authorization code or state parameter.');
      return;
    }

    void handleCallback(code as string, state as string);
  }, [router.isReady, router.query]);

  async function handleCallback(code: string, state: string) {
    try {
      // Validate state (CSRF protection) with TTL
      const raw = localStorage.getItem('sso_state');
      localStorage.removeItem('sso_state');
      if (!raw) {
        throw new Error('Missing SSO state. Please try logging in again.');
      }
      let savedState: string;
      try {
        const parsed = JSON.parse(raw);
        if (Date.now() - parsed.ts > 10 * 60 * 1000) {
          throw new Error('SSO session expired. Please try logging in again.');
        }
        savedState = parsed.value;
      } catch (e: any) {
        if (e.message?.includes('expired')) throw e;
        throw new Error('Invalid SSO state. Please try logging in again.');
      }
      if (state !== savedState) {
        throw new Error('Invalid state parameter — possible CSRF attack.');
      }

      // Retrieve PKCE code verifier
      const codeVerifier = getCodeVerifier(state);
      if (!codeVerifier) {
        throw new Error('Missing PKCE code verifier. Please try logging in again.');
      }

      // Exchange authorization code for tokens
      const tokens = await exchangeCodeForTokens(code, codeVerifier);
      console.log('[SSO] Tokens:', tokens);

      // Validate ID token
      const userInfo = await validateIdToken(tokens.id_token);
      console.log('[SSO] User info:', userInfo);

      // Stage SSO data in sessionStorage (promoted to Redux + secure storage after passkey blocking completes)
      savePendingSSO({
        idToken: tokens.id_token,
        email: userInfo.email,
        name: userInfo.name,
        picture: userInfo.picture,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? null,
        expiresAt: Date.now() + tokens.expires_in * 1000,
      });

      // SSO gate passed — proceed to passkey flow
      router.replace('/auth/login');
    } catch (err: any) {
      console.error('SSO callback error:', err);
      setError(err.message || 'Authentication failed. Please try again.');
    }
  }

  function handleRetry() {
    router.replace('/auth');
  }

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
          {error ? (
            <>
              <h2 style={{ color: 'var(--text-primary)', marginBottom: '16px' }}>Authentication Error</h2>
              <p style={{ color: 'var(--error-color, red)', marginBottom: '24px', fontSize: '14px' }}>{error}</p>
              {/* @ts-ignore */}
              <Button
                label="Try Again"
                textCentered
                color={BUTTON_COLOR.white}
                size={BUTTON_SIZE.mediumLarge}
                bgColor={BUTTON_BG_COLOR.primary}
                onClick={handleRetry}
              />
            </>
          ) : (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '16px',
                padding: '20px 0',
              }}
            >
              {/* @ts-ignore */}
              <Loader />
              <p style={{ color: 'var(--text-secondary)' }}>Completing sign-in...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
