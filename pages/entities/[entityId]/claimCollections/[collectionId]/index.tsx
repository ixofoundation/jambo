import { useEffect } from 'react';
import { useRouter } from 'next/router';
import AuthGuard from '@components/AuthGuard';
import CollectionDetail from 'screens/collectionDetail';
import useIsCollectionBlacklisted from '@hooks/useIsCollectionBlacklisted';

export default function CollectionPage() {
  const router = useRouter();
  const entityDid = router.query.entityId as string | undefined;
  const collectionId = router.query.collectionId as string | undefined;

  const isBlacklisted = useIsCollectionBlacklisted(entityDid, collectionId);

  useEffect(() => {
    if (isBlacklisted === true && entityDid) {
      router.replace(`/entities/${entityDid}`);
    }
  }, [isBlacklisted, entityDid, router]);

  // Render only once confirmed not blacklisted (avoids flashing hidden content).
  if (isBlacklisted !== false) return null;

  return (
    <AuthGuard>
      {entityDid && collectionId ? (
        <CollectionDetail entityDid={entityDid} collectionId={collectionId} />
      ) : null}
    </AuthGuard>
  );
}
