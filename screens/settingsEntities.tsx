import { CSSProperties, Fragment, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { toast } from 'react-toastify';

import Header from '@components/Header/Header';
import GradientBand from '@components/GradientBand/GradientBand';
import useEntityWhitelist from '@hooks/useEntityWhitelist';
import { entityHasClaimCollections, getEntityClaimCollectionCount } from '@utils/claims';

/**
 * Admin-only entity management screen. Reachable at /settings/entities and
 * protected by AuthGuard + AdminGuard. Hosts the entity whitelist; the gear on
 * each entity opens its per-entity claim-collection blacklist.
 */
export default function SettingsEntitiesScreen() {
  const router = useRouter();

  const goBack = useCallback(() => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      void router.push('/settings');
    }
  }, [router]);

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <GradientBand variant='purple' />
      <Header onGradient title='Entities' onBack={goBack} />

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
        <EntityWhitelistSection />
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Entity whitelist
// ---------------------------------------------------------------------------

function EntityWhitelistSection() {
  const { entities, loading, mutating, add, remove } = useEntityWhitelist();

  const [input, setInput] = useState('');
  const [checking, setChecking] = useState(false);
  // Entity DID that has no claim collections and is awaiting "proceed anyway".
  const [pending, setPending] = useState<string | null>(null);

  const busy = checking || mutating;

  const doAdd = useCallback(
    async (entityDid: string) => {
      const ok = await add(entityDid);
      if (ok) {
        setInput('');
        setPending(null);
        toast.success('Entity whitelisted');
      }
    },
    [add],
  );

  const handleAdd = useCallback(async () => {
    const entityDid = input.trim();
    if (!entityDid.startsWith('did:')) {
      toast.error('Enter a valid entity DID (did:…)');
      return;
    }
    if (entities.includes(entityDid)) {
      toast.info('Entity is already whitelisted');
      return;
    }
    setPending(null);
    setChecking(true);
    try {
      const hasCollections = await entityHasClaimCollections(entityDid);
      setChecking(false);
      if (hasCollections) {
        await doAdd(entityDid);
      } else {
        // No collections — don't whitelist silently; ask for explicit confirmation.
        setPending(entityDid);
      }
    } catch {
      setChecking(false);
      toast.error('Could not verify the entity’s claim collections. Try again.');
    }
  }, [input, entities, doAdd]);

  return (
    <>
      <h1 className='h2' style={{ margin: '4px 0 6px' }}>
        Entity Whitelist
      </h1>
      <p className='muted' style={{ margin: '0 0 16px', fontSize: '13px', lineHeight: 1.5 }}>
        Entities approved to appear in the app.
      </p>

      {/* Add input (above the list) */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <input
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            if (pending) setPending(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !busy) void handleAdd();
          }}
          placeholder='Paste entity DID (did:ixo:…)'
          spellCheck={false}
          autoCapitalize='off'
          autoCorrect='off'
          style={{
            flex: 1,
            minWidth: 0,
            padding: '10px 12px',
            fontSize: '13px',
            fontFamily: 'var(--font-mono, monospace)',
            color: 'var(--text-primary)',
            background: 'var(--surface)',
            border: '1px solid var(--input-border-color)',
            borderRadius: 'var(--r-input)',
            outline: 'none',
          }}
        />
        <button
          onClick={() => void handleAdd()}
          disabled={busy || !input.trim()}
          className='btn btn--primary btn--sm'
          style={{ flexShrink: 0, whiteSpace: 'nowrap' }}
        >
          {checking ? 'Checking…' : mutating ? 'Adding…' : 'Add'}
        </button>
      </div>

      {/* No-collections warning + proceed-anyway confirmation */}
      {pending && (
        <div
          className='card'
          style={{
            margin: '12px 0 0',
            padding: '14px 16px',
            border: '1px solid var(--warning-border)',
          }}
        >
          <p style={{ margin: '0 0 4px', fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
            No claim collections found
          </p>
          <p className='muted' style={{ margin: '0 0 12px', fontSize: '13px', overflowWrap: 'anywhere' }}>
            <span style={{ fontFamily: 'var(--font-mono, monospace)' }}>{shorten(pending)}</span> has no claim
            collections with this entity. Whitelist it anyway?
          </p>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => void doAdd(pending)}
              disabled={mutating}
              className='btn btn--sm'
              style={{ background: 'var(--warning-color)', color: 'var(--button-text-color)' }}
            >
              {mutating ? 'Adding…' : 'Proceed anyway'}
            </button>
            <button onClick={() => setPending(null)} disabled={mutating} className='btn btn--ghost btn--sm'>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Current list */}
      <div style={{ marginTop: '16px' }}>
        {loading ? (
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)', padding: '0 4px' }}>Loading…</span>
        ) : entities.length === 0 ? (
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)', padding: '0 4px' }}>
            No entities whitelisted yet.
          </span>
        ) : (
          <div className='list-card' style={{ display: 'flex', flexDirection: 'column' }}>
            {entities.map((entityDid, idx) => (
              <Fragment key={entityDid}>
                {idx > 0 && <div className='list-divider' />}
                <EntityRow entityDid={entityDid} onRemove={remove} disabled={mutating} />
              </Fragment>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function shorten(value: string, head = 14, tail = 6) {
  return value.length > head + tail + 3 ? `${value.slice(0, head)}…${value.slice(-tail)}` : value;
}

const iconBtnStyle: CSSProperties = {
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '24px',
  height: '24px',
  padding: 0,
  background: 'transparent',
  border: 'none',
  borderRadius: '8px',
  cursor: 'pointer',
};

function IconButton({
  onClick,
  disabled = false,
  color,
  opacity = 1,
  ariaLabel,
  title,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  color: string;
  opacity?: number;
  ariaLabel: string;
  title: string;
  children: React.ReactNode;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      title={title}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        ...iconBtnStyle,
        color,
        opacity,
        cursor: disabled ? 'default' : 'pointer',
        background: hover && !disabled ? 'color-mix(in srgb, var(--text-primary) 8%, transparent)' : 'transparent',
      }}
    >
      {children}
    </button>
  );
}

function collectionCountLabel(count: number): string {
  if (count === 0) return 'No claim collections';
  return `${count} claim collection${count === 1 ? '' : 's'}`;
}

function EntityRow({
  entityDid,
  onRemove,
  disabled,
}: {
  entityDid: string;
  onRemove: (entityDid: string) => Promise<void>;
  disabled: boolean;
}) {
  const router = useRouter();
  const [removing, setRemoving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [copied, setCopied] = useState(false);

  // Per-entity claim-collection count, shown as subtext under the DID.
  const [count, setCount] = useState<number | null>(null);
  const [countError, setCountError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setCount(null);
    setCountError(false);
    getEntityClaimCollectionCount(entityDid)
      .then((n) => {
        if (!cancelled) setCount(n);
      })
      .catch(() => {
        if (!cancelled) setCountError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [entityDid]);

  const handleCopy = useCallback(() => {
    navigator.clipboard
      .writeText(entityDid)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => toast.error('Could not copy to clipboard'));
  }, [entityDid]);

  const handleRemove = useCallback(async () => {
    setRemoving(true);
    await onRemove(entityDid);
    // Component unmounts on success (list refreshes); reset for the failure case.
    setRemoving(false);
    setConfirming(false);
  }, [entityDid, onRemove]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        gap: '12px',
        padding: '12px 16px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', marginRight: '6px' }}>
          <button
            onClick={handleCopy}
            aria-label='Copy entity DID'
            title='Copy entity DID'
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              minWidth: 0,
              maxWidth: '100%',
              padding: 0,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              font: 'inherit',
              textAlign: 'left',
            }}
          >
            <span
              style={{
                fontSize: '13px',
                fontFamily: 'var(--font-mono, monospace)',
                color: 'var(--text-primary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {entityDid.length > 16 ? `${entityDid.slice(0, 11)}...${entityDid.slice(-5)}` : entityDid}
            </span>
            <span
              style={{
                flexShrink: 0,
                display: 'inline-flex',
                alignItems: 'center',
                color: copied ? 'var(--green-primary)' : 'var(--text-secondary)',
              }}
            >
              {copied ? (
                <svg
                  width='12'
                  height='12'
                  viewBox='0 0 24 24'
                  fill='none'
                  stroke='currentColor'
                  strokeWidth='2.5'
                  strokeLinecap='round'
                  strokeLinejoin='round'
                >
                  <polyline points='20 6 9 17 4 12' />
                </svg>
              ) : (
                <svg
                  width='12'
                  height='12'
                  viewBox='0 0 24 24'
                  fill='none'
                  stroke='currentColor'
                  strokeWidth='2'
                  strokeLinecap='round'
                  strokeLinejoin='round'
                >
                  <rect x='9' y='9' width='13' height='13' rx='2' ry='2' />
                  <path d='M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1' />
                </svg>
              )}
            </span>
          </button>
          <div
            style={{
              marginTop: '4px',
              fontSize: '12px',
              fontStyle: countError ? 'italic' : 'normal',
              color: 'var(--text-secondary)',
            }}
          >
            {countError ? 'Couldn’t load collections' : count === null ? 'Loading…' : collectionCountLabel(count)}
          </div>
        </div>

        <IconButton
          onClick={() => void router.push(`/settings/entities/${encodeURIComponent(entityDid)}`)}
          color='var(--text-secondary)'
          ariaLabel='Manage claim collections'
          title='Manage claim collections'
        >
          <svg
            width='16'
            height='16'
            viewBox='0 0 24 24'
            fill='none'
            stroke='currentColor'
            strokeWidth='2'
            strokeLinecap='round'
            strokeLinejoin='round'
          >
            <circle cx='12' cy='12' r='3' />
            <path d='M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z' />
          </svg>
        </IconButton>

        <IconButton
          onClick={() => setConfirming(true)}
          disabled={removing || disabled || confirming}
          color='var(--error-color)'
          opacity={removing || confirming ? 0.5 : 1}
          ariaLabel='Remove entity'
          title='Remove from whitelist'
        >
          <svg
            width='16'
            height='16'
            viewBox='0 0 24 24'
            fill='none'
            stroke='currentColor'
            strokeWidth='2'
            strokeLinecap='round'
            strokeLinejoin='round'
          >
            <polyline points='3 6 5 6 21 6' />
            <path d='M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6' />
            <path d='M10 11v6M14 11v6' />
            <path d='M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2' />
          </svg>
        </IconButton>
      </div>

      {/* Delete confirmation */}
      {confirming && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            paddingTop: '12px',
            borderTop: '1px solid var(--border-color)',
          }}
        >
          <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>Remove from whitelist?</span>
          <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
            <button
              onClick={() => void handleRemove()}
              disabled={removing}
              style={{
                padding: '6px 14px',
                fontSize: '13px',
                fontWeight: 500,
                color: 'var(--button-text-color, #fff)',
                background: 'var(--error-color)',
                border: 'none',
                borderRadius: '8px',
                cursor: removing ? 'default' : 'pointer',
                opacity: removing ? 0.6 : 1,
              }}
            >
              {removing ? 'Removing…' : 'Remove'}
            </button>
            <button
              onClick={() => setConfirming(false)}
              disabled={removing}
              style={{
                padding: '6px 14px',
                fontSize: '13px',
                fontWeight: 500,
                color: 'var(--text-primary)',
                background: 'transparent',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                cursor: removing ? 'default' : 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
