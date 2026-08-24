import { useRef, useState } from 'react';
import { useRouter } from 'next/router';

import Header from '@components/Header/Header';
import GradientBand from '@components/GradientBand/GradientBand';
import KycCredentialsCard from '@components/Credentials/KycCredentialsCard';
import { ArrowDownLeftIcon, CheckIcon, ChevronRightIcon, CopyIcon, LandmarkIcon } from '@components/Icons/icons';
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

  // Fall back to a shortened address — a full bech32 address must never run
  // as a two-line display headline.
  const rawName = matrixProfile?.displayName || address || null;
  const displayName = rawName && rawName === address ? shorten(address, 8, 6) : rawName;

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
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <GradientBand variant='green' />
      <Header onGradient />

      {/* Body */}
      <main
        style={{
          position: 'relative',
          zIndex: 1,
          width: '100%',
          maxWidth: 'var(--max-width)',
          margin: '0 auto',
          padding: '0 20px var(--dock-clearance)',
          paddingTop: 'calc(var(--header-height) + 4px)',
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
        }}
      >
        {/* Hero — centred avatar on the light ground */}
        <div className='center' style={{ marginTop: 12 }}>
          {matrixProfile?.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={matrixProfile.avatarUrl}
              alt=''
              style={{ width: 96, height: 96, borderRadius: '50%', objectFit: 'cover', margin: '0 auto', display: 'block', boxShadow: 'var(--shadow-card)' }}
            />
          ) : (
            <div
              style={{
                width: 96,
                height: 96,
                borderRadius: '50%',
                margin: '0 auto',
                backgroundColor: 'var(--purple-primary)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'var(--font-display)',
                fontSize: 36,
                fontWeight: 800,
                boxShadow: 'var(--shadow-card)',
              }}
            >
              {displayName ? displayName.charAt(0).toUpperCase() : '?'}
            </div>
          )}
          <h1
            className='h1'
            style={{ marginTop: 12, fontSize: 24, overflowWrap: 'anywhere', wordBreak: 'break-word' }}
          >
            {displayName || 'Unknown'}
          </h1>
          {did && <DidLine did={did} />}
        </div>

        <h2
          className='h2'
          onPointerDown={startLongPress}
          onPointerUp={clearLongPress}
          onPointerLeave={clearLongPress}
          onPointerCancel={clearLongPress}
          onContextMenu={(e) => e.preventDefault()}
          style={{
            margin: '24px 0 12px',
            userSelect: 'none',
            WebkitUserSelect: 'none',
            touchAction: 'manipulation',
            cursor: 'default',
          }}
        >
          My Credentials
        </h2>

        <KycCredentialsCard />

        <h2 className='h2' style={{ margin: '24px 0 12px' }}>
          Wallet
        </h2>

        <button className='status-item' style={{ width: '100%', marginBottom: 12 }} onClick={() => router.push('/profile/onramp')}>
          <span className='notif-ic' style={{ background: 'var(--mint)', color: 'var(--green-primary)' }}>
            <ArrowDownLeftIcon size={20} />
          </span>
          <span className='status-item__body'>
            <span className='status-item__title' style={{ display: 'block' }}>Deposit</span>
            <span className='status-item__meta' style={{ display: 'block' }}>Buy USDC with local money via YellowCard</span>
          </span>
          <ChevronRightIcon size={18} color='var(--text-secondary)' />
        </button>

        <button className='status-item' style={{ width: '100%' }} onClick={() => router.push('/profile/offramp')}>
          <span className='notif-ic' style={{ background: '#fdeed8', color: 'var(--coral)' }}>
            <LandmarkIcon size={20} />
          </span>
          <span className='status-item__body'>
            <span className='status-item__title' style={{ display: 'block' }}>Withdraw</span>
            <span className='status-item__meta' style={{ display: 'block' }}>Cash out your USDC via YellowCard</span>
          </span>
          <ChevronRightIcon size={18} color='var(--text-secondary)' />
        </button>
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DID line — the designer's quiet identifier under the name: light text with a
// copy affordance. (Address + DID copy chips live in Settings → Account.)
// ---------------------------------------------------------------------------

/** The designer's DID format: `did:ixo:z7Gq…4Kd9` — method prefix kept, then
 *  the first 4 and last 4 characters of the identifier. */
function shortDid(did: string) {
  const cut = did.lastIndexOf(':') + 1;
  const prefix = did.slice(0, cut);
  const id = did.slice(cut);
  return id.length > 11 ? `${prefix}${id.slice(0, 4)}…${id.slice(-4)}` : did;
}

function DidLine({ did }: { did: string }) {
  const [copied, setCopied] = useState(false);

  function handleClick() {
    navigator.clipboard
      .writeText(did)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => {});
  }

  return (
    <button
      onClick={handleClick}
      className='muted'
      title='Copy DID'
      aria-label='Copy DID'
      style={{
        marginTop: 4,
        maxWidth: '100%',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        background: 'none',
        border: 'none',
        padding: 0,
        cursor: 'pointer',
        fontSize: 14,
        fontWeight: 500,
      }}
    >
      <span style={{ whiteSpace: 'nowrap' }}>{shortDid(did)}</span>
      {copied ? (
        <CheckIcon size={14} color='var(--green-primary)' style={{ flexShrink: 0 }} />
      ) : (
        <CopyIcon size={14} style={{ flexShrink: 0, opacity: 0.75 }} />
      )}
    </button>
  );
}
