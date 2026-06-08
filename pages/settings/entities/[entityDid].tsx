import { useRouter } from 'next/router';

import AuthGuard from '@components/AuthGuard';
import AdminGuard from '@components/AdminGuard';
import EntityCollectionsScreen from 'screens/entityCollections';

function pickString(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export default function EntityCollectionsPage() {
  const router = useRouter();
  const entityDid = pickString(router.query.entityDid);

  if (!router.isReady) return null;

  if (!entityDid) {
    return (
      <AuthGuard>
        <AdminGuard>
          <div
            style={{
              minHeight: '100vh',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 24px',
              textAlign: 'center',
              color: 'var(--text-secondary)',
            }}
          >
            No entity specified.
          </div>
        </AdminGuard>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <AdminGuard>
        <EntityCollectionsScreen entityDid={entityDid} />
      </AdminGuard>
    </AuthGuard>
  );
}
