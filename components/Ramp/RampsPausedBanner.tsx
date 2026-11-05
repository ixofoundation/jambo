import type { CSSProperties } from 'react';

import { RAMPS_PAUSED, RAMPS_PAUSED_MESSAGE } from '@constants/yellowcard';

/**
 * The calm notice shown while the YellowCard ramps are paused
 * (constants/yellowcard `RAMPS_PAUSED`). Renders nothing otherwise.
 */
export default function RampsPausedBanner({ style }: { style?: CSSProperties }) {
  if (!RAMPS_PAUSED) return null;
  return (
    <div
      role='status'
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--warning-border)',
        borderRadius: 14,
        padding: '12px 14px',
        fontSize: 14.5,
        lineHeight: 1.45,
        color: 'var(--text-primary)',
        ...style,
      }}
    >
      {RAMPS_PAUSED_MESSAGE}
    </div>
  );
}
