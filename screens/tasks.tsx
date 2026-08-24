import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';

import { useAuth } from '@hooks/useAuth';
import { useAppSelector, useAppDispatch } from '@store/hooks';
import { store } from '@store/index';
import { fetchAllCollectionData } from '@store/thunks/dataThunks';
import { ensureEntityProfiles } from '@utils/entityProfiles';
import { fetchClaimsByAgentAddress, fetchCollectionByCollectionId } from '@utils/claims';
import Header from '@components/Header/Header';
import { CheckIcon, CircleIcon, FileCheckIcon, HourglassIcon, XIcon } from '@components/Icons/icons';

interface MyClaim {
  claimId: string;
  collectionId: string;
  submissionDate?: string;
  evaluationByClaimId?: { status?: number; evaluationDate?: string } | null;
}

type ClaimGroup = 'reviewing' | 'approved' | 'rejected' | 'disputed';

function groupOf(c: MyClaim): ClaimGroup {
  const status = c.evaluationByClaimId?.status;
  if (status === 1) return 'approved';
  if (status === 2) return 'rejected';
  if (status === 3) return 'disputed';
  return 'reviewing';
}

const GROUPS: { key: ClaimGroup; label: string; hint?: string }[] = [
  { key: 'reviewing', label: 'Awaiting Review', hint: 'The organisation is reviewing your proof — you’ll see it here the moment it lands.' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Not Approved' },
  { key: 'disputed', label: 'Disputed' },
];

function fmtDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso.endsWith('Z') ? iso : `${iso}Z`);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/**
 * Tasks: the user's real work — claim drafts and submitted claims. ONE
 * blocksync query (claims by agent address) decides the whole page; collection
 * and entity metadata is then resolved only for the handful of collections the
 * user is actually involved in (store-cached, so usually zero extra requests).
 */
export default function Tasks() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { address } = useAuth();

  const profiles = useAppSelector((state) => state.profiles.byEntityDid);
  const drafts = useAppSelector((state) => state.claimDrafts.byCollectionId);
  const collectionsById = useAppSelector((state) => state.collections.byId);
  const formNames = useAppSelector((state) => state.protocols.formNames);

  const [claims, setClaims] = useState<MyClaim[]>([]);
  const [loading, setLoading] = useState(true);

  // One query: every claim this agent ever submitted, across all collections.
  useEffect(() => {
    if (!address) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchClaimsByAgentAddress(address)
      .then((nodes: MyClaim[] | undefined) => {
        if (cancelled) return;
        const all = nodes ?? [];
        all.sort((a, b) => (b.submissionDate ?? '').localeCompare(a.submissionDate ?? ''));
        setClaims(all);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [address]);

  // Collections the user is actually involved in (claims + drafts).
  const involvedKey = useMemo(() => {
    const ids = new Set<string>(Object.keys(drafts));
    claims.forEach((c) => ids.add(c.collectionId));
    return Array.from(ids).sort().join(',');
  }, [claims, drafts]);

  // Resolve names/thumbnails for just those collections: collection → owning
  // entity (store-cached chain lookup), then profile + form names per entity.
  useEffect(() => {
    if (!involvedKey) return;
    let cancelled = false;
    void (async () => {
      const entityDids = new Set<string>();
      await Promise.allSettled(
        involvedKey.split(',').map(async (collectionId) => {
          const col =
            store.getState().collections.byId[collectionId] ??
            (await fetchCollectionByCollectionId(collectionId).catch(() => null));
          if (col?.entity) entityDids.add(col.entity);
        }),
      );
      if (cancelled) return;
      const dids = Array.from(entityDids);
      void ensureEntityProfiles(dids);
      dids.forEach((entityDid) => dispatch(fetchAllCollectionData({ entityDid })));
    })();
    return () => {
      cancelled = true;
    };
  }, [involvedKey, dispatch]);

  const rowFor = (collectionId: string) => {
    const col = collectionsById[collectionId];
    const entityDid = col?.entity as string | undefined;
    const profile = entityDid ? profiles[entityDid] : undefined;
    return {
      name: (col?.protocol && formNames[col.protocol]) || `Collection ${collectionId}`,
      entityName: profile?.name,
      thumb: profile?.image || profile?.logo,
      href: entityDid ? `/entities/${encodeURIComponent(entityDid)}/claimCollections/${encodeURIComponent(collectionId)}` : undefined,
    };
  };

  const Row = ({
    collectionId,
    meta,
    trailing,
  }: {
    collectionId: string;
    meta: string;
    trailing: React.ReactNode;
  }) => {
    const r = rowFor(collectionId);
    return (
      <button
        className='status-item'
        style={{ width: '100%', marginBottom: 12 }}
        onClick={() => r.href && router.push(r.href)}
      >
        {r.thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={r.thumb} className='status-item__thumb' alt='' />
        ) : (
          <span className='status-item__thumb' style={{ background: 'var(--purple-tint)', display: 'grid', placeItems: 'center', color: 'var(--purple-primary)' }}>
            <FileCheckIcon size={22} />
          </span>
        )}
        <div className='status-item__body'>
          <div className='status-item__title' style={{ fontSize: 15.5 }}>{r.name}</div>
          <div className='status-item__meta'>
            {[r.entityName, meta].filter(Boolean).join(' · ')}
          </div>
        </div>
        <div className='status-item__trailing'>{trailing}</div>
      </button>
    );
  };

  const draftEntries = Object.entries(drafts);
  const empty = !loading && draftEntries.length === 0 && claims.length === 0;

  return (
    <div style={{ position: 'relative', minHeight: '100dvh' }}>
      <Header />
      <main
        style={{
          position: 'relative',
          zIndex: 1,
          maxWidth: 'var(--max-width)',
          margin: '0 auto',
          padding: `0 20px var(--dock-clearance)`,
          paddingTop: 'calc(var(--header-height) + 4px)',
        }}
      >
        <div className='section-header' style={{ marginTop: 4 }}>
          <h2>Tasks</h2>
        </div>

        {loading && claims.length === 0 && draftEntries.length === 0 && (
          <p className='muted' style={{ fontSize: 14.5 }}>Loading your work…</p>
        )}

        {empty && (
          <div className='card--inset card center' style={{ padding: '32px 20px' }}>
            <FileCheckIcon size={24} color='var(--text-secondary)' style={{ margin: '0 auto 10px', display: 'block' }} />
            <p className='muted' style={{ fontSize: 14.5, lineHeight: 1.5, margin: 0 }}>
              No tasks yet. Swipe right on a card in your deck, apply, and your claims will live here.
            </p>
            <button className='btn btn--primary' style={{ marginTop: 16 }} onClick={() => router.push('/')}>
              Open your deck
            </button>
          </div>
        )}

        {draftEntries.length > 0 && (
          <div style={{ marginTop: 4 }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 12px' }}>Drafts</h3>
            {draftEntries.map(([collectionId, draft]) => (
              <Row
                key={`draft-${collectionId}`}
                collectionId={collectionId}
                meta={`Saved ${new Date(draft.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`}
                trailing={<span className='reviewing'><CircleIcon size={13} /> Draft</span>}
              />
            ))}
          </div>
        )}

        {GROUPS.map((g) => {
          const items = claims.filter((c) => groupOf(c) === g.key);
          if (!items.length) return null;
          return (
            <div key={g.key} style={{ marginTop: 18 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 12px' }}>{g.label}</h3>
              {g.hint && (
                <p className='muted' style={{ fontSize: 14, margin: '-4px 0 12px' }}>
                  {g.hint}
                </p>
              )}
              {items.map((c) => (
                <Row
                  key={c.claimId}
                  collectionId={c.collectionId}
                  meta={
                    g.key === 'approved'
                      ? `Approved ${fmtDate(c.evaluationByClaimId?.evaluationDate)}`
                      : `Submitted ${fmtDate(c.submissionDate)}`
                  }
                  trailing={
                    g.key === 'approved' ? (
                      <span className='approved'>
                        <CheckIcon size={15} /> Approved
                      </span>
                    ) : g.key === 'reviewing' ? (
                      <span className='reviewing'>
                        <HourglassIcon size={14} /> Reviewing
                      </span>
                    ) : g.key === 'rejected' ? (
                      <span style={{ color: 'var(--error-color)', fontWeight: 700, fontSize: 13.5, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                        <XIcon size={14} /> Not approved
                      </span>
                    ) : (
                      <span className='reviewing'>
                        <CircleIcon size={13} /> Disputed
                      </span>
                    )
                  }
                />
              ))}
            </div>
          );
        })}
        <div style={{ height: 12 }} />
      </main>
    </div>
  );
}
