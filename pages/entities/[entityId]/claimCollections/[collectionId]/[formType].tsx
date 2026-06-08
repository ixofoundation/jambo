import { useEffect } from 'react';
import { useRouter } from 'next/router';
import AuthGuard from '@components/AuthGuard';
import CollectionForm from 'screens/collectionForm';
import useIsCollectionBlacklisted from '@hooks/useIsCollectionBlacklisted';

export default function FormPage() {
  const router = useRouter();
  const entityDid = router.query.entityId as string | undefined;
  const collectionId = router.query.collectionId as string | undefined;
  const formType = router.query.formType as string | undefined;
  const claimId = router.query.claimId as string | undefined;

  const isBlacklisted = useIsCollectionBlacklisted(entityDid, collectionId);

  useEffect(() => {
    if (isBlacklisted === true && entityDid) {
      router.replace(`/entities/${entityDid}`);
    }
  }, [isBlacklisted, entityDid, router]);

  // Render only once confirmed not blacklisted (avoids flashing hidden content).
  const validTypes = ['vct', 'bco', 'bev', 'view'];
  if (isBlacklisted !== false || !entityDid || !collectionId || !formType || !validTypes.includes(formType)) {
    return null;
  }

  return (
    <AuthGuard>
      <CollectionForm
        entityDid={entityDid}
        collectionId={collectionId}
        formType={formType as 'vct' | 'bco' | 'bev' | 'view'}
        claimId={claimId}
      />
    </AuthGuard>
  );
}
