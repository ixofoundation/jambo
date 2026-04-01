import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

import { useAuth } from '@hooks/useAuth';
import { handleAuthCallback } from 'lib/authHub/redirect';
import { isDevBypass, getDevBypassSession } from 'lib/authHub/devBypass';
import GradientBand from '@components/GradientBand/GradientBand';
import AuthHeader from '@components/AuthHeader/AuthHeader';
import { GRADIENT_COLORS } from '@constants/gradientColors';

export default function AuthCallbackPage() {
  const router = useRouter();
  const auth = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        let sessionData;

        if (isDevBypass() && router.query.bypass === 'true') {
          sessionData = getDevBypassSession();
        } else {
          sessionData = await handleAuthCallback();
        }

        if (!sessionData) {
          setError('No authorization code received');
          return;
        }

        auth.loginWithAuthHub(sessionData);
        router.replace('/');
      } catch (err) {
        console.error('Auth callback failed:', err);
        setError(err instanceof Error ? err.message : 'Authentication failed');
      }
    })();
  }, []);

  if (error) {
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
            <h2 style={{ color: 'var(--text-primary)', marginBottom: '16px' }}>Authentication Failed</h2>
            <p style={{ color: 'var(--error-color, red)', marginBottom: '24px', fontSize: '14px' }}>{error}</p>
            <button
              onClick={() => router.push('/auth')}
              style={{
                width: '100%',
                padding: '12px 20px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: '#3E9B4F',
                color: 'white',
                cursor: 'pointer',
                fontSize: '15px',
                fontWeight: 600,
              }}
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'relative',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <GradientBand {...GRADIENT_COLORS.auth} fullScreen />
      <div style={{ textAlign: 'center', zIndex: 1 }}>
        <div
          style={{
            width: 48,
            height: 48,
            border: '3px solid var(--border-color)',
            borderTopColor: 'var(--accent-color, #3b82f6)',
            borderRadius: '50%',
            animation: 'callbackSpinner 0.8s linear infinite',
            margin: '0 auto 16px',
          }}
        />
        <p style={{ color: 'var(--text-primary)', fontSize: 16 }}>Completing sign in...</p>
        <style>{`
          @keyframes callbackSpinner {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  );
}
