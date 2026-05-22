import { formatDayDivider } from '../format';

type DateDividerProps = {
  timestamp: number;
};

export default function DateDivider({ timestamp }: DateDividerProps) {
  return (
    <div
      role='separator'
      aria-label={formatDayDivider(timestamp)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        margin: '16px 0 8px',
        color: 'var(--text-secondary, #777)',
        fontSize: '11px',
        fontWeight: 500,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
      }}
    >
      <span style={{ flex: 1, height: 1, backgroundColor: 'var(--border-color)' }} />
      <span>{formatDayDivider(timestamp)}</span>
      <span style={{ flex: 1, height: 1, backgroundColor: 'var(--border-color)' }} />
    </div>
  );
}
