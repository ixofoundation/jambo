import { CSSProperties, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/router';

import Header from '@components/Header/Header';
import useCollectionBlacklist from '@hooks/useCollectionBlacklist';
import { ProtocolCollection, useProtocolCollections } from '@hooks/useProtocolCollections';

function shorten(value: string, head = 14, tail = 6) {
  return value.length > head + tail + 3 ? `${value.slice(0, head)}…${value.slice(-tail)}` : value;
}

function collectionName(c: ProtocolCollection): string {
  return c.formName || `Collection ${c.collectionId}`;
}

function claimsLabel(c: ProtocolCollection): string {
  const count = c.count ?? 0;
  const quota = c.quota ?? 0;
  return quota > 0 ? `${count}/${quota} claims` : `${count} claim${count === 1 ? '' : 's'}`;
}

/**
 * Admin-only per-entity claim-collection blacklist. Lists the entity's claim
 * collections (via the same source as the main entity screen, so names resolve)
 * and lets an admin toggle each one on/off the worker blacklist.
 */
export default function EntityCollectionsScreen({ entityDid }: { entityDid: string }) {
  const router = useRouter();
  const { blacklist, loading: blacklistLoading, savingIds, setBlacklisted } = useCollectionBlacklist(entityDid);
  // Admin manages the blacklist here, so show every collection (including hidden ones).
  const { collections, loading: collectionsLoading } = useProtocolCollections(entityDid, { applyBlacklist: false });

  // Guarantees a "Loading…" state on the very first render, before the hook's
  // fetch effect has had a chance to flip collectionsLoading on.
  const [started, setStarted] = useState(false);
  useEffect(() => {
    setStarted(true);
  }, [entityDid]);

  const goBack = useCallback(() => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      void router.push('/settings/entities');
    }
  }, [router]);

  const loading = !started || collectionsLoading || blacklistLoading;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header onGradient title='Claim Collections' onBack={goBack} />

      {/* Small green gradient band behind the (fixed) header so its onGradient styles apply. */}
      <div
        style={{
          background: 'radial-gradient(ellipse at top right, var(--green-secondary), var(--green-primary) 70%)',
          height: 'var(--header-height)',
        }}
      />

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
        <h1 style={{ margin: '0 0 4px', fontSize: '1.1rem', fontWeight: 500, color: 'var(--text-primary)' }}>
          Claim Collections
        </h1>
        <p
          title={entityDid}
          style={{
            margin: '0 0 4px',
            padding: '0 4px',
            fontSize: '12px',
            fontFamily: 'var(--font-mono, monospace)',
            color: 'var(--text-secondary)',
          }}
        >
          {shorten(entityDid)}
        </p>
        <p style={{ margin: '0 0 16px', padding: '0 4px', fontSize: '13px', color: 'var(--text-secondary)' }}>
          Toggle a collection on to blacklist it — blacklisted collections are hidden from the app.
        </p>

        {loading ? (
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)', padding: '0 4px' }}>Loading…</span>
        ) : collections.length === 0 ? (
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)', padding: '0 4px' }}>
            This entity has no claim collections.
          </span>
        ) : (
          <div style={listBoxStyle}>
            {collections.map((c, idx) => (
              <CollectionCard
                key={c.collectionId}
                collection={c}
                blacklisted={blacklist.has(c.collectionId)}
                saving={savingIds.has(c.collectionId)}
                onToggle={(next) => void setBlacklisted(c.collectionId, next)}
                last={idx === collections.length - 1}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Collection card + toggle (styled to match the base-claim-modal collection list)
// ---------------------------------------------------------------------------

// Solid list container with row dividers — matches the base-claim-modal lists.
const listBoxStyle: CSSProperties = {
  background: 'var(--bg-secondary)',
  borderRadius: '12px',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
};

function CollectionCard({
  collection,
  blacklisted,
  saving,
  onToggle,
  last,
}: {
  collection: ProtocolCollection;
  blacklisted: boolean;
  saving: boolean;
  onToggle: (next: boolean) => void;
  last: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '12px 14px',
        borderBottom: last ? 'none' : '1px solid var(--border-color)',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <span
          title={`Collection ${collection.collectionId}`}
          style={{
            display: 'inline-block',
            maxWidth: '100%',
            fontSize: '10px',
            fontWeight: 500,
            fontFamily: 'var(--font-mono, monospace)',
            color: 'color-mix(in srgb, var(--text-primary) 65%, transparent)',
            background: 'color-mix(in srgb, var(--text-primary) 8%, transparent)',
            borderRadius: '9999px',
            padding: '2px 8px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            verticalAlign: 'top',
          }}
        >
          {collection.collectionId}
        </span>
        <div
          style={{
            marginTop: '4px',
            fontSize: '14px',
            fontWeight: 500,
            color: 'var(--text-primary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {collectionName(collection)}
        </div>
        <div style={{ marginTop: '4px', fontSize: '12px', color: 'var(--text-secondary)' }}>
          {claimsLabel(collection)}
          {blacklisted && (
            <>
              {' · '}
              <span style={{ color: 'var(--error-color)', fontWeight: 500 }}>Hidden</span>
            </>
          )}
        </div>
      </div>

      <VisibilityButton blacklisted={blacklisted} saving={saving} onToggle={onToggle} />
    </div>
  );
}

// Icon-only visibility toggle. An eye icon means the collection is shown in the
// app; an eye-off icon means it is blacklisted/hidden. Pressing flips it (and
// runs the worker request, showing a spinner meanwhile).
function VisibilityButton({
  blacklisted,
  saving,
  onToggle,
}: {
  blacklisted: boolean;
  saving: boolean;
  onToggle: (next: boolean) => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type='button'
      disabled={saving}
      aria-pressed={blacklisted}
      aria-label={blacklisted ? 'Show collection in app' : 'Hide collection from app'}
      title={blacklisted ? 'Show in app' : 'Hide from app'}
      onClick={() => onToggle(!blacklisted)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        flexShrink: 0,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '32px',
        height: '32px',
        padding: 0,
        border: 'none',
        borderRadius: '8px',
        color: blacklisted ? 'var(--error-color)' : 'var(--text-secondary)',
        background: hover && !saving ? 'color-mix(in srgb, var(--text-primary) 8%, transparent)' : 'transparent',
        cursor: saving ? 'default' : 'pointer',
        opacity: saving ? 0.7 : 1,
        transition: 'background 140ms ease, color 140ms ease',
      }}
    >
      {saving ? (
        <span
          aria-hidden='true'
          style={{
            width: '16px',
            height: '16px',
            borderRadius: '50%',
            border: '2px solid currentColor',
            borderTopColor: 'transparent',
            animation: 'spin 0.7s linear infinite',
          }}
        />
      ) : blacklisted ? (
        <EyeOffIcon />
      ) : (
        <EyeIcon />
      )}
    </button>
  );
}

function EyeIcon() {
  return (
    <svg
      width='18'
      height='18'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      aria-hidden='true'
    >
      <path d='M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z' />
      <circle cx='12' cy='12' r='3' />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      width='18'
      height='18'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      aria-hidden='true'
    >
      <path d='M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24' />
      <line x1='1' y1='1' x2='23' y2='23' />
    </svg>
  );
}
