import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@hooks/useAuth';
import { saveReturnTo, takeReturnTo } from '@utils/returnTo';
import GradientBand from '@components/GradientBand/GradientBand';
import { GRADIENT_COLORS } from '@constants/gradientColors';

export default function GuestGuard({ children }: { children: React.ReactNode }) {
  const { isLoggedIn, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!router.isReady) return;
    if (!isLoading && isLoggedIn) {
      // Already signed in: back to where they were heading, not home. The
      // youth app under /cleanup arrives with `?returnTo=`; a saved deep link
      // counts too. Full navigation, because the destination may not be one
      // of this app's pages at all.
      const back = router.query.returnTo;
      if (typeof back === 'string') saveReturnTo(back);
      window.location.replace(takeReturnTo() ?? '/');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, isLoggedIn, router.isReady]);

  if (isLoading) {
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
        <p style={{ position: 'relative', zIndex: 1 }}>Loading...</p>
      </div>
    );
  }

  if (isLoggedIn) return null;
  return <>{children}</>;
}
