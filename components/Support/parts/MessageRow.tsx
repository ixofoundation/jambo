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
  body: ReactNode;
};

const containerStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  padding: '4px 0 10px',
};

const headerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  flexWrap: 'wrap',
  marginBottom: '4px',
};

const senderNameStyle: CSSProperties = {
  fontSize: '14px',
  fontWeight: 400,
  color: 'var(--text-primary)',
  lineHeight: 1.2,
};

const MAX_SENDER_LABEL_LEN = 16;

function truncateSenderLabel(label: string): string {
  if (label.length <= MAX_SENDER_LABEL_LEN) return label;
  return `${label.slice(0, MAX_SENDER_LABEL_LEN)}…`;
}

const timestampStyle: CSSProperties = {
  fontSize: '10px',
  color: 'var(--text-secondary, #777)',
  opacity: 0.7,
  lineHeight: 1.2,
};

const bodyStyle: CSSProperties = {
  fontSize: '14px',
  lineHeight: 1.45,
  color: 'var(--text-primary)',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
};

export default function MessageRow({
  senderUserId,
  senderLabel,
  avatarUrl,
  timestamp,
  isAdmin,
  body,
}: MessageRowProps) {
  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <UserAvatar userId={senderUserId} displayName={senderLabel} avatarUrl={avatarUrl} size={20} />
        <span style={senderNameStyle} title={senderLabel}>
          {truncateSenderLabel(senderLabel)}
        </span>
        {isAdmin && <AdminBadge />}
        <span style={timestampStyle}>{formatTimeOfDay(timestamp)}</span>
      </div>
      <div style={bodyStyle}>{body}</div>
    </div>
  );
}
