import { ProtocolCollection } from '@hooks/useProtocolCollections';

type ClaimStatsProps = {
  collections: ProtocolCollection[];
};

export default function ClaimStats({ collections }: ClaimStatsProps) {
  const stats = collections.reduce(
    (acc, c) => ({
      submitted: acc.submitted + (c.count ?? 0),
      approved: acc.approved + (c.approved ?? 0),
      disputed: acc.disputed + (c.disputed ?? 0),
      rejected: acc.rejected + (c.rejected ?? 0),
    }),
    { submitted: 0, approved: 0, disputed: 0, rejected: 0 },
  );

  return (
    <div>
      <p style={{ margin: '0 0 12px', fontWeight: 500, fontSize: '16px' }}>My Claims</p>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: '12px',
        }}
      >
        {(
          [
            { label: 'Submitted', value: stats.submitted },
            { label: 'Approved', value: stats.approved },
            { label: 'Disputed', value: stats.disputed },
            { label: 'Rejected', value: stats.rejected },
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
    </div>
  );
}
