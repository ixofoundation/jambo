import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@hooks/useAuth';
import AuthLayout from '@components/AuthLayout/AuthLayout';
import Loader from '@components/Loader/Loader';

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
      <AuthLayout>
        <Loader />
      </AuthLayout>
    );
  }

  if (!isLoggedIn) return null;
  return <>{children}</>;
}
