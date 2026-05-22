import type { CSSProperties } from 'react';

const adminBadgeStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '3px',
  padding: '1px 6px',
  borderRadius: '4px',
  fontSize: '11px',
  fontWeight: 600,
  letterSpacing: '0.02em',
  textTransform: 'uppercase',
  backgroundColor: 'var(--accent-bg, rgba(59, 130, 246, 0.12))',
  color: 'var(--accent-color, #3b82f6)',
  verticalAlign: 'middle',
  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.04)',
};

export default function AdminBadge() {
  return (
    <span title='Verified support team member' style={adminBadgeStyle}>
      <svg
        width='11'
        height='11'
        viewBox='0 0 24 24'
        fill='none'
        stroke='currentColor'
        strokeWidth='3'
        strokeLinecap='round'
        strokeLinejoin='round'
        aria-hidden='true'
      >
        <path d='M12 2 4 6v6c0 5 3.5 9.5 8 10 4.5-.5 8-5 8-10V6l-8-4z' />
      </svg>
      Admin
    </span>
  );
}
