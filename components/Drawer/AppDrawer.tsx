import { useRouter } from 'next/router';
import { useAuth } from '@hooks/useAuth';
import { useAppSelector } from '@store/hooks';
import { Drawer } from './Drawer';

export default function AppDrawer() {
  const router = useRouter();
  const { address } = useAuth();
  const matrixProfile = useAppSelector((state) => state.matrixProfile);

  const displayName = matrixProfile.displayName
    || (address ? `${address.slice(0, 10)}...${address.slice(-4)}` : null);

  return (
    <Drawer
      onNavigate={(path) => router.push(path)}
      currentPath={router.pathname}
      displayName={displayName}
      avatarUrl={matrixProfile.avatarUrl}
    />
  );
}
