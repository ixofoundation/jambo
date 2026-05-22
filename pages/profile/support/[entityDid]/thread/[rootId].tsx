import { useRouter } from 'next/router';

import AuthGuard from '@components/AuthGuard';
import SupportThreadScreen from 'screens/supportThread';

function pickString(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export default function SupportThreadPage() {
  const router = useRouter();
  const entityDid = pickString(router.query.entityDid);
  const rootId = pickString(router.query.rootId);

  if (!router.isReady) return null;
  if (!entityDid || !rootId) {
    void router.replace('/profile');
    return null;
  }

  return (
    <AuthGuard>
      <SupportThreadScreen entityDid={entityDid} rootId={rootId} />
    </AuthGuard>
  );
}
