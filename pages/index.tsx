import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@hooks/useAuth';
import config from '@constants/config.json';
import ColorBlobBackground from '@components/ColorBlobBackground/ColorBlobBackground';

export default function HomePage() {
  const { isLoggedIn, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const entityId: string | undefined = (config as any).entity;

    if (isLoggedIn && entityId) {
      router.replace(`/entities/${encodeURIComponent(entityId)}`);
    } else {
      router.replace('/auth');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, isLoggedIn]);

  return (
    <ColorBlobBackground style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p>Loading...</p>
    </ColorBlobBackground>
  );
}
