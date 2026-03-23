import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { useSelector } from 'react-redux';

import GuestGuard from '@components/GuestGuard';
import GradientBand from '@components/GradientBand/GradientBand';
import AuthHeader from '@components/AuthHeader/AuthHeader';
import Button, { BUTTON_BG_COLOR, BUTTON_COLOR, BUTTON_SIZE } from '@components/Button/Button';
import { GRADIENT_COLORS } from '@constants/gradientColors';
import Loader from '@components/Loader/Loader';
import LoginPasskey from 'screens/loginPasskey';
import { getCodeVerifier } from 'lib/sso/pkce';
import { exchangeCodeForTokens, validateIdToken } from 'lib/sso/tokens';
import { RootState, store } from '@store/index';
import { setSSOSession } from '@store/slices/ssoSlice';

export default function AuthPasskeyPage() {
  const router = useRouter();
  const ssoAuthenticated = useSelector((state: RootState) => state.sso.isAuthenticated);
  const [ssoProcessing, setSsoProcessing] = useState(false);
  const [ssoError, setSsoError] = useState<string | null>(null);
  const processedRef = useRef(false);

  useEffect(() => {
    if (!router.isReady || processedRef.current) return;

    const { code, state, error: ssoError, error_description } = router.query;

    // No SSO params — skip straight to passkey flow
    if (!code && !state && !ssoError) return;

    processedRef.current = true;

    if (ssoError) {
      setSsoError(error_description?.toString() || ssoError.toString());
      return;
    }

    if (!code || !state) {
      setSsoError('Missing authorization code or state parameter.');
      return;
    }

    void handleSSOCallback(code as string, state as string);
  }, [router.isReady, router.query]);

  async function handleSSOCallback(code: string, state: string) {
    setSsoProcessing(true);
    try {
      // Validate state (CSRF protection)
      const savedState = sessionStorage.getItem('sso_state');
      if (state !== savedState) {
        throw new Error('Invalid state parameter — possible CSRF attack.');
      }
      sessionStorage.removeItem('sso_state');

      // Retrieve PKCE code verifier
      const codeVerifier = getCodeVerifier(state);
      if (!codeVerifier) {
        throw new Error('Missing PKCE code verifier. Please try logging in again.');
      }

      // Exchange authorization code for tokens
      const tokens = await exchangeCodeForTokens(code, codeVerifier);

      // Validate ID token
      const userInfo = await validateIdToken(tokens.id_token);

      // Store SSO session in Redux
      store.dispatch(
        setSSOSession({
          idToken: tokens.id_token,
          accessToken: tokens.access_token,
          email: userInfo.email,
          name: userInfo.name,
          picture: userInfo.picture,
        }),
      );

      // Clear query params so the passkey flow renders cleanly
      router.replace('/auth/passkey', undefined, { shallow: true });
    } catch (err: any) {
      console.error('SSO callback error:', err);
      setSsoError(err.message || 'Authentication failed. Please try again.');
    } finally {
      setSsoProcessing(false);
    }
  }

  function handleRetry() {
    router.replace('/auth');
  }

  // SSO callback in progress — show loader
  if (ssoProcessing) {
    return (
      <GuestGuard>
        <div
          style={{
            position: 'relative',
            minHeight: '100vh',
            padding: '20px',
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <GradientBand {...GRADIENT_COLORS.auth} />
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
            </div>
          </div>
        </div>
      </GuestGuard>
    );
  }

  // SSO callback failed — show error
  if (ssoError) {
    return (
      <GuestGuard>
        <div
          style={{
            position: 'relative',
            minHeight: '100vh',
            padding: '20px',
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <GradientBand {...GRADIENT_COLORS.auth} />
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
              <h2 style={{ color: 'var(--text-primary)', marginBottom: '16px' }}>Authentication Error</h2>
              <p style={{ color: 'var(--error-color, red)', marginBottom: '24px', fontSize: '14px' }}>{ssoError}</p>
              {/* @ts-ignore */}
              <Button
                label="Try Again"
                textCentered
                color={BUTTON_COLOR.white}
                size={BUTTON_SIZE.mediumLarge}
                bgColor={BUTTON_BG_COLOR.primary}
                onClick={handleRetry}
              />
            </div>
          </div>
        </div>
      </GuestGuard>
    );
  }

  // SSO complete (or no SSO needed) — show passkey flow
  return (
    <GuestGuard>
      <LoginPasskey />
    </GuestGuard>
  );
}
