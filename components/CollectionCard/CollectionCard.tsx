import { FC } from 'react';
import { useRouter } from 'next/router';
import styles from './CollectionCard.module.scss';

type CollectionCardProps = {
  entityDid: string;
  collectionId: string;
  formName?: string;
  count?: number;
};

const CollectionCard: FC<CollectionCardProps> = ({ entityDid, collectionId, formName, count }) => {
  const router = useRouter();

  return (
    <button
      className={styles.card}
      onClick={() => router.push(`/entities/${encodeURIComponent(entityDid)}/claimCollections/${encodeURIComponent(collectionId)}`)}
    >
      <p className={styles.name}>{formName || `Collection ${collectionId}`}</p>
      {count != null && <span className={styles.meta}>{count} submission{count !== 1 ? 's' : ''}</span>}
    </button>
  );
};

export default CollectionCard;
