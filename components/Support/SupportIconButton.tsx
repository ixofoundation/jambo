import { MouseEventHandler } from 'react';

type SupportIconButtonProps = {
  onClick: MouseEventHandler<HTMLButtonElement>;
  title?: string;
  hasUnread?: boolean;
};

const buttonStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '32px',
  height: '32px',
  borderRadius: '8px',
  border: '1px solid var(--border-color)',
  backgroundColor: 'transparent',
  color: 'var(--text-primary)',
  cursor: 'pointer',
  padding: 0,
  flex: '0 0 auto',
  position: 'relative',
} as const;

const unreadDotStyle = {
  position: 'absolute',
  top: '-2px',
  right: '-2px',
  width: '10px',
  height: '10px',
  borderRadius: '50%',
  backgroundColor: 'var(--error-color, #e54545)',
  border: '2px solid var(--bg-secondary, #fff)',
  boxSizing: 'content-box',
} as const;

export default function SupportIconButton({
  onClick,
  title = 'Contact support',
  hasUnread = false,
}: SupportIconButtonProps) {
  const fullTitle = hasUnread ? `${title} — new activity` : title;
  return (
    <button type='button' onClick={onClick} aria-label={fullTitle} title={fullTitle} style={buttonStyle}>
      <svg
        width='16'
        height='16'
        viewBox='0 0 24 24'
        fill='none'
        stroke='currentColor'
        strokeWidth='2'
        strokeLinecap='round'
        strokeLinejoin='round'
        aria-hidden='true'
      >
        <path d='M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z' />
        <line x1='12' y1='11' x2='12' y2='11' />
        <line x1='8' y1='11' x2='8' y2='11' />
        <line x1='16' y1='11' x2='16' y2='11' />
      </svg>
      {hasUnread && <span aria-hidden='true' style={unreadDotStyle} />}
    </button>
  );
}
