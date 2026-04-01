import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@hooks/useAuth';
import { useAppDispatch } from '@store/hooks';
import { addProject } from '@store/slices/projectsSlice';
import config from '@constants/config.json';
import AuthLayout from '@components/AuthLayout/AuthLayout';
import Loader from '@components/Loader/Loader';

export default function HomePage() {
  const { isLoggedIn, isLoading } = useAuth();
  const router = useRouter();
  const dispatch = useAppDispatch();

  useEffect(() => {
    if (isLoading) return;

    if (!isLoggedIn) {
      router.replace('/auth');
      return;
    }

    // Seed default project if configured
    const defaultEntityId: string | undefined = process.env.NEXT_PUBLIC_DEFAULT_ENTITY || (config as any).entity;
    if (defaultEntityId) {
      dispatch(addProject(defaultEntityId));
    }

    router.replace('/entities');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, isLoggedIn]);

  return (
    <AuthLayout>
      <Loader />
    </AuthLayout>
  );
}
