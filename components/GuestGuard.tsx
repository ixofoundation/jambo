import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@hooks/useAuth';
import config from '@constants/config.json';
import GradientBand from '@components/GradientBand/GradientBand';
import { GRADIENT_COLORS } from '@constants/gradientColors';

export default function GuestGuard({ children }: { children: React.ReactNode }) {
  const { isLoggedIn, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && isLoggedIn) {
      const entityId: string | undefined = (config as any).entity;
      router.replace(entityId ? `/entities/${encodeURIComponent(entityId)}` : '/');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, isLoggedIn]);

  if (isLoading) {
    return (
      <div style={{ position: 'relative', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <GradientBand {...GRADIENT_COLORS.auth} fullScreen />
        <p style={{ position: 'relative', zIndex: 1 }}>Loading...</p>
      </div>
    );
  }

  if (isLoggedIn) return null;
  return <>{children}</>;
}
