import { useRouter } from 'next/router';
import AuthGuard from '@components/AuthGuard';
import CollectionForm from 'screens/collectionForm';

export default function FormPage() {
  const router = useRouter();
  const entityDid = router.query.entityId as string | undefined;
  const collectionId = router.query.collectionId as string | undefined;
  const formType = router.query.formType as string | undefined;
  const claimId = router.query.claimId as string | undefined;

  const validTypes = ['vct', 'bco', 'bev', 'view'];
  if (!entityDid || !collectionId || !formType || !validTypes.includes(formType)) return null;

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
