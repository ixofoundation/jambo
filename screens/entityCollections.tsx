import { CSSProperties, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';

import Header from '@components/Header/Header';
import CollectionLinkagesPanel from '@components/CollectionLinkagesPanel/CollectionLinkagesPanel';
import useCollectionBlacklist from '@hooks/useCollectionBlacklist';
import { ProtocolCollection, collectionName, useProtocolCollections } from '@hooks/useProtocolCollections';
import { getCollectionLinks } from 'lib/yomaWorker/client';

function shorten(value: string, head = 14, tail = 6) {
  return value.length > head + tail + 3 ? `${value.slice(0, head)}…${value.slice(-tail)}` : value;
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

  // Single-open accordion for the per-collection linkages panel.
  const [expandedId, setExpandedId] = useState<string | null>(null);
  useEffect(() => {
    setExpandedId(null);
  }, [entityDid]);

  // Collections that already have at least one base/sub link, for the dot on
  // the link icon. Seeded with one lookup per listed collection (best-effort —
  // failures just leave the dot off), then kept live by the expanded panel.
  const [linkedIds, setLinkedIds] = useState<Set<string>>(new Set());
  // Collections whose link state the expanded panel has reported live — those
  // reports are fresher than the seed lookups, so a slow seed response must
  // not overwrite them (e.g. re-adding the dot right after a link deletion).
  const panelReportedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    setLinkedIds(new Set());
    panelReportedRef.current = new Set();
    if (collections.length === 0) return;
    let cancelled = false;
    collections.forEach((c) => {
      void getCollectionLinks(c.collectionId).then((res) => {
        if (cancelled || !res.ok || panelReportedRef.current.has(c.collectionId)) return;
        if ((res.data.base?.length ?? 0) + (res.data.sub?.length ?? 0) > 0) {
          setLinkedIds((prev) => new Set(prev).add(c.collectionId));
        }
      });
    });
    return () => {
      cancelled = true;
    };
    // Re-seed only when the set of listed collection ids changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityDid, collections.map((c) => c.collectionId).join(',')]);

  const setHasLinks = (collectionId: string, hasLinks: boolean) => {
    panelReportedRef.current.add(collectionId);
    setLinkedIds((prev) => {
      if (prev.has(collectionId) === hasLinks) return prev;
      const next = new Set(prev);
      if (hasLinks) next.add(collectionId);
      else next.delete(collectionId);
      return next;
    });
  };

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
          Toggle a collection on to blacklist it — blacklisted collections are hidden from the app. Expand a collection
          to manage its base/sub claim linkages.
        </p>

        {loading ? (
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)', padding: '0 4px' }}>Loading…</span>
        ) : collections.length === 0 ? (
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)', padding: '0 4px' }}>
            This entity has no claim collections.
          </span>
        ) : (
          <div style={listBoxStyle}>
            {collections.map((c, idx) => {
              const expanded = expandedId === c.collectionId;
              const last = idx === collections.length - 1;
              return (
                <div key={c.collectionId} style={{ display: 'flex', flexDirection: 'column' }}>
                  <CollectionCard
                    collection={c}
                    blacklisted={blacklist.has(c.collectionId)}
                    saving={savingIds.has(c.collectionId)}
                    onToggle={(next) => void setBlacklisted(c.collectionId, next)}
                    expanded={expanded}
                    hasLinks={linkedIds.has(c.collectionId)}
                    onToggleExpand={() => setExpandedId(expanded ? null : c.collectionId)}
                    last={last || expanded}
                  />
                  {expanded && (
                    // Unmounted on collapse, so useCollectionLinks refetches on every expand.
                    <div style={{ borderBottom: last ? 'none' : '1px solid var(--border-color)' }}>
                      <CollectionLinkagesPanel
                        collection={c}
                        allCollections={collections}
                        blacklist={blacklist}
                        onHasLinksChange={(hasLinks) => setHasLinks(c.collectionId, hasLinks)}
                      />
                    </div>
                  )}
                </div>
              );
            })}
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
  expanded,
  hasLinks,
  onToggleExpand,
  last,
}: {
  collection: ProtocolCollection;
  blacklisted: boolean;
  saving: boolean;
  onToggle: (next: boolean) => void;
  expanded: boolean;
  hasLinks: boolean;
  onToggleExpand: () => void;
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

      <LinkagesButton expanded={expanded} hasLinks={hasLinks} onToggleExpand={onToggleExpand} />
      <VisibilityButton blacklisted={blacklisted} saving={saving} onToggle={onToggle} />
    </div>
  );
}

// Icon-only toggle for the base/sub linkages panel under the card. A small
// dot on the icon marks collections that already have a base or sub link.
function LinkagesButton({
  expanded,
  hasLinks,
  onToggleExpand,
}: {
  expanded: boolean;
  hasLinks: boolean;
  onToggleExpand: () => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type='button'
      aria-expanded={expanded}
      aria-label={
        expanded ? 'Hide claim linkages' : hasLinks ? 'Manage claim linkages (has links)' : 'Manage claim linkages'
      }
      title={expanded ? 'Hide linkages' : hasLinks ? 'Manage linkages (has links)' : 'Manage linkages'}
      onClick={onToggleExpand}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'relative',
        flexShrink: 0,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '32px',
        height: '32px',
        padding: 0,
        border: 'none',
        borderRadius: '8px',
        color: expanded ? 'var(--green-primary)' : 'var(--text-secondary)',
        background: hover ? 'color-mix(in srgb, var(--text-primary) 8%, transparent)' : 'transparent',
        cursor: 'pointer',
        transition: 'background 140ms ease, color 140ms ease',
      }}
    >
      <LinkIcon />
      {hasLinks && (
        <span
          aria-hidden='true'
          style={{
            position: 'absolute',
            top: '4px',
            right: '4px',
            width: '7px',
            height: '7px',
            borderRadius: '50%',
            background: 'var(--green-primary)',
            border: '1px solid var(--bg-secondary)',
          }}
        />
      )}
    </button>
  );
}

function LinkIcon() {
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
      <path d='M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71' />
      <path d='M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71' />
    </svg>
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
