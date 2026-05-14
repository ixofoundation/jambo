import { MouseEvent, ReactNode, useEffect, useMemo, useRef, useState } from 'react';
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
import { ShrinkIcon } from './icons';
import styles from './SubclaimModal.module.scss';

type BlockReason = null | 'not-configured' | 'worker-unreachable' | 'no-eval-authz' | 'no-submit-authz';

const FATAL_REASONS: Exclude<BlockReason, null>[] = ['not-configured', 'worker-unreachable', 'no-submit-authz'];

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

function formatDate(ts: number | string | undefined): string {
  if (!ts) return '';
  try {
    return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

function statusLabel(claim: any): { text: string; color: string; bg: string } {
  const s = claim?.evaluationByClaimId?.status;
  if (s === 1) return { text: 'Approved', color: '#2F6A59', bg: '#dcfce7' };
  if (s === 2) return { text: 'Rejected', color: '#991b1b', bg: '#fee2e2' };
  if (s === 3) return { text: 'Disputed', color: '#E49526', bg: '#fef3c7' };
  return { text: 'Pending', color: '#545859', bg: '#F3F6FA' };
}

function ClaimRow({
  claim,
  selected,
  disabled,
  onClick,
  rightSlot,
}: {
  claim: any;
  selected: boolean;
  disabled: boolean;
  onClick?: () => void;
  rightSlot?: ReactNode;
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
  const status = statusLabel(claim);

  const classes = [styles.row];
  if (selected) classes.push(styles.rowSelected);
  if (disabled) classes.push(styles.rowDisabled);

  const interactive = !disabled && !!onClick;

  return (
    <div
      className={classes.join(' ')}
      // onClick={interactive ? onClick : undefined}
      onClick={onClick}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
    >
      <div className={styles.avatar}>{profile?.avatarUrl ? <img src={profile.avatarUrl} alt='' /> : initial}</div>
      <div className={styles.rowMain}>
        <div className={styles.rowName}>{displayName}</div>
        <div className={styles.rowClaimId}>{claim.claimId}</div>
        <div className={styles.rowMeta}>
          {formatDate(claim.submissionDate)}
          {disabled ? ' · already has subclaim' : ''}
        </div>
      </div>
      {rightSlot ?? (
        <span className={styles.pill} style={{ color: status.color, backgroundColor: status.bg }}>
          {status.text}
        </span>
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
  const [discovering, setDiscovering] = useState(true);
  const claimsWithSubclaims = useAppSelector((s) =>
    parentCollectionId ? selectClaimsWithSubclaims(s, parentCollectionId) : undefined,
  );

  const [mounted, setMounted] = useState(false);
  const [view, setView] = useState<'list' | 'detail'>('list');
  const [minimized, setMinimized] = useState(false);
  const [loadingClaims, setLoadingClaims] = useState(false);
  const [claims, setClaims] = useState<any[]>([]);
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
        const parent = res.data.base?.[0];
        if (parent) {
          if (res.data.base.length > 1) {
            console.warn(
              '[SubclaimModal] collection has multiple base collections; using first',
              subclaimCollectionId,
              res.data.base,
            );
          }
          setParentCollectionId(parent);
          onParentResolved?.(parent);
          setBlockReason((prev) => (prev === 'not-configured' || prev === 'worker-unreachable' ? null : prev));
        } else {
          setParentCollectionId(null);
          setBlockReason((prev) => (prev === 'no-submit-authz' ? prev : 'not-configured'));
        }
      } else if (res.reason === 'not-found' || res.reason === 'disabled') {
        setParentCollectionId(null);
        setBlockReason((prev) => (prev === 'no-submit-authz' ? prev : 'not-configured'));
      } else {
        setParentCollectionId(null);
        setBlockReason((prev) => (prev === 'no-submit-authz' ? prev : 'worker-unreachable'));
      }
      setDiscovering(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [subclaimCollectionId, discoveryNonce, onParentResolved]);

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

  const title = view === 'list' ? 'Select a base claim' : 'Base claim';
  const showMinimizeIcon = hasSelection && !isFatal;
  const headerIcon = showMinimizeIcon ? <ShrinkIcon /> : <Cross color='currentColor' />;
  const headerLabel = showMinimizeIcon ? 'Minimize' : 'Close';

  return ReactDOM.createPortal(
    <div className={styles.overlay} role='dialog' aria-modal='true' onClick={handleBackdropClick}>
      <div className={styles.modal} ref={modalRef}>
        <div className={styles.header}>
          <h2 className={styles.title}>{title}</h2>
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

        <div className={`${styles.body} ${view === 'list' ? styles.listBody : styles.detailBody}`}>
          {view === 'list' ? (
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
                  actions={[{ label: 'Close', icon: <Cross color='currentColor' />, onClick: handleClose }]}
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
                      <div className={styles.list}>
                        {available.map((claim) => (
                          <ClaimRow
                            key={claim.claimId}
                            claim={claim}
                            selected={claim.claimId === selectedParentClaimId}
                            disabled={false}
                            onClick={() => handleSelectClaim(claim.claimId)}
                          />
                        ))}
                      </div>
                    )}
                    {disabled.length > 0 && (
                      <>
                        <div className={styles.sectionLabel}>Already has subclaims</div>
                        <div className={styles.list}>
                          {disabled.map((claim) => (
                            <ClaimRow
                              key={claim.claimId}
                              claim={claim}
                              selected={claim.claimId === selectedParentClaimId}
                              disabled={false}
                              onClick={() => handleSelectClaim(claim.claimId)}
                            />
                          ))}
                        </div>
                      </>
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
