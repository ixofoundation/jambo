import { useState } from 'react';
import { useRouter } from 'next/router';

import GuestGuard from '@components/GuestGuard';
import GradientBand from '@components/GradientBand/GradientBand';
import AuthHeader from '@components/AuthHeader/AuthHeader';
import { GRADIENT_COLORS } from '@constants/gradientColors';
import { redirectToSSO } from 'lib/sso/redirect';

export default function AuthPage() {
  const router = useRouter();
  const [isRedirecting, setIsRedirecting] = useState(false);

  function handleSignIn() {
    setIsRedirecting(true);
    void redirectToSSO();
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
                  <img src='/images/yoma_icon.png' alt='Yoma' width={22} height={22} />
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
                    justifyContent: 'space-between',
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
                  <div style={{ width: '24px', height: '24px' }}>
                    <img src='/images/yoma_icon.png' alt='Yoma' width={'100%'} height={'100%'} />
                  </div>
                  {isRedirecting ? 'Redirecting...' : 'Sign in with Yoma'}
                  <div />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </GuestGuard>
  );
}
