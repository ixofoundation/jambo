import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@hooks/useAuth';
import config from '@constants/config.json';
import ColorBlobBackground from '@components/ColorBlobBackground/ColorBlobBackground';

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
      <ColorBlobBackground style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p>Loading...</p>
      </ColorBlobBackground>
    );
  }

  if (isLoggedIn) return null;
  return <>{children}</>;
}
