import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@hooks/useAuth';
import AuthLayout from '@components/AuthLayout/AuthLayout';
import Loader from '@components/Loader/Loader';

export default function GuestGuard({ children }: { children: React.ReactNode }) {
  const { isLoggedIn, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && isLoggedIn) {
      router.replace('/');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, isLoggedIn]);

  if (isLoading) {
    return (
      <AuthLayout>
        <Loader />
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Loading...</p>
      </AuthLayout>
    );
  }

  if (isLoggedIn) return null;
  return <>{children}</>;
}
