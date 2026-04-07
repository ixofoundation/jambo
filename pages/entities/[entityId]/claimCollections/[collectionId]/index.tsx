import { useEffect } from 'react';
import { useRouter } from 'next/router';
import AuthGuard from '@components/AuthGuard';
import CollectionDetail from 'screens/collectionDetail';
import { BLACKLISTED_COLLECTION_IDS } from '@constants/common';

export default function CollectionPage() {
  const router = useRouter();
  const entityDid = router.query.entityId as string | undefined;
  const collectionId = router.query.collectionId as string | undefined;

  const isBlacklisted = collectionId && BLACKLISTED_COLLECTION_IDS.includes(collectionId);

  useEffect(() => {
    if (isBlacklisted && entityDid) {
      router.replace(`/entities/${entityDid}`);
    }
  }, [isBlacklisted, entityDid, router]);

  if (isBlacklisted) return null;

  return (
    <AuthGuard>
      {entityDid && collectionId ? (
        <CollectionDetail entityDid={entityDid} collectionId={collectionId} />
      ) : null}
    </AuthGuard>
  );
}
