import { useState } from 'react';

import Header from '@components/Header/Header';
import KycCredentialsCard from '@components/Credentials/KycCredentialsCard';
import { useAuth } from '@hooks/useAuth';
import { useAppSelector } from '@store/hooks';

function shorten(value: string, head = 12, tail = 6) {
  return value.length > head + tail + 3 ? `${value.slice(0, head)}…${value.slice(-tail)}` : value;
}

export default function ProfileScreen() {
  const { address, did } = useAuth();
  const matrixProfile = useAppSelector((state) => state.matrixProfile);

  const displayName = matrixProfile?.displayName || address || null;

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
          {matrixProfile?.avatarUrl ? (
            <img
              src={matrixProfile.avatarUrl}
              alt=''
              style={{ width: '100px', height: '100px', borderRadius: '50%', objectFit: 'cover' }}
            />
          ) : (
            <div
              style={{
                width: '100px',
                height: '100px',
                borderRadius: '50%',
                backgroundColor: 'var(--accent-color)',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '40px',
                fontWeight: 500,
              }}
            >
              {displayName ? displayName.charAt(0).toUpperCase() : '?'}
            </div>
          )}

          <p
            style={{
              margin: 0,
              fontSize: '1.2rem',
              fontWeight: 700,
              color: 'var(--text-primary-light)',
            }}
          >
            {displayName || 'Unknown'}
          </p>

          {address && <CopyBlock value={address} head={6} tail={5} />}
          {did && <CopyBlock value={did} />}
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
          style={{
            margin: '8px 4px 12px',
            fontSize: '1.2rem',
            fontWeight: 700,
            color: 'var(--text-primary)',
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
          stroke='currentColor'
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
