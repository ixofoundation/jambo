import type { CSSProperties, ReactNode } from 'react';

import AdminBadge from './AdminBadge';
import UserAvatar from './UserAvatar';
import { formatTimeOfDay } from '../format';

type MessageRowProps = {
  senderUserId: string;
  senderLabel: string;
  avatarUrl?: string | null;
  timestamp: number;
  isAdmin?: boolean;
  /** Styling only: my messages render as aubergine bubbles on the right. */
  isMine?: boolean;
  body: ReactNode;
};

const containerStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  padding: '3px 0 9px',
};

const containerMineStyle: CSSProperties = {
  ...containerStyle,
  alignItems: 'flex-end',
};

const headerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  flexWrap: 'wrap',
  marginBottom: '4px',
};

const senderNameStyle: CSSProperties = {
  fontSize: '13.5px',
  fontWeight: 600,
  color: 'var(--text-secondary)',
  lineHeight: 1.2,
};

const MAX_SENDER_LABEL_LEN = 16;

function truncateSenderLabel(label: string): string {
  if (label.length <= MAX_SENDER_LABEL_LEN) return label;
  return `${label.slice(0, MAX_SENDER_LABEL_LEN)}…`;
}

const timestampStyle: CSSProperties = {
  fontSize: '11px',
  color: 'var(--text-secondary)',
  opacity: 0.8,
  lineHeight: 1.2,
};

// Bubble shells — them: quiet surface; me: aubergine with light ink.
const bodyStyle: CSSProperties = {
  maxWidth: '82%',
  padding: '12px 15px',
  borderRadius: '16px',
  borderBottomLeftRadius: '4px',
  backgroundColor: 'var(--surface-2)',
  fontSize: '15.5px',
  lineHeight: 1.5,
  color: 'var(--text-primary)',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
};

const bodyMineStyle: CSSProperties = {
  ...bodyStyle,
  borderBottomLeftRadius: '16px',
  borderBottomRightRadius: '4px',
  backgroundColor: 'var(--purple-primary)',
  color: 'var(--purple-ink)',
};

export default function MessageRow({
  senderUserId,
  senderLabel,
  avatarUrl,
  timestamp,
  isAdmin,
  isMine,
  body,
}: MessageRowProps) {
  return (
    <div style={isMine ? containerMineStyle : containerStyle}>
      <div style={headerStyle}>
        {!isMine && <UserAvatar userId={senderUserId} displayName={senderLabel} avatarUrl={avatarUrl} size={20} />}
        <span style={senderNameStyle} title={senderLabel}>
          {truncateSenderLabel(senderLabel)}
        </span>
        {isAdmin && <AdminBadge />}
        <span style={timestampStyle}>{formatTimeOfDay(timestamp)}</span>
      </div>
      <div style={isMine ? bodyMineStyle : bodyStyle}>{body}</div>
    </div>
  );
}
