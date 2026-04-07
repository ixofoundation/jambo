import { useEffect } from 'react';
import { useRouter } from 'next/router';
import AuthGuard from '@components/AuthGuard';
import CollectionForm from 'screens/collectionForm';
import { BLACKLISTED_COLLECTION_IDS } from '@constants/common';

export default function FormPage() {
  const router = useRouter();
  const entityDid = router.query.entityId as string | undefined;
  const collectionId = router.query.collectionId as string | undefined;
  const formType = router.query.formType as string | undefined;
  const claimId = router.query.claimId as string | undefined;

  const isBlacklisted = collectionId && BLACKLISTED_COLLECTION_IDS.includes(collectionId);

  useEffect(() => {
    if (isBlacklisted && entityDid) {
      router.replace(`/entities/${entityDid}`);
    }
  }, [isBlacklisted, entityDid, router]);

  const validTypes = ['vct', 'bco', 'bev', 'view'];
  if (isBlacklisted || !entityDid || !collectionId || !formType || !validTypes.includes(formType)) return null;

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
