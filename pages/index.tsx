import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@hooks/useAuth';
import config from '@constants/config.json';
import GradientBand from '@components/GradientBand/GradientBand';
import { GRADIENT_COLORS } from '@constants/gradientColors';

export default function HomePage() {
  const { isLoggedIn, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const entityId: string | undefined = process.env.NEXT_PUBLIC_DEFAULT_ENTITY || (config as any).entity;

    if (isLoggedIn && entityId) {
      router.replace(`/entities/${encodeURIComponent(entityId)}`);
    } else {
      router.replace('/auth');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, isLoggedIn]);

  return (
    <div style={{ position: 'relative', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <GradientBand {...GRADIENT_COLORS.auth} fullScreen />
      <p style={{ position: 'relative', zIndex: 1 }}>Loading...</p>
    </div>
  );
}
