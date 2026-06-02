import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@hooks/useAuth';
import { loadWhitelistedEntities } from '@utils/projects';
import GradientBand from '@components/GradientBand/GradientBand';
import { GRADIENT_COLORS } from '@constants/gradientColors';

export default function HomePage() {
  const { isLoggedIn, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    if (!isLoggedIn) {
      router.replace('/auth');
      return;
    }

    // Source the project list from the worker whitelist, then route based on it.
    let cancelled = false;
    void loadWhitelistedEntities().then((ids) => {
      if (cancelled) return;
      if (ids.length === 1) {
        router.replace(`/entities/${encodeURIComponent(ids[0])}`);
      } else {
        // 0 or many → the project list page (its empty state covers 0).
        router.replace('/entities');
      }
    });
    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, isLoggedIn]);

  return (
    <div style={{ position: 'relative', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <GradientBand {...GRADIENT_COLORS.auth} fullScreen />
      <p style={{ position: 'relative', zIndex: 1 }}>Loading...</p>
    </div>
  );
}
