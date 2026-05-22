import { useRouter } from 'next/router';

import AuthGuard from '@components/AuthGuard';
import SupportDmScreen from 'screens/supportDm';

function pickString(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export default function SupportDmPage() {
  const router = useRouter();
  const entityDid = pickString(router.query.entityDid);
  const roomId = pickString(router.query.roomId);

  if (!router.isReady) return null;
  if (!entityDid || !roomId) {
    void router.replace('/profile');
    return null;
  }

  return (
    <AuthGuard>
      <SupportDmScreen entityDid={entityDid} roomId={roomId} />
    </AuthGuard>
  );
}
