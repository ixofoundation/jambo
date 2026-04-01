import { FC } from 'react';
import { useRouter } from 'next/router';
import { useAppSelector } from '@store/hooks';
import { useProtocolCollections } from '@hooks/useProtocolCollections';
import CollectionCard from '@components/CollectionCard/CollectionCard';
import styles from './ProjectSection.module.scss';

type ProjectSectionProps = {
  entityDid: string;
};

const ProjectSection: FC<ProjectSectionProps> = ({ entityDid }) => {
  const router = useRouter();
  const profile = useAppSelector((state) => state.profiles.byEntityDid[entityDid]);
  const { collections, loading } = useProtocolCollections(entityDid);

  return (
    <section>
      <button
        className={styles.header}
        onClick={() => router.push(`/entities/${encodeURIComponent(entityDid)}`)}
      >
        {profile?.name || entityDid}
        <svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.5' strokeLinecap='round' strokeLinejoin='round'>
          <polyline points='9 18 15 12 9 6' />
        </svg>
      </button>
      {loading ? (
        <p className={styles.loading}>Loading collections...</p>
      ) : collections.length > 0 ? (
        <div className={styles.scroll}>
          {collections.map((c) => (
            <CollectionCard
              key={c.collectionId}
              entityDid={entityDid}
              collectionId={c.collectionId}
              formName={c.formName}
              count={c.count}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
};

export default ProjectSection;
