import { ProtocolCollection } from '@hooks/useProtocolCollections';
import CollectionListItem from '@components/CollectionListItem/CollectionListItem';

type CollectionListProps = {
  collections: ProtocolCollection[];
  loading: boolean;
  onSelect: (collectionId: string) => void;
};

export default function CollectionList({ collections, loading, onSelect }: CollectionListProps) {
  return (
    <>
      {loading ? (
        <p style={{ margin: 0, fontSize: '14px', color: 'var(--muted-font-color)' }}>Loading collections...</p>
      ) : collections.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {collections.map((c) => (
            <CollectionListItem key={c.collectionId} collection={c} onClick={onSelect} />
          ))}
        </div>
      ) : (
        <p style={{ margin: 0, fontSize: '14px', color: 'var(--muted-font-color)' }}>No collections found</p>
      )}
    </>
  );
}
