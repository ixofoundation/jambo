import { useRef, useState } from 'react';
import { useRouter } from 'next/router';

import Header from '@components/Header/Header';
import KycCredentialsCard from '@components/Credentials/KycCredentialsCard';
import { useAuth } from '@hooks/useAuth';
import { useAppSelector } from '@store/hooks';

const LONG_PRESS_MS = 4000;

function shorten(value: string, head = 12, tail = 6) {
  return value.length > head + tail + 3 ? `${value.slice(0, head)}…${value.slice(-tail)}` : value;
}

export default function ProfileScreen() {
  const router = useRouter();
  const { address, did } = useAuth();
  const matrixProfile = useAppSelector((state) => state.matrixProfile);

  const displayName = matrixProfile?.displayName || address || null;

  // Hidden long-press (4s) on the "My Credentials" header navigates to the full
  // credentials list. Pointer events cover mouse + touch + pen with the same logic.
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFiredRef = useRef(false);

  function clearLongPress() {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }

  function startLongPress() {
    longPressFiredRef.current = false;
    clearLongPress();
    longPressTimerRef.current = setTimeout(() => {
      longPressFiredRef.current = true;
      void router.push('/profile/credentials');
    }, LONG_PRESS_MS);
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header onGradient />

      {/* Hero (content-sized gradient) */}
      <div
        style={{
          background: 'radial-gradient(ellipse at top right, var(--green-secondary), var(--green-primary) 70%)',
          paddingTop: 'calc(var(--header-height) + 20px)',
          paddingBottom: '24px',
        }}
      >
        <div
          style={{
            maxWidth: 'var(--max-width)',
            margin: '0 auto',
            padding: '0 16px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <div
            style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              padding: '5px',
              backgroundColor: 'rgba(255, 255, 255, 0.15)',
              boxSizing: 'border-box',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {matrixProfile?.avatarUrl ? (
              <img
                src={matrixProfile.avatarUrl}
                alt=''
                style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
              />
            ) : (
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: '50%',
                  backgroundColor: 'var(--accent-color)',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '30px',
                  fontWeight: 500,
                }}
              >
                {displayName ? displayName.charAt(0).toUpperCase() : '?'}
              </div>
            )}
          </div>

          <p
            style={{
              margin: 0,
              fontSize: '1.2rem',
              fontWeight: 500,
              color: 'var(--text-primary-light)',
              maxWidth: '100%',
              textAlign: 'center',
              overflowWrap: 'anywhere',
              wordBreak: 'break-word',
            }}
          >
            {displayName || 'Unknown'}
          </p>

          {(address || did) && (
            <div
              style={{
                marginTop: '10px',
                display: 'flex',
                gap: '8px',
                flexWrap: 'wrap',
                justifyContent: 'center',
              }}
            >
              {address && <CopyBlock value={address} head={3} tail={5} />}
              {did && <CopyBlock value={did} head={3} tail={5} />}
            </div>
          )}
        </div>
      </div>

      {/* Body */}
      <main
        style={{
          width: '100%',
          maxWidth: 'var(--max-width)',
          margin: '0 auto',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
        }}
      >
        <h3
          onPointerDown={startLongPress}
          onPointerUp={clearLongPress}
          onPointerLeave={clearLongPress}
          onPointerCancel={clearLongPress}
          onContextMenu={(e) => e.preventDefault()}
          style={{
            margin: '0 0 8px',
            fontSize: '1.1rem',
            fontWeight: 500,
            color: 'var(--text-primary)',
            userSelect: 'none',
            WebkitUserSelect: 'none',
            touchAction: 'manipulation',
            cursor: 'default',
          }}
        >
          My Credentials
        </h3>

        <KycCredentialsCard />
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Copy block — pressable pill, shortened value, green-check feedback
// ---------------------------------------------------------------------------

function CopyBlock({ value, head, tail }: { value: string; head?: number; tail?: number }) {
  const [copied, setCopied] = useState(false);

  function handleClick() {
    navigator.clipboard
      .writeText(value)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => {});
  }

  return (
    <button
      onClick={handleClick}
      style={{
        borderRadius: 'var(--card-border-radius)',
        border: 'none',
        background: 'rgba(255, 255, 255, 0.15)',
        padding: '5px 12px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '10px',
        cursor: 'pointer',
        color: 'var(--text-primary-light)',
      }}
      title='Copy'
    >
      <span
        style={{
          fontSize: '13px',
          fontFamily: 'monospace',
          whiteSpace: 'nowrap',
        }}
      >
        {shorten(value, head, tail)}
      </span>
      {copied ? (
        <svg
          width={14}
          height={14}
          viewBox='0 0 24 24'
          fill='none'
          stroke='var(--accent-color)'
          strokeWidth='2.5'
          strokeLinecap='round'
          strokeLinejoin='round'
          style={{ flexShrink: 0 }}
        >
          <polyline points='20 6 9 17 4 12' />
        </svg>
      ) : (
        <svg
          width={14}
          height={14}
          viewBox='0 0 24 24'
          fill='none'
          stroke='currentColor'
          strokeWidth='2'
          strokeLinecap='round'
          strokeLinejoin='round'
          style={{ flexShrink: 0, opacity: 0.75 }}
        >
          <rect x='9' y='9' width='13' height='13' rx='2' ry='2' />
          <path d='M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1' />
        </svg>
      )}
    </button>
  );
}
