import { useEffect, useState } from 'react';

import useAnalyticsConsent from '@hooks/useAnalyticsConsent';

// Let the first paint settle before the banner appears for genuinely
// undecided users — it must never take part in the initial render rush.
const SHOW_DELAY_MS = 1000;

/**
 * Bottom-sheet consent prompt, mounted once in `_app`. Renders nothing unless
 * analytics is configured for this build AND the user has not yet decided.
 * Nothing is captured until "Accept" — see lib/analytics/client.ts.
 */
export default function AnalyticsConsentBanner() {
  const { isUndecided, isAvailable, grant, revoke } = useAnalyticsConsent();
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    if (!isUndecided) {
      setShowBanner(false);
      return;
    }
    const timer = setTimeout(() => setShowBanner(true), SHOW_DELAY_MS);
    return () => clearTimeout(timer);
  }, [isUndecided]);

  if (!isAvailable || !isUndecided || !showBanner) return null;

  return (
    <div
      role='dialog'
      aria-label='Privacy and analytics'
      style={{
        position: 'fixed',
        left: 20,
        right: 20,
        // Clear the floating dock pill so neither control covers the other.
        bottom: 'var(--dock-clearance, 96px)',
        maxWidth: 560,
        margin: '0 auto',
        zIndex: 2100,
      }}
    >
      <div
        style={{
          borderRadius: 16,
          padding: '18px 20px',
          backgroundColor: 'var(--bg-secondary)',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.18)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <h2 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
            Privacy and analytics
          </h2>
          <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.5, color: 'var(--text-primary)', opacity: 0.8 }}>
            We use PostHog to see which pages and features are used so we can improve JAMBO. When you are signed in this
            includes your DID, wallet address and Matrix ID, never your message content.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px' }}>
          <button
            type='button'
            onClick={revoke}
            style={{
              padding: '10px 16px',
              border: 'none',
              borderRadius: 'var(--card-border-radius)',
              background: 'none',
              color: 'var(--text-secondary)',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Decline
          </button>
          <button
            type='button'
            onClick={grant}
            style={{
              padding: '10px 18px',
              border: 'none',
              borderRadius: 'var(--card-border-radius)',
              background: 'var(--green-primary)',
              color: '#fff',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
