import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@hooks/useAuth';
import ColorBlobBackground from '@components/ColorBlobBackground/ColorBlobBackground';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isLoggedIn, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isLoggedIn) {
      router.replace('/auth');
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

  if (!isLoggedIn) return null;
  return <>{children}</>;
}
