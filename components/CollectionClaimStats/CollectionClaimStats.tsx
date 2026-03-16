import { ProtocolCollection } from '@hooks/useProtocolCollections';

type CollectionClaimStatsProps = {
  collection: ProtocolCollection;
};

export default function CollectionClaimStats({ collection }: CollectionClaimStatsProps) {
  const submitted = collection.count ?? 0;
  const approved = collection.approved ?? 0;
  const disputed = collection.disputed ?? 0;
  const rejected = collection.rejected ?? 0;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: '12px',
      }}
    >
      {(
        [
          { label: 'Submitted', value: submitted },
          { label: 'Approved', value: approved },
          { label: 'Disputed', value: disputed },
          { label: 'Rejected', value: rejected },
        ] as const
      ).map((stat) => (
        <div
          key={stat.label}
          style={{
            border: 'none',
            borderRadius: '8px',
            padding: '16px',
            backgroundColor: 'var(--card-bg-color)',
            textAlign: 'center',
          }}
        >
          <p style={{ margin: 0, fontSize: '24px', fontWeight: 600, color: 'var(--main-font-color)' }}>{stat.value}</p>
          <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--muted-font-color)' }}>{stat.label}</p>
        </div>
      ))}
    </div>
  );
}
