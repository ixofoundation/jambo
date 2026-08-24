import type { CSSProperties } from 'react';

type UserAvatarProps = {
  userId: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  size?: number;
};

function initialFor(displayName: string | null | undefined, userId: string): string {
  const source = (displayName ?? userId).trim();
  if (!source) return '?';
  // Strip a leading "@" if it's a matrix user id like "@alice:server"
  const stripped = source.startsWith('@') ? source.slice(1) : source;
  return (stripped.charAt(0) || '?').toUpperCase();
}

const baseCircleStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: '50%',
  overflow: 'hidden',
  flex: '0 0 auto',
  userSelect: 'none',
};

export default function UserAvatar({ userId, displayName, avatarUrl, size = 32 }: UserAvatarProps) {
  const style: CSSProperties = {
    ...baseCircleStyle,
    width: size,
    height: size,
    backgroundColor: avatarUrl ? 'transparent' : 'var(--purple-primary)',
    color: 'var(--purple-ink)',
    fontSize: Math.max(11, Math.round(size * 0.42)),
    fontWeight: 600,
    lineHeight: 1,
  };

  if (avatarUrl) {
    return (
      <span style={style} aria-hidden='true'>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={avatarUrl}
          alt=''
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </span>
    );
  }

  return (
    <span style={style} aria-hidden='true'>
      {initialFor(displayName, userId)}
    </span>
  );
}
