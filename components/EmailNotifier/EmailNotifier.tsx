import { useMemo, type ReactNode } from 'react';

import useEmailNotifier from '@hooks/useEmailNotifier';

const STATUS_NOTE: Record<string, string> = {
  unsubscribed: 'You unsubscribed. Subscribe again to resume email notifications.',
  expired: 'Your subscription expired. Resubscribe to resume email notifications.',
  exhausted: 'Email delivery was paused after repeated failures. Resubscribe to resume.',
};

export default function EmailNotifier() {
  const { configured, events, subscription, loading, mutating, error, refresh, subscribe, setPreference, unsubscribe } =
    useEmailNotifier(true);

  const preferenceMap = useMemo(() => {
    const map = new Map<string, boolean>();
    if (subscription) {
      for (const pref of subscription.preferences) map.set(pref.event_type, pref.enabled);
    }
    return map;
  }, [subscription]);

  // Hide the section entirely when the feature isn't configured for this build.
  if (!configured) return null;

  const isActive = subscription?.status === 'active';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '0 4px' }}>
      <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>
        Receive email notifications for on-chain events linked to your account, sent to your registered email.
      </p>

      {loading && <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Loading…</span>}

      {!loading && error && (
        <StatusRow status={<StatusLabel text="Couldn't load" color='var(--error-color)' kind='cross' />}>
          <Chip label='Try again' onClick={refresh} />
        </StatusRow>
      )}

      {/* The subscribe/unsubscribe action is always the first item — on the
          right of a row whose left shows the subscription status; preferences
          (when subscribed) render beneath it. */}
      {!loading && !error && !isActive && (
        <>
          <StatusRow status={<StatusLabel text='Unsubscribed' color='var(--error-color)' kind='cross' />}>
            <Chip label={mutating ? 'Subscribing…' : 'Subscribe'} onClick={subscribe} disabled={mutating} />
          </StatusRow>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            {subscription?.status && STATUS_NOTE[subscription.status]
              ? STATUS_NOTE[subscription.status]
              : "We'll send a welcome email after you subscribe — use the link in it to unsubscribe at any time."}
          </span>
        </>
      )}

      {!loading && !error && isActive && (
        <>
          <StatusRow status={<StatusLabel text='Subscribed' color='var(--green-primary)' kind='check' />}>
            <Chip label={mutating ? 'Working…' : 'Unsubscribe'} onClick={() => void unsubscribe()} disabled={mutating} />
          </StatusRow>

          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            Toggle which events email you below.
          </span>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {events.map((event) => {
              const checked = preferenceMap.get(event.event_type) ?? event.default_enabled;
              return (
                <div
                  key={event.event_type}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                    <span style={{ fontSize: '14px', color: 'var(--text-primary)' }}>{event.label}</span>
                    {event.description && (
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{event.description}</span>
                    )}
                  </div>
                  <Chip
                    label={checked ? 'Enabled' : 'Disabled'}
                    icon={
                      <StatusGlyph
                        kind={checked ? 'check' : 'cross'}
                        color={checked ? 'var(--green-primary)' : 'var(--error-color)'}
                      />
                    }
                    onClick={() => void setPreference(event.event_type, !checked)}
                    disabled={mutating}
                  />
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// Mirrors the `Row` + chip layout used across the settings page: a status label
// on the left, a clickable chip on the right.
// Status icon paths (Material Symbols), matching the claim approved/rejected
// badges in SubclaimModal.
const CHECK_PATH = 'M382-200 113-469l57-57 212 212 408-408 57 57-465 465Z';
const CROSS_PATH = 'm256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z';

// A normal-colored status label with a colored circular check/cross badge to its
// right — same visual language as the claim status badges in SubclaimModal.
function StatusLabel({ text, color, kind }: { text: string; color: string; kind: 'check' | 'cross' }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', color: 'var(--text-primary)' }}>
      {text}
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '14px',
          height: '14px',
          borderRadius: '50%',
          flexShrink: 0,
          border: `1px solid ${color}`,
          background: `color-mix(in srgb, ${color} 12%, transparent)`,
        }}
      >
        <svg viewBox='0 -960 960 960' width='10' height='10' aria-hidden='true' style={{ display: 'block' }}>
          <path
            d={kind === 'check' ? CHECK_PATH : CROSS_PATH}
            fill={color}
            stroke={color}
            strokeWidth={60}
            paintOrder='stroke fill'
            strokeLinejoin='round'
            strokeLinecap='round'
          />
        </svg>
      </span>
    </span>
  );
}

function StatusRow({ status, children }: { status: ReactNode; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
      <span style={{ fontSize: '14px', color: 'var(--text-primary)' }}>{status}</span>
      {children}
    </div>
  );
}

function Chip({
  label,
  onClick,
  disabled,
  icon,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  icon?: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        borderRadius: 'var(--card-border-radius)',
        border: 'none',
        background: 'var(--card-bg-color)',
        padding: '5px 12px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        cursor: disabled ? 'default' : 'pointer',
        color: 'var(--text-primary)',
        fontSize: '13px',
        fontWeight: 500,
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {label}
      {icon}
    </button>
  );
}

// Plain (un-circled) check/cross glyph for use inside chips.
function StatusGlyph({ kind, color }: { kind: 'check' | 'cross'; color: string }) {
  return (
    <svg viewBox='0 -960 960 960' width={14} height={14} aria-hidden='true' style={{ flexShrink: 0, display: 'block' }}>
      <path
        d={kind === 'check' ? CHECK_PATH : CROSS_PATH}
        fill={color}
        stroke={color}
        strokeWidth={40}
        paintOrder='stroke fill'
        strokeLinejoin='round'
        strokeLinecap='round'
      />
    </svg>
  );
}

