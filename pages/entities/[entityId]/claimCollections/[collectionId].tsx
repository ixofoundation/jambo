import { useRouter } from 'next/router';
import AuthGuard from '@components/AuthGuard';
import CollectionDetail from 'screens/collectionDetail';

export default function CollectionPage() {
  const router = useRouter();
  const entityDid = router.query.entityId as string | undefined;
  const collectionId = router.query.collectionId as string | undefined;

  return (
    <AuthGuard>
      {entityDid && collectionId ? (
        <CollectionDetail entityDid={entityDid} collectionId={collectionId} />
      ) : null}
    </AuthGuard>
  );
}
