import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@hooks/useAuth';
import { useAppSelector, useAppDispatch } from '@store/hooks';
import { addProject } from '@store/slices/projectsSlice';
import config from '@constants/config.json';
import GradientBand from '@components/GradientBand/GradientBand';
import { GRADIENT_COLORS } from '@constants/gradientColors';

export default function HomePage() {
  const { isLoggedIn, isLoading } = useAuth();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const projectIds = useAppSelector((state) => state.projects.ids);

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

    // Read latest project list (including the just-seeded default)
    // Use a microtask to ensure the dispatch above has been processed
    setTimeout(() => {
      const ids = [...projectIds];
      if (defaultEntityId && !ids.includes(defaultEntityId)) {
        ids.push(defaultEntityId);
      }

      if (ids.length === 1) {
        router.replace(`/entities/${encodeURIComponent(ids[0])}`);
      } else if (ids.length > 1) {
        router.replace('/entities');
      } else if (defaultEntityId) {
        router.replace(`/entities/${encodeURIComponent(defaultEntityId)}`);
      } else {
        router.replace('/auth');
      }
    }, 0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, isLoggedIn]);

  return (
    <div style={{ position: 'relative', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <GradientBand {...GRADIENT_COLORS.auth} fullScreen />
      <p style={{ position: 'relative', zIndex: 1 }}>Loading...</p>
    </div>
  );
}
