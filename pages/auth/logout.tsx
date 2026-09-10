import { useEffect, useRef } from 'react';

import { useAuth } from '@hooks/useAuth';
import GradientBand from '@components/GradientBand/GradientBand';
import { GRADIENT_COLORS } from '@constants/gradientColors';

/**
 * Sign out, as an address.
 *
 * Logout is a function on the auth provider, which is fine for Jambo's own
 * buttons and useless for the youth app under /cleanup — a separate app on
 * this domain that shares Jambo's login and has to be able to end it. This
 * page is that function with a URL: it ends the session (Matrix cleanup,
 * every stored secret, the youth app's record) and, as every logout does,
 * lands on the sign-in page. Nobody signed in just goes there.
 */
export default function LogoutPage() {
  const { isLoggedIn, isLoading, logout } = useAuth();
  const ranRef = useRef(false);

  useEffect(() => {
    if (isLoading || ranRef.current) return;
    ranRef.current = true;
    if (isLoggedIn) {
      void logout();
    } else {
      window.location.replace('/auth');
    }
  }, [isLoading, isLoggedIn, logout]);

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
      <p style={{ position: 'relative', zIndex: 1, color: 'var(--text-primary)', fontSize: 16 }}>Signing out...</p>
    </div>
  );
}
