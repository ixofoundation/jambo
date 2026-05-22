import { MouseEvent, useEffect, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { useRouter } from 'next/router';
import cls from 'classnames';
import { createQueryClient, createRegistry } from '@ixo/impactxclient-sdk';
import { GrantAuthorization } from '@ixo/impactxclient-sdk/types/codegen/cosmos/authz/v1beta1/authz';
import { createMatrixClaimBotClient } from '@ixo/matrixclient-sdk';
import { Model } from 'survey-core';
import { Survey } from 'survey-react-ui';

import Cross from '@icons/cross.svg';
import Reload from '@icons/reload.svg';
import ArrowLeft from '@icons/arrow_left.svg';
import { fetchAllClaimsByCollectionId, fetchCollectionByCollectionId } from '@utils/claims';
import { fetchProtocolEntity } from '@utils/entity';
import { getAdditionalInfo, getCachedTemplate, getServiceEndpoint } from '@utils/url';
import { convertTimestampObjectToTimestamp } from '@utils/timestamp';
import { setVctTemplate } from '@store/slices/protocolsSlice';
import { useAppDispatch, useAppSelector } from '@store/hooks';
import { fetchClaimsWithSubclaims } from '@store/thunks/subclaimsThunks';
import { selectClaimsWithSubclaims } from '@store/selectors/subclaims';
import { getCollectionLinks } from '../../lib/yomaWorker/client';
import { withMatrixOpenIdRetry } from '@utils/matrix';
import { fetchMatrixProfileForAddress, matrixUserIdForAddress } from '@utils/matrixProfile';
import { secret } from '@utils/secrets';
import { CHAIN_RPC_URL } from '@constants/common';
import { TRANSACTION_TYPES } from '@constants/transaction';
import { themeJson } from '@constants/surveyTheme';
import { configureFileQuestions, createAttachDownloadHandler } from '@constants/surveyDefaultConfig';
import { createAttachPdfPreviewHandler } from '@constants/surveyPdfPreview';

import FloatingClaimButton from './FloatingClaimButton';
import SubclaimModalErrorCard from './SubclaimModalErrorCard';
import { CheckIcon, ChevronIcon, ClockIcon, CrossIcon, ShrinkIcon, WarningIcon } from './icons';
import styles from './SubclaimModal.module.scss';

type BlockReason = null | 'not-configured' | 'worker-unreachable' | 'no-eval-authz' | 'no-submit-authz';

const FATAL_REASONS: Exclude<BlockReason, null>[] = ['not-configured', 'worker-unreachable', 'no-submit-authz'];

type CollectionMetaEntry =
  | { status: 'loading' }
  | { status: 'error' }
  | {
      status: 'ready';
      name: string | null;
      state: number;
      startDate: number | null;
      endDate: number | null;
      count: number;
      quota: number;
    };

// ixo CollectionState enum: OPEN = 0 (active), PAUSED = 1, CLOSED = 2.
const COLLECTION_STATE_OPEN = 0;

interface SubclaimModalProps {
  open: boolean;
  subclaimCollectionId: string;
  address: string;
  did: string;
  selectedParentClaimId: string | null;
  onSelect: (claimId: string | null) => void;
  onBlockedChange: (reason: BlockReason) => void;
  onParentResolved?: (parentCollectionId: string) => void;
}

function formatDate(ts: number | string | null | undefined): string {
  if (!ts) return '';
  try {
    return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

function formatDateY(ms: number | null): string {
  if (!ms) return '';
  try {
    return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return '';
  }
}

// On-chain quota/count come back as proto Long; normalise to a plain number.
function toNum(v: any): number {
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  if (typeof v === 'bigint') return Number(v);
  if (typeof v === 'object' && typeof v.toNumber === 'function') {
    try {
      return v.toNumber();
    } catch {
      return 0;
    }
  }
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// On-chain start/end dates are proto Timestamp objects; epoch / pre-1970 means "unset".
function tsToMs(ts: any): number | null {
  if (!ts) return null;
  let ms: number | undefined;
  if (typeof ts === 'object' && ('seconds' in ts || 'nanos' in ts)) {
    ms = convertTimestampObjectToTimestamp(ts);
  } else if (typeof ts === 'number') {
    ms = ts;
  } else if (typeof ts === 'string') {
    const parsed = Date.parse(ts);
    ms = Number.isNaN(parsed) ? undefined : parsed;
  }
  if (ms == null || !Number.isFinite(ms)) return null;
  if (new Date(ms).getFullYear() <= 1970) return null;
  return ms;
}

function collectionStatusLabel(meta: {
  startDate: number | null;
  endDate: number | null;
  count: number;
  quota: number;
}): string {
  const now = Date.now();
  const { startDate, endDate, count, quota } = meta;
  if (startDate && startDate > now) return `Starts ${formatDateY(startDate)}`;
  if (endDate && endDate < now) return `Expired ${formatDateY(endDate)}`;
  if (quota > 0 && count >= quota) return `Quota reached (${count}/${quota})`;
  if (startDate && endDate) return `${formatDateY(startDate)} – ${formatDateY(endDate)}`;
  if (startDate) return `Started ${formatDateY(startDate)}`;
  if (endDate) return `Open until ${formatDateY(endDate)}`;
  return 'Open';
}

// A base collection is "active" only when it is OPEN, currently within its date
// window, and has not reached its quota.
function isCollectionActive(meta: {
  state: number;
  startDate: number | null;
  endDate: number | null;
  count: number;
  quota: number;
}): boolean {
  const now = Date.now();
  const { state, startDate, endDate, count, quota } = meta;
  if (state !== COLLECTION_STATE_OPEN) return false;
  if (startDate && startDate > now) return false;
  if (endDate && endDate < now) return false;
  if (quota > 0 && count >= quota) return false;
  return true;
}

// Best-effort human-readable name for a base claim collection, resolved from its
// protocol's survey template title. Returns null on any failure (caller falls back).
async function resolveCollectionName(col: any): Promise<string | null> {
  const protocolDid = col?.protocol;
  if (!protocolDid) return null;
  const protocolEntity = await fetchProtocolEntity(protocolDid);
  const endpoint =
    protocolEntity?.linkedResource?.find((r: any) => r?.id?.includes('#vct')) ??
    protocolEntity?.linkedResource?.find((r: any) => r?.id?.includes('surveyTemplate'));
  if (!endpoint?.serviceEndpoint) return null;
  const url = getServiceEndpoint(endpoint.serviceEndpoint, protocolEntity?.service);
  let template = getCachedTemplate(protocolDid, 'vct', url);
  if (!template) {
    template = await getAdditionalInfo(url);
  }
  const templateData = template?.question ?? template;
  const title = templateData?.title;
  return typeof title === 'string' && title.trim() ? title.trim() : null;
}

function statusLabel(claim: any): string {
  const s = claim?.evaluationByClaimId?.status;
  if (s === 1) return 'Approved';
  if (s === 2) return 'Rejected';
  if (s === 3) return 'Disputed';
  return 'Pending';
}

// Shorten a claim id to "first7...last5".
function shortenId(id: string): string {
  if (!id) return '';
  return id.length > 15 ? `${id.slice(0, 7)}...${id.slice(-5)}` : id;
}

function StatusBadge({ claim }: { claim: any }) {
  const s = claim?.evaluationByClaimId?.status;
  const label = statusLabel(claim);
  let modifier = styles.statusBadgePending;
  let icon = <ClockIcon />;
  if (s === 1) {
    modifier = styles.statusBadgeApproved;
    icon = <CheckIcon />;
  } else if (s === 2) {
    modifier = styles.statusBadgeRejected;
    icon = <CrossIcon />;
  } else if (s === 3) {
    modifier = styles.statusBadgeDisputed;
    icon = <WarningIcon />;
  }
  return (
    <span className={`${styles.statusBadge} ${modifier}`} role='img' aria-label={label} title={label}>
      {icon}
    </span>
  );
}

function ClaimRow({
  claim,
  selected,
  disabled,
  onClick,
}: {
  claim: any;
  selected: boolean;
  disabled: boolean;
  onClick?: () => void;
}) {
  const address = (claim.agentAddress as string) || '';
  const userId = address ? matrixUserIdForAddress(address) : null;
  const profile = useAppSelector((s) => (userId ? s.matrixProfiles.byUserId[userId] : undefined));

  useEffect(() => {
    if (address) {
      fetchMatrixProfileForAddress(address);
    }
  }, [address]);

  const displayName =
    profile?.displayName || (address ? `${address.slice(0, 10)}...${address.slice(-4)}` : 'Unknown agent');
  const initial = (profile?.displayName || address || '?').charAt(0).toUpperCase();

  const classes = [styles.row];
  if (selected) classes.push(styles.rowSelected);
  if (disabled) classes.push(styles.rowDisabled);

  const interactive = !disabled && !!onClick;

  return (
    <div
      className={classes.join(' ')}
      onClick={onClick}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
    >
      <div className={styles.avatar}>{profile?.avatarUrl ? <img src={profile.avatarUrl} alt='' /> : initial}</div>
      <div className={styles.rowMain}>
        <div className={styles.rowNameRow}>
          <span className={styles.rowName}>{displayName}</span>
          <span className={`${styles.rowMeta} ${styles.rowMetaEnd}`}>
            {formatDate(claim.submissionDate)}
            {disabled ? ' · already has subclaim' : ''}
          </span>
        </div>
        <div className={styles.rowIdRow}>
          <span className={styles.rowClaimId}>{shortenId(claim.claimId)}</span>
          <StatusBadge claim={claim} />
        </div>
      </div>
    </div>
  );
}

function CollectionCard({
  collectionId,
  meta,
  selected,
  onClick,
}: {
  collectionId: string;
  meta: CollectionMetaEntry | undefined;
  selected: boolean;
  onClick: () => void;
}) {
  const shortId = collectionId.length > 12 ? `${collectionId.slice(0, 6)}…${collectionId.slice(-4)}` : collectionId;
  const name = meta?.status === 'ready' && meta.name ? meta.name : `Collection ${shortId}`;

  const classes = [styles.row];
  if (selected) classes.push(styles.rowSelected);

  const active = meta?.status === 'ready' ? isCollectionActive(meta) : null;
  const idClasses = [styles.cardId];
  if (active === true) idClasses.push(styles.cardIdActive);
  else if (active === false) idClasses.push(styles.cardIdInactive);

  return (
    <div className={classes.join(' ')} onClick={onClick} role='button' tabIndex={0}>
      <div className={styles.rowMain}>
        <div className={idClasses.join(' ')}>{collectionId}</div>
        <div className={styles.cardName}>{name}</div>
        {meta?.status === 'ready' ? (
          <div className={styles.cardFooter}>
            <span className={styles.cardFooterText}>{collectionStatusLabel(meta)}</span>
            <span className={`${styles.cardFooterText} ${styles.cardCount}`}>
              {meta.quota > 0 ? `${meta.count}/${meta.quota}` : meta.count}
            </span>
          </div>
        ) : meta?.status === 'error' ? (
          <div className={styles.cardMetaMuted}>Couldn’t load collection details</div>
        ) : (
          <div className={styles.cardMetaMuted}>Loading details…</div>
        )}
      </div>
    </div>
  );
}

function CollapsibleSection({
  id,
  label,
  count,
  expanded,
  onToggle,
  children,
}: {
  id: string;
  label: string;
  count: number;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const contentId = `${id}-content`;
  return (
    <div className={styles.listBox}>
      <button
        type='button'
        className={styles.listBoxHeader}
        aria-expanded={expanded}
        aria-controls={contentId}
        onClick={onToggle}
      >
        <span>{label}</span>
        <span className={styles.collapsibleCount}>{count}</span>
        <ChevronIcon className={cls(styles.collapsibleChevron, { [styles.collapsibleChevronOpen]: expanded })} />
      </button>
      {expanded && (
        <div id={contentId} role='region' aria-label={label} className={styles.listBoxRows}>
          {children}
        </div>
      )}
    </div>
  );
}

export default function SubclaimModal({
  open,
  subclaimCollectionId,
  address,
  did,
  selectedParentClaimId,
  onSelect,
  onBlockedChange,
  onParentResolved,
}: SubclaimModalProps) {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const [parentCollectionId, setParentCollectionId] = useState<string | null>(null);
  const [baseCollections, setBaseCollections] = useState<string[]>([]);
  const [collectionMeta, setCollectionMeta] = useState<Record<string, CollectionMetaEntry>>({});
  const [discovering, setDiscovering] = useState(true);
  const claimsWithSubclaims = useAppSelector((s) =>
    parentCollectionId ? selectClaimsWithSubclaims(s, parentCollectionId) : undefined,
  );

  const [mounted, setMounted] = useState(false);
  const [view, setView] = useState<'collections' | 'list' | 'detail'>('list');
  const [minimized, setMinimized] = useState(false);
  const [loadingClaims, setLoadingClaims] = useState(false);
  const [claims, setClaims] = useState<any[]>([]);
  const [needsExpanded, setNeedsExpanded] = useState(true);
  const [doneExpanded, setDoneExpanded] = useState(false);
  const [blockReason, setBlockReason] = useState<BlockReason>(null);
  const [authzChecked, setAuthzChecked] = useState(false);
  const [hasEvalAuthz, setHasEvalAuthz] = useState(false);
  const [submitAuthzChecked, setSubmitAuthzChecked] = useState(false);
  const [hasSubmitAuthz, setHasSubmitAuthz] = useState(false);
  const [discoveryNonce, setDiscoveryNonce] = useState(0);

  const [parentTemplate, setParentTemplate] = useState<string | null>(null);
  const [parentTemplateError, setParentTemplateError] = useState<{ message: string; retryable: boolean } | null>(null);
  const [parentTemplateNonce, setParentTemplateNonce] = useState(0);
  const claimDataCacheRef = useRef<Record<string, Record<string, any>>>({});
  const [viewedClaimData, setViewedClaimData] = useState<Record<string, any> | null>(null);
  const [viewedClaimLoading, setViewedClaimLoading] = useState(false);
  const [viewedClaimError, setViewedClaimError] = useState<string | null>(null);
  const claimBotClientRef = useRef<ReturnType<typeof createMatrixClaimBotClient>>();

  const modalRef = useRef<HTMLDivElement>(null);

  // Hold the latest onParentResolved in a ref so the discovery effect can call it
  // without listing it as a dependency. Parents pass it as an inline arrow, so its
  // identity changes on every render and would otherwise re-fire discovery (which
  // resets parentCollectionId+view in the multi-base branch).
  const onParentResolvedRef = useRef(onParentResolved);
  useEffect(() => {
    onParentResolvedRef.current = onParentResolved;
  }, [onParentResolved]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setDiscovering(true);
    (async () => {
      const res = await getCollectionLinks(subclaimCollectionId);
      if (cancelled) return;
      if (res.ok) {
        const bases = res.data.base ?? [];
        setBaseCollections(bases);
        if (bases.length === 0) {
          setParentCollectionId(null);
          setBlockReason((prev) => (prev === 'no-submit-authz' ? prev : 'not-configured'));
        } else if (bases.length === 1) {
          setParentCollectionId(bases[0]);
          onParentResolvedRef.current?.(bases[0]);
          setBlockReason((prev) => (prev === 'not-configured' || prev === 'worker-unreachable' ? null : prev));
          setView((v) => (v === 'collections' ? 'list' : v));
        } else {
          setParentCollectionId(null);
          setBlockReason((prev) => (prev === 'not-configured' || prev === 'worker-unreachable' ? null : prev));
          setView('collections');
        }
      } else if (res.reason === 'not-found' || res.reason === 'disabled') {
        setBaseCollections([]);
        setParentCollectionId(null);
        setBlockReason((prev) => (prev === 'no-submit-authz' ? prev : 'not-configured'));
      } else {
        setBaseCollections([]);
        setParentCollectionId(null);
        setBlockReason((prev) => (prev === 'no-submit-authz' ? prev : 'worker-unreachable'));
      }
      setDiscovering(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [subclaimCollectionId, discoveryNonce]);

  // Load display metadata (name, quota, start/end) for each base collection when there
  // is more than one to choose between.
  useEffect(() => {
    if (baseCollections.length <= 1) return;
    let cancelled = false;
    setCollectionMeta((prev) => {
      const next = { ...prev };
      for (const id of baseCollections) {
        if (!next[id] || next[id].status === 'error') next[id] = { status: 'loading' };
      }
      return next;
    });
    baseCollections.forEach((id) => {
      (async () => {
        try {
          const col = await fetchCollectionByCollectionId(id);
          const startDate = tsToMs((col as any).startDate);
          const endDate = tsToMs((col as any).endDate);
          const count = toNum((col as any).count);
          const quota = toNum((col as any).quota);
          const state = toNum((col as any).state);
          let name: string | null = null;
          try {
            name = await resolveCollectionName(col);
          } catch {
            name = null;
          }
          if (cancelled) return;
          setCollectionMeta((prev) => ({
            ...prev,
            [id]: { status: 'ready', name, state, startDate, endDate, count, quota },
          }));
        } catch (err) {
          console.warn('[SubclaimModal] load base collection meta failed', id, err);
          if (cancelled) return;
          setCollectionMeta((prev) => ({ ...prev, [id]: { status: 'error' } }));
        }
      })();
    });
    return () => {
      cancelled = true;
    };
  }, [baseCollections]);

  useEffect(() => {
    if (discovering || !parentCollectionId) return;
    if (authzChecked && !hasEvalAuthz) {
      setBlockReason((prev) => (prev === 'no-submit-authz' ? prev : 'no-eval-authz'));
      return;
    }
    setBlockReason((prev) => (prev === 'no-eval-authz' ? null : prev));
  }, [discovering, parentCollectionId, authzChecked, hasEvalAuthz]);

  useEffect(() => {
    if (!submitAuthzChecked) return;
    if (!hasSubmitAuthz) {
      setBlockReason('no-submit-authz');
    } else {
      setBlockReason((prev) => (prev === 'no-submit-authz' ? null : prev));
    }
  }, [submitAuthzChecked, hasSubmitAuthz]);

  useEffect(() => {
    onBlockedChange(blockReason);
  }, [blockReason, onBlockedChange]);

  useEffect(() => {
    if (!subclaimCollectionId) return;
    let cancelled = false;
    (async () => {
      try {
        const subclaimCol = await fetchCollectionByCollectionId(subclaimCollectionId);
        const queryClient = await createQueryClient(CHAIN_RPC_URL);
        const granteeGrants = await queryClient.cosmos.authz.v1beta1.granteeGrants({ grantee: address });
        const registry = createRegistry();
        const grants = granteeGrants.grants as GrantAuthorization[];
        const hasSubmit = grants?.some((g) => {
          if (
            g.authorization?.typeUrl !== TRANSACTION_TYPES.SubmitClaimAuthorization ||
            g.granter !== subclaimCol.admin
          )
            return false;
          try {
            const decoded = registry.decode(g.authorization);
            const constraints = decoded.constraints ?? [];
            if (constraints.length === 0) return true;
            return constraints.some((c: any) => c.collectionId === subclaimCollectionId);
          } catch {
            return false;
          }
        });
        if (cancelled) return;
        setHasSubmitAuthz(!!hasSubmit);
        setSubmitAuthzChecked(true);
      } catch (err) {
        if (cancelled) return;
        console.warn('[SubclaimModal] submit authz check failed', err);
        setHasSubmitAuthz(false);
        setSubmitAuthzChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [subclaimCollectionId, address]);

  useEffect(() => {
    if (!parentCollectionId) return;
    let cancelled = false;
    (async () => {
      try {
        const parentCol = await fetchCollectionByCollectionId(parentCollectionId);
        const queryClient = await createQueryClient(CHAIN_RPC_URL);
        const granteeGrants = await queryClient.cosmos.authz.v1beta1.granteeGrants({ grantee: address });
        const registry = createRegistry();
        const grants = granteeGrants.grants as GrantAuthorization[];
        const hasEval = grants?.some((g) => {
          if (
            g.authorization?.typeUrl !== TRANSACTION_TYPES.EvaluateClaimAuthorization ||
            g.granter !== parentCol.admin
          )
            return false;
          try {
            const decoded = registry.decode(g.authorization);
            const constraints = decoded.constraints ?? [];
            if (constraints.length === 0) return true;
            return constraints.some((c: any) => c.collectionId === parentCollectionId);
          } catch {
            return false;
          }
        });
        if (cancelled) return;
        setHasEvalAuthz(!!hasEval);
        setAuthzChecked(true);
      } catch (err) {
        if (cancelled) return;
        console.warn('[SubclaimModal] authz check failed', err);
        setHasEvalAuthz(false);
        setAuthzChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [parentCollectionId, address]);

  useEffect(() => {
    if (!parentCollectionId || !hasEvalAuthz) return;
    let cancelled = false;
    (async () => {
      setLoadingClaims(true);
      try {
        const [list] = await Promise.all([
          fetchAllClaimsByCollectionId(parentCollectionId),
          (dispatch as any)(fetchClaimsWithSubclaims({ parentCollectionId })),
        ]);
        if (!cancelled) setClaims(list ?? []);
      } catch (err) {
        console.warn('[SubclaimModal] fetch parent claims failed', err);
        if (!cancelled) setClaims([]);
      } finally {
        if (!cancelled) setLoadingClaims(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [parentCollectionId, hasEvalAuthz, dispatch]);

  useEffect(() => {
    if (!parentCollectionId || !hasEvalAuthz || parentTemplate) return;
    if (view !== 'detail') return;
    let cancelled = false;
    (async () => {
      setParentTemplateError(null);
      try {
        const parentCol = await fetchCollectionByCollectionId(parentCollectionId);
        const protocolDid = parentCol.protocol;
        const protocolEntity = await fetchProtocolEntity(protocolDid);
        const endpoint =
          protocolEntity?.linkedResource?.find((r: any) => r?.id?.includes('#vct')) ??
          protocolEntity?.linkedResource?.find((r: any) => r?.id?.includes('surveyTemplate'));
        if (!endpoint?.serviceEndpoint) {
          if (cancelled) return;
          setParentTemplateError({
            message: 'The base claim form template is not configured. Please contact support.',
            retryable: false,
          });
          return;
        }
        const url = getServiceEndpoint(endpoint.serviceEndpoint, protocolEntity?.service);
        const cached = getCachedTemplate(protocolDid, 'vct', url);
        if (cancelled) return;
        if (cached) {
          setParentTemplate(JSON.stringify(cached));
        } else {
          const formData = await getAdditionalInfo(url);
          if (cancelled) return;
          dispatch(setVctTemplate({ protocolDid, template: formData, url }));
          setParentTemplate(JSON.stringify(formData));
        }
      } catch (err) {
        if (cancelled) return;
        console.warn('[SubclaimModal] load parent template failed', err);
        const reason = err instanceof Error ? err.message : String(err);
        setParentTemplateError({
          message: `Unable to load the base claim form template — ${
            reason || 'unknown error'
          }. Please check your connection and try again or contact support.`,
          retryable: true,
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [parentCollectionId, hasEvalAuthz, view, parentTemplate, parentTemplateNonce, dispatch]);

  function getClaimBotClient() {
    const token = secret.accessToken as string | null;
    if (claimBotClientRef.current?.claim && token) return claimBotClientRef.current;
    claimBotClientRef.current = undefined;
    if (!token) return null;
    claimBotClientRef.current = createMatrixClaimBotClient({
      homeServerUrl: process.env.NEXT_PUBLIC_MATRIX_HOMESERVER_URL!,
      botUrl: process.env.NEXT_PUBLIC_MATRIX_CLAIM_BOT_URL!,
      accessToken: token,
    });
    return claimBotClientRef.current;
  }

  async function loadParentClaimData(claimId: string) {
    if (!parentCollectionId) return;
    const cached = claimDataCacheRef.current[claimId];
    if (cached) {
      setViewedClaimError(null);
      setViewedClaimData(cached);
      return;
    }
    setViewedClaimError(null);
    setViewedClaimLoading(true);
    try {
      const client = getClaimBotClient();
      if (!client) {
        setViewedClaimData(null);
        setViewedClaimError('The base-claim service is unavailable right now.');
        return;
      }
      const response = await withMatrixOpenIdRetry((token) =>
        client.claim.v1beta1.queryClaim(parentCollectionId, claimId, token, did),
      );
      let data: Record<string, any> = {};
      if (response) {
        let parsed: any = typeof response === 'string' ? JSON.parse(response) : response;
        if (parsed?.data && !parsed?.credentialSubject)
          parsed = typeof parsed.data === 'string' ? JSON.parse(parsed.data) : parsed.data;
        if (parsed?.credentialSubject) {
          const { id, type, ...rest } = parsed.credentialSubject;
          data = rest;
        } else {
          data = parsed;
        }
      }
      claimDataCacheRef.current[claimId] = data;
      setViewedClaimData(data);
    } catch (err) {
      console.warn('[SubclaimModal] load claim data failed', err);
      const reason = err instanceof Error ? err.message : String(err);
      setViewedClaimData(null);
      setViewedClaimError(
        `The selected claim's data failed to fetch — ${reason || 'unknown error'}. Please try again.`,
      );
    } finally {
      setViewedClaimLoading(false);
    }
  }

  function handleSelectClaim(claimId: string) {
    onSelect(claimId);
    setViewedClaimData(null);
    setViewedClaimError(null);
    loadParentClaimData(claimId);
    setView('detail');
  }

  function handleBackToList() {
    setViewedClaimError(null);
    setView('list');
  }

  // Clears everything derived from the currently selected base collection so a different
  // collection (or no collection) can be loaded cleanly.
  function resetParentState() {
    setClaims([]);
    setLoadingClaims(false);
    setAuthzChecked(false);
    setHasEvalAuthz(false);
    setParentTemplate(null);
    setParentTemplateError(null);
    setViewedClaimData(null);
    setViewedClaimError(null);
    claimDataCacheRef.current = {};
    setBlockReason((prev) => (prev === 'no-eval-authz' ? null : prev));
  }

  function handleSelectCollection(id: string) {
    if (id === parentCollectionId) {
      setView('list');
      return;
    }
    onSelect(null);
    resetParentState();
    setParentCollectionId(id);
    onParentResolved?.(id);
    setView('list');
  }

  function handleBackToCollections() {
    if (baseCollections.length <= 1) return;
    onSelect(null);
    resetParentState();
    setParentCollectionId(null);
    setView('collections');
  }

  const parentSurvey = useMemo(() => {
    if (!parentTemplate || !viewedClaimData) return undefined;
    try {
      const parsed = JSON.parse(parentTemplate);
      const templateData = parsed?.question ?? parsed;
      if (typeof templateData.showProgressBar === 'boolean') {
        templateData.showProgressBar = templateData.showProgressBar ? templateData.progressBarLocation || 'top' : 'off';
      }
      const model = new Model(templateData);
      model.applyTheme(themeJson);
      configureFileQuestions(model);
      createAttachDownloadHandler(did)(model);
      const disposePdfPreview = createAttachPdfPreviewHandler(did)(model);
      (model as any).__disposePdfPreview = disposePdfPreview;
      model.data = viewedClaimData;
      model.mode = 'display';
      model.showCompleteButton = false;
      return model;
    } catch (err) {
      console.warn('[SubclaimModal] build parent survey failed', err);
      return undefined;
    }
  }, [parentTemplate, viewedClaimData, did]);

  useEffect(() => {
    return () => {
      if (parentSurvey) {
        const disposePdfPreview = (parentSurvey as any).__disposePdfPreview as (() => void) | undefined;
        if (disposePdfPreview) {
          disposePdfPreview();
          (parentSurvey as any).__disposePdfPreview = undefined;
        }
      }
    };
  }, [parentSurvey]);

  const { available, disabled } = useMemo(() => {
    const approvedClaims = claims.filter((c) => c?.evaluationByClaimId?.status === 1);
    const disabledSet = new Set(claimsWithSubclaims ?? []);
    const avail: any[] = [];
    const dis: any[] = [];
    for (const c of approvedClaims) {
      if (disabledSet.has(c.claimId) && c.claimId !== selectedParentClaimId) dis.push(c);
      else avail.push(c);
    }
    return { available: avail, disabled: dis };
  }, [claims, claimsWithSubclaims, selectedParentClaimId]);

  // When the list resolves to only "already has subclaims" rows, force-open
  // that section so the user isn't staring at an apparently empty modal.
  useEffect(() => {
    if (!loadingClaims && available.length === 0 && disabled.length > 0) {
      setDoneExpanded(true);
    }
  }, [loadingClaims, available.length, disabled.length]);

  const hasSelection = !!selectedParentClaimId;
  const isFatal = blockReason != null && (FATAL_REASONS as BlockReason[]).includes(blockReason);
  const detailReady = view === 'detail' && !viewedClaimError && !viewedClaimLoading && !!parentSurvey;
  const dismissBlocked = view === 'detail' && !detailReady;

  function handleClose() {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push('/');
    }
  }

  function handleMinimize() {
    setMinimized(true);
  }

  function handleExpand() {
    setMinimized(false);
    if (selectedParentClaimId) setView('detail');
  }

  function dismiss() {
    if (dismissBlocked) return;
    if (isFatal) handleClose();
    else if (hasSelection) handleMinimize();
    else handleClose();
  }

  useEffect(() => {
    if (minimized) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismiss();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minimized, hasSelection, isFatal, dismissBlocked]);

  function handleBackdropClick(e: MouseEvent<HTMLDivElement>) {
    if (dismissBlocked) return;
    if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
      dismiss();
    }
  }

  if (!open || !mounted) return null;
  const portalRoot = typeof document !== 'undefined' ? document.getElementById('modal-root') : null;
  if (!portalRoot) return null;

  if (minimized) {
    return ReactDOM.createPortal(<FloatingClaimButton onExpand={handleExpand} />, portalRoot);
  }

  const parentMeta = parentCollectionId ? collectionMeta[parentCollectionId] : undefined;
  const parentName = parentMeta?.status === 'ready' && parentMeta.name ? parentMeta.name : null;
  const title =
    view === 'collections' ? 'Select a base claim collection' : view === 'list' ? 'Select a base claim' : 'Base claim';
  const multipleBase = baseCollections.length > 1;
  const showBackToCollections = view === 'list' && multipleBase;
  const showMinimizeIcon = hasSelection && !isFatal;
  const headerIcon = showMinimizeIcon ? <ShrinkIcon /> : <Cross color='currentColor' />;
  const headerLabel = showMinimizeIcon ? 'Minimize' : 'Close';

  return ReactDOM.createPortal(
    <div className={styles.overlay} role='dialog' aria-modal='true' onClick={handleBackdropClick}>
      <div className={styles.modal} ref={modalRef}>
        <div className={styles.header}>
          {showBackToCollections && (
            <button
              type='button'
              className={styles.iconBtn}
              onClick={handleBackToCollections}
              aria-label='Back to base claim collections'
            >
              <ArrowLeft />
            </button>
          )}
          {view === 'list' && parentCollectionId ? (
            <div className={styles.titleStack}>
              <span className={styles.titleStackName}>
                {parentName ?? `Collection ${shortenId(parentCollectionId)}`}
              </span>
              <span className={styles.titleStackId}>{parentCollectionId}</span>
            </div>
          ) : (
            <h2 className={styles.title}>{title}</h2>
          )}
          <div className={styles.headerActions}>
            <button
              type='button'
              className={styles.iconBtn}
              onClick={dismiss}
              aria-label={headerLabel}
              disabled={dismissBlocked}
            >
              {headerIcon}
            </button>
          </div>
        </div>

        <div className={`${styles.body} ${view === 'detail' ? styles.detailBody : styles.listBody}`}>
          {view !== 'detail' && (
            <>
              {blockReason === 'not-configured' && (
                <SubclaimModalErrorCard
                  message={
                    <>
                      This claim collection needs to be linked to a base claim collection. Please contact support —
                      claim submission is disabled.
                    </>
                  }
                  actions={[{ label: 'Close', icon: <Cross color='currentColor' />, onClick: handleClose }]}
                />
              )}
              {blockReason === 'worker-unreachable' && (
                <SubclaimModalErrorCard
                  message={
                    <>
                      Unable to connect or determine the base claim collection. Please verify the connection and try
                      again - claim submission is disabled.
                    </>
                  }
                  actions={[
                    { label: 'Retry', icon: <Reload />, onClick: () => setDiscoveryNonce((n) => n + 1) },
                    { label: 'Close', icon: <Cross color='currentColor' />, onClick: handleClose },
                  ]}
                />
              )}
              {blockReason === 'no-eval-authz' && (
                <SubclaimModalErrorCard
                  message={
                    <>
                      You require evaluation authorization on the base claim collection to proceed. Please contact the
                      collection administrator to request access.
                    </>
                  }
                  actions={[
                    ...(multipleBase
                      ? [
                          {
                            label: 'Change collection',
                            icon: <ArrowLeft />,
                            onClick: handleBackToCollections,
                          },
                        ]
                      : []),
                    { label: 'Close', icon: <Cross color='currentColor' />, onClick: handleClose },
                  ]}
                />
              )}
              {blockReason === 'no-submit-authz' && (
                <SubclaimModalErrorCard
                  message={
                    <>
                      You require authorization to submit claims for this claim collection. Please contact the
                      collection administrator to request access.
                    </>
                  }
                  actions={[{ label: 'Close', icon: <Cross color='currentColor' />, onClick: handleClose }]}
                />
              )}
            </>
          )}
          {view === 'collections' ? (
            <>
              {!blockReason && discovering && (
                <div className={styles.spinner}>
                  <div className={styles.spinnerInner} />
                </div>
              )}
              {!blockReason && !discovering && (
                <div className={styles.listBox}>
                  <div className={styles.listBoxRows}>
                    {baseCollections.map((id) => (
                      <CollectionCard
                        key={id}
                        collectionId={id}
                        meta={collectionMeta[id]}
                        selected={id === parentCollectionId}
                        onClick={() => handleSelectCollection(id)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : view === 'list' ? (
            <>
              {!blockReason && discovering && (
                <div className={styles.spinner}>
                  <div className={styles.spinnerInner} />
                </div>
              )}

              {!blockReason &&
                !discovering &&
                (loadingClaims ? (
                  <div className={styles.spinner}>
                    <div className={styles.spinnerInner} />
                  </div>
                ) : available.length === 0 && disabled.length === 0 ? (
                  <div className={styles.emptyMessage}>No approved base claims found in this collection yet.</div>
                ) : (
                  <>
                    {available.length > 0 && (
                      <CollapsibleSection
                        id='subclaim-needs'
                        label='Select base claim'
                        count={available.length}
                        expanded={needsExpanded}
                        onToggle={() => setNeedsExpanded((v) => !v)}
                      >
                        {available.map((claim) => (
                          <ClaimRow
                            key={claim.claimId}
                            claim={claim}
                            selected={claim.claimId === selectedParentClaimId}
                            disabled={false}
                            onClick={() => handleSelectClaim(claim.claimId)}
                          />
                        ))}
                      </CollapsibleSection>
                    )}
                    {disabled.length > 0 && (
                      <CollapsibleSection
                        id='subclaim-done'
                        label='Already has subclaims'
                        count={disabled.length}
                        expanded={doneExpanded}
                        onToggle={() => setDoneExpanded((v) => !v)}
                      >
                        {disabled.map((claim) => (
                          <ClaimRow
                            key={claim.claimId}
                            claim={claim}
                            selected={claim.claimId === selectedParentClaimId}
                            disabled={false}
                            onClick={() => handleSelectClaim(claim.claimId)}
                          />
                        ))}
                      </CollapsibleSection>
                    )}
                  </>
                ))}
            </>
          ) : viewedClaimError ? (
            <SubclaimModalErrorCard
              className={styles.errorCardDetailInset}
              message={viewedClaimError}
              actions={[
                { label: 'Back to list', icon: <ArrowLeft />, onClick: handleBackToList },
                {
                  label: 'Try again',
                  icon: <Reload />,
                  onClick: () => selectedParentClaimId && loadParentClaimData(selectedParentClaimId),
                },
              ]}
            />
          ) : parentTemplateError ? (
            <SubclaimModalErrorCard
              className={styles.errorCardDetailInset}
              message={parentTemplateError.message}
              actions={[
                { label: 'Back to list', icon: <ArrowLeft />, onClick: handleBackToList },
                ...(parentTemplateError.retryable
                  ? [
                      {
                        label: 'Try again',
                        icon: <Reload />,
                        onClick: () => setParentTemplateNonce((n) => n + 1),
                      },
                    ]
                  : []),
              ]}
            />
          ) : (
            <>
              <div className={styles.infoNote}>
                Reference data from this base claim while completing your claim. Got the wrong base claim? Change{' '}
                <button type='button' className={styles.inlineLink} onClick={handleBackToList}>
                  here
                </button>
                .
              </div>
              {viewedClaimLoading || !parentSurvey ? (
                <div className={styles.spinner}>
                  <div className={styles.spinnerInner} />
                </div>
              ) : (
                // @ts-ignore
                <Survey model={parentSurvey} />
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    portalRoot,
  );
}
