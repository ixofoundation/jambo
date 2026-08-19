import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@hooks/useAuth';
import { saveReturnTo } from '@utils/returnTo';
import GradientBand from '@components/GradientBand/GradientBand';
import { GRADIENT_COLORS } from '@constants/gradientColors';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isLoggedIn, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // On statically-optimized dynamic routes, router.asPath is the literal
    // pattern ("/entities/[entityId]") until hydration completes — wait for
    // isReady so we save the real URL, not the placeholder.
    if (!router.isReady) return;
    if (!isLoading && !isLoggedIn) {
      // Remember the deep link (e.g. a Yoma hand-off to /entities/<did>) so
      // the auth callback can land the user back here instead of home.
      saveReturnTo(router.asPath);
      router.replace('/auth');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, isLoggedIn, router.isReady]);

  if (isLoading) {
    return (
      <div style={{ position: 'relative', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <GradientBand {...GRADIENT_COLORS.dashboard} />
        <p style={{ position: 'relative', zIndex: 1 }}>Loading...</p>
      </div>
    );
  }

  if (!isLoggedIn) return null;
  return <>{children}</>;
}
