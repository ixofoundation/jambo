import { useState } from 'react';
import { useRouter } from 'next/router';

import GuestGuard from '@components/GuestGuard';
import GradientBand from '@components/GradientBand/GradientBand';
import AuthHeader from '@components/AuthHeader/AuthHeader';
import { GRADIENT_COLORS } from '@constants/gradientColors';
import { loginViaAuthHub } from 'lib/authHub/redirect';
import { isDevBypass } from 'lib/authHub/devBypass';

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
            <h1
              style={{
                textAlign: 'center',
                marginBottom: '20px',
                color: 'var(--text-primary)',
              }}
            >
              Welcome
            </h1>

            {router.query.error ? (
              <>
                <p style={{ color: 'var(--error-color, red)', marginBottom: '24px', fontSize: '14px' }}>
                  {router.query.error_description?.toString() || router.query.error?.toString()}
                </p>
                <button
                  onClick={handleSignIn}
                  disabled={isRedirecting}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                    width: '100%',
                    padding: '12px 20px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: '#3E9B4F',
                    color: 'white',
                    cursor: isRedirecting ? 'default' : 'pointer',
                    fontSize: '15px',
                    fontWeight: 600,
                    opacity: isRedirecting ? 0.7 : 1,
                    transition: 'opacity 0.2s',
                  }}
                >
                  {isRedirecting ? 'Redirecting...' : 'Try Again'}
                </button>
              </>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <button
                  onClick={handleSignIn}
                  disabled={isRedirecting}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                    width: '100%',
                    padding: '12px 20px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: '#3E9B4F',
                    color: 'white',
                    cursor: isRedirecting ? 'default' : 'pointer',
                    fontSize: '15px',
                    fontWeight: 600,
                    opacity: isRedirecting ? 0.7 : 1,
                    transition: 'opacity 0.2s',
                  }}
                >
                  {isRedirecting ? 'Redirecting...' : 'Sign in'}
                </button>

                {isDevBypass() && (
                  <button
                    onClick={handleDevLogin}
                    style={{
                      width: '100%',
                      padding: '12px 20px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'transparent',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      fontSize: '14px',
                    }}
                  >
                    Dev Login (bypass)
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </GuestGuard>
  );
}
