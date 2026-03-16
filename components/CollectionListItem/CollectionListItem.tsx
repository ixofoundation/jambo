import { ProtocolCollection } from '@hooks/useProtocolCollections';

type CollectionListItemProps = {
  collection: ProtocolCollection;
  onClick: (collectionId: string) => void;
};

export default function CollectionListItem({ collection: c, onClick }: CollectionListItemProps) {
  return (
    <button
      onClick={() => onClick(c.collectionId)}
      style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        border: 'none',
        borderRadius: '8px',
        padding: '16px',
        paddingRight: '12px',
        backgroundColor: 'var(--card-bg-color)',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'background-color 0.2s',
        width: '100%',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = 'var(--card-bg-hover-color)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'var(--card-bg-color)';
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
        <span
          style={{
            fontWeight: 500,
            fontSize: '14px',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {c.formName || `Collection ${c.collectionId}`}
        </span>
        {(c.startDate || c.endDate) && (
          <span style={{ fontSize: '12px', color: 'var(--muted-font-color)', marginTop: '4px' }}>
            {c.endDate && new Date(c.endDate) < new Date()
              ? `End Date: ${new Date(c.endDate).toLocaleDateString()}`
              : c.startDate
              ? `Start Date: ${new Date(c.startDate).toLocaleDateString()}`
              : null}
          </span>
        )}
      </div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          flexShrink: 0,
          marginLeft: '16px',
        }}
      >
        <span style={{ fontSize: '14px', fontWeight: 500 }}>
          {c.count ?? 0}
          {c.quota ? `/${c.quota}` : ''}
        </span>
        <span style={{ fontSize: '11px', color: 'var(--muted-font-color)' }}>Submissions</span>
      </div>
      <svg
        width='20'
        height='20'
        viewBox='0 0 24 24'
        fill='none'
        stroke='currentColor'
        strokeWidth='2'
        strokeLinecap='round'
        strokeLinejoin='round'
        style={{ flexShrink: 0, marginLeft: '8px', color: 'var(--muted-font-color)' }}
      >
        <polyline points='9 18 15 12 9 6' />
      </svg>
    </button>
  );
}
