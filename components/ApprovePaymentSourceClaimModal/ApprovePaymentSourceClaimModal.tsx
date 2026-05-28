import { useEffect, useMemo, useState } from 'react';
import ReactDOM from 'react-dom';

import Cross from '@icons/cross.svg';
import ArrowLeft from '@icons/arrow_left.svg';
import styles from '@components/SubclaimModal/SubclaimModal.module.scss';
import SubclaimModalErrorCard from '@components/SubclaimModal/SubclaimModalErrorCard';
import { fetchMatrixProfileForAddress, matrixUserIdForAddress } from '@utils/matrixProfile';
import { useAppSelector } from '@store/hooks';

interface ClaimSummary {
  claimId: string;
  collectionId: string;
  agentAddress?: string;
  submissionDate?: number | string | null;
  paymentsStatus?: unknown;
  schemaType?: string;
  evaluationByClaimId?: { status?: string | number } | null;
}

export interface ApprovePaymentCollectionMeta {
  name?: string | null;
  count?: number;
  quota?: number;
  startDate?: number | null;
  endDate?: number | null;
  state?: number;
  /** Owning entity DID — required when the meta is used to build a deep-link offer. */
  entity?: string;
}

export type ApprovePaymentModalPhase =
  | { kind: 'loading'; message?: string }
  | {
      kind: 'error';
      message: string;
      /** Source collections to surface as clickable "submit a claim here" cards. */
      offers?: Array<{ collectionId: string; meta?: ApprovePaymentCollectionMeta }>;
      onOfferClick?: (collectionId: string, entity: string) => void;
    }
  | {
      kind: 'pick';
      claimsByCollection: Record<string, ClaimSummary[]>;
      collectionMeta?: Record<string, ApprovePaymentCollectionMeta>;
      selectedClaimId?: string | null;
      onSelect: (claimId: string, collectionId: string) => void;
    };

interface ApprovePaymentSourceClaimModalProps {
  open: boolean;
  phase: ApprovePaymentModalPhase;
  onClose: () => void;
}

const COLLECTION_STATE_OPEN = 0;

function formatDate(ts: number | string | null | undefined): string {
  if (!ts) return '';
  try {
    return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

function formatDateY(ms: number | null | undefined): string {
  if (!ms) return '';
  try {
    return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return '';
  }
}

function shortenId(id: string): string {
  if (!id) return '';
  return id.length > 15 ? `${id.slice(0, 7)}...${id.slice(-5)}` : id;
}

function isCollectionActive(meta?: ApprovePaymentCollectionMeta): boolean | null {
  if (!meta || meta.state === undefined) return null;
  const now = Date.now();
  if (meta.state !== COLLECTION_STATE_OPEN) return false;
  if (meta.startDate && meta.startDate > now) return false;
  if (meta.endDate && meta.endDate < now) return false;
  if ((meta.quota ?? 0) > 0 && (meta.count ?? 0) >= (meta.quota ?? 0)) return false;
  return true;
}

function collectionStatusLabel(meta: ApprovePaymentCollectionMeta): string {
  const now = Date.now();
  const { startDate, endDate, count = 0, quota = 0 } = meta;
  if (startDate && startDate > now) return `Starts ${formatDateY(startDate)}`;
  if (endDate && endDate < now) return `Expired ${formatDateY(endDate)}`;
  if (quota > 0 && count >= quota) return `Quota reached (${count}/${quota})`;
  if (startDate && endDate) return `${formatDateY(startDate)} – ${formatDateY(endDate)}`;
  if (startDate) return `Started ${formatDateY(startDate)}`;
  if (endDate) return `Open until ${formatDateY(endDate)}`;
  return 'Open';
}

function ClaimRow({
  claim,
  selected,
  onClick,
}: {
  claim: ClaimSummary;
  selected: boolean;
  onClick: () => void;
}) {
  const address = claim.agentAddress || '';
  const userId = address ? matrixUserIdForAddress(address) : null;
  const profile = useAppSelector((s) => (userId ? s.matrixProfiles.byUserId[userId] : undefined));

  useEffect(() => {
    if (address) fetchMatrixProfileForAddress(address);
  }, [address]);

  const displayName =
    profile?.displayName || (address ? `${address.slice(0, 10)}...${address.slice(-4)}` : 'Unknown agent');
  const initial = (profile?.displayName || address || '?').charAt(0).toUpperCase();

  const classes = [styles.row];
  if (selected) classes.push(styles.rowSelected);

  return (
    <div className={classes.join(' ')} onClick={onClick} role='button' tabIndex={0}>
      <div className={styles.avatar}>
        {profile?.avatarUrl ? <img src={profile.avatarUrl} alt='' /> : initial}
      </div>
      <div className={styles.rowMain}>
        <div className={styles.rowNameRow}>
          <span className={styles.rowName}>{displayName}</span>
          <span className={`${styles.rowMeta} ${styles.rowMetaEnd}`}>{formatDate(claim.submissionDate)}</span>
        </div>
        <div className={styles.rowIdRow}>
          <span className={styles.rowClaimId}>{shortenId(claim.claimId)}</span>
        </div>
      </div>
    </div>
  );
}

function CollectionCard({
  collectionId,
  meta,
  claimCount,
  onClick,
}: {
  collectionId: string;
  meta?: ApprovePaymentCollectionMeta;
  claimCount?: number;
  onClick: () => void;
}) {
  const shortId = collectionId.length > 12 ? `${collectionId.slice(0, 6)}…${collectionId.slice(-4)}` : collectionId;
  const name = meta?.name || `Collection ${shortId}`;
  const active = isCollectionActive(meta);
  const idClasses = [styles.cardId];
  if (active === true) idClasses.push(styles.cardIdActive);
  else if (active === false) idClasses.push(styles.cardIdInactive);

  return (
    <div className={styles.row} onClick={onClick} role='button' tabIndex={0}>
      <div className={styles.rowMain}>
        <div className={idClasses.join(' ')}>{collectionId}</div>
        <div className={styles.cardName}>{name}</div>
        <div className={styles.cardFooter}>
          <span className={styles.cardFooterText}>{meta ? collectionStatusLabel(meta) : ''}</span>
          {typeof claimCount === 'number' && (
            <span className={`${styles.cardFooterText} ${styles.cardCount}`}>
              {claimCount} {claimCount === 1 ? 'claim' : 'claims'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ApprovePaymentSourceClaimModal({
  open,
  phase,
  onClose,
}: ApprovePaymentSourceClaimModalProps) {
  // Internal collection / claim picker state — only used when phase.kind === 'pick'.
  const pickerData = phase.kind === 'pick' ? phase : null;
  const collectionIds = useMemo(
    () =>
      pickerData
        ? Object.keys(pickerData.claimsByCollection).filter(
            (id) => (pickerData.claimsByCollection[id] ?? []).length > 0,
          )
        : [],
    [pickerData],
  );

  const initialView: 'collections' | 'list' = collectionIds.length > 1 ? 'collections' : 'list';
  const initialCollection = collectionIds.length === 1 ? collectionIds[0] : null;

  const [view, setView] = useState<'collections' | 'list'>(initialView);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(initialCollection);
  const [pending, setPending] = useState<string | null>(null);

  // Reset internal state if the input set of collections changes meaningfully.
  useEffect(() => {
    if (phase.kind !== 'pick') return;
    setView(collectionIds.length > 1 ? 'collections' : 'list');
    setSelectedCollectionId(collectionIds.length === 1 ? collectionIds[0] : null);
    setPending(null);
  }, [phase.kind, collectionIds.length, collectionIds[0]]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null;
  const portalRoot = typeof document !== 'undefined' ? document.getElementById('modal-root') : null;
  if (!portalRoot) return null;

  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose();
  }

  function handlePickCollection(id: string) {
    setSelectedCollectionId(id);
    setView('list');
  }

  function handlePickClaim(claim: ClaimSummary) {
    if (pickerData?.kind !== 'pick') return;
    setPending(claim.claimId);
    pickerData.onSelect(claim.claimId, claim.collectionId);
  }

  function handleBackToCollections() {
    setView('collections');
    setSelectedCollectionId(null);
  }

  // ───────────── Header ─────────────
  let title: string;
  let showBack = false;
  if (phase.kind === 'loading') {
    title = 'Approve Payment';
  } else if (phase.kind === 'error') {
    title = 'Approve Payment';
  } else if (collectionIds.length > 1 && view === 'list' && selectedCollectionId) {
    title = ''; // titleStack below
  } else if (view === 'collections') {
    title = 'Select a collection';
  } else {
    title = 'Select a claim';
  }
  showBack = phase.kind === 'pick' && collectionIds.length > 1 && view === 'list';

  const selectedMeta = pickerData && selectedCollectionId ? pickerData.collectionMeta?.[selectedCollectionId] : undefined;

  return ReactDOM.createPortal(
    <div className={styles.overlay} role='dialog' aria-modal='true' onClick={handleBackdropClick}>
      <div className={styles.modal}>
        <div className={styles.header}>
          {showBack && (
            <button
              type='button'
              className={styles.iconBtn}
              onClick={handleBackToCollections}
              aria-label='Back to collections'
            >
              <ArrowLeft />
            </button>
          )}
          {phase.kind === 'pick' && view === 'list' && selectedCollectionId ? (
            <div className={styles.titleStack}>
              <span className={styles.titleStackName}>
                {selectedMeta?.name || `Collection ${shortenId(selectedCollectionId)}`}
              </span>
              <span className={styles.titleStackId}>{selectedCollectionId}</span>
            </div>
          ) : (
            <h2 className={styles.title}>{title}</h2>
          )}
          <div className={styles.headerActions}>
            <button type='button' className={styles.iconBtn} onClick={onClose} aria-label='Close'>
              <Cross color='currentColor' />
            </button>
          </div>
        </div>

        <div className={`${styles.body} ${styles.listBody}`}>
          {phase.kind === 'loading' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: 24 }}>
              <div className={styles.spinner}>
                <div className={styles.spinnerInner} />
              </div>
              {phase.message && (
                <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center' }}>
                  {phase.message}
                </p>
              )}
            </div>
          )}

          {phase.kind === 'error' && (
            <>
              <SubclaimModalErrorCard message={phase.message} />
              {phase.offers && phase.offers.length > 0 && (
                <div className={styles.list} style={{ marginTop: 12 }}>
                  {phase.offers.map((offer) => (
                    <CollectionCard
                      key={offer.collectionId}
                      collectionId={offer.collectionId}
                      meta={offer.meta}
                      onClick={() => {
                        if (offer.meta?.entity && phase.onOfferClick) {
                          phase.onOfferClick(offer.collectionId, offer.meta.entity);
                        }
                      }}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {phase.kind === 'pick' && view === 'collections' && (
            <div className={styles.list}>
              {collectionIds.length === 0 ? (
                <div className={styles.emptyMessage}>No matching collections available.</div>
              ) : (
                collectionIds.map((id) => (
                  <CollectionCard
                    key={id}
                    collectionId={id}
                    meta={pickerData?.collectionMeta?.[id]}
                    claimCount={(pickerData?.claimsByCollection[id] ?? []).length}
                    onClick={() => handlePickCollection(id)}
                  />
                ))
              )}
            </div>
          )}

          {phase.kind === 'pick' && view === 'list' && (
            <div className={styles.list}>
              {(() => {
                const claims = selectedCollectionId
                  ? pickerData?.claimsByCollection[selectedCollectionId] ?? []
                  : [];
                if (claims.length === 0) {
                  return <div className={styles.emptyMessage}>No matching claims available.</div>;
                }
                return claims.map((c) => (
                  <ClaimRow
                    key={c.claimId}
                    claim={c}
                    selected={pending === c.claimId || pickerData?.selectedClaimId === c.claimId}
                    onClick={() => handlePickClaim(c)}
                  />
                ));
              })()}
            </div>
          )}
        </div>
      </div>
    </div>,
    portalRoot,
  );
}
