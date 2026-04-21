import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import cls from 'classnames';
import { createQueryClient, createRegistry } from '@ixo/impactxclient-sdk';
import { GrantAuthorization } from '@ixo/impactxclient-sdk/types/codegen/cosmos/authz/v1beta1/authz';
import { createMatrixClaimBotClient } from '@ixo/matrixclient-sdk';
import { Model } from 'survey-core';
import { Survey } from 'survey-react-ui';

import ChevronDown from '@icons/chevron_down.svg';
import { fetchAllClaimsByCollectionId, fetchCollectionByCollectionId } from '@utils/claims';
import { fetchProtocolEntity } from '@utils/entity';
import { getAdditionalInfo, getCachedTemplate, getServiceEndpoint } from '@utils/url';
import { setVctTemplate } from '@store/slices/protocolsSlice';
import { useAppDispatch, useAppSelector } from '@store/hooks';
import { fetchClaimsWithSubclaims } from '@store/thunks/subclaimsThunks';
import { selectClaimsWithSubclaims } from '@store/selectors/subclaims';
import { getMatrixOpenIdToken } from '@utils/matrix';
import { fetchMatrixProfileForAddress, matrixUserIdForAddress } from '@utils/matrixProfile';
import { secret } from '@utils/secrets';
import { CHAIN_RPC_URL } from '@constants/common';
import { TRANSACTION_TYPES } from '@constants/transaction';
import { themeJson } from '@constants/surveyTheme';
import { configureFileQuestions, createAttachDownloadHandler } from '@constants/surveyDefaultConfig';
import { createAttachPdfPreviewHandler } from '@constants/surveyPdfPreview';

import styles from './SubclaimSheet.module.scss';

type BlockReason = null | 'parent-not-tracked' | 'sub-not-allowed' | 'no-eval-authz' | 'no-worker';

interface SubclaimSheetProps {
  open: boolean;
  parentCollectionId: string | null;
  subCollectionId: string;
  address: string;
  did: string;
  selectedParentClaimId: string | null;
  onSelect: (claimId: string | null) => void;
  onBlockedChange: (reason: BlockReason) => void;
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
  asHeader,
}: {
  claim: any;
  selected: boolean;
  disabled: boolean;
  onClick?: () => void;
  rightSlot?: ReactNode;
  asHeader?: boolean;
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
  if (asHeader) classes.push(styles.rowHeader);

  const interactive = !asHeader && !disabled && !!onClick;

  return (
    <div
      className={classes.join(' ')}
      onClick={interactive ? onClick : undefined}
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

export default function SubclaimSheet({
  open,
  parentCollectionId,
  subCollectionId,
  address,
  did,
  selectedParentClaimId,
  onSelect,
  onBlockedChange,
}: SubclaimSheetProps) {
  const dispatch = useAppDispatch();
  const allowedForParent = useAppSelector((s) =>
    parentCollectionId ? s.subclaims.allowedSubcollectionsByParent[parentCollectionId] : undefined,
  );
  const parentTracked = useAppSelector((s) => (parentCollectionId ? !!s.collections.byId[parentCollectionId] : false));
  const claimsWithSubclaims = useAppSelector((s) =>
    parentCollectionId ? selectClaimsWithSubclaims(s, parentCollectionId) : undefined,
  );

  const [mounted, setMounted] = useState(false);
  const [view, setView] = useState<'list' | 'form'>('list');
  const [expanded, setExpanded] = useState(true);
  const [loadingClaims, setLoadingClaims] = useState(false);
  const [claims, setClaims] = useState<any[]>([]);
  const [blockReason, setBlockReason] = useState<BlockReason>(null);
  const [authzChecked, setAuthzChecked] = useState(false);
  const [hasEvalAuthz, setHasEvalAuthz] = useState(false);

  const [parentTemplate, setParentTemplate] = useState<string | null>(null);
  const claimDataCacheRef = useRef<Record<string, Record<string, any>>>({});
  const [viewedClaimData, setViewedClaimData] = useState<Record<string, any> | null>(null);
  const [viewedClaimLoading, setViewedClaimLoading] = useState(false);
  const claimBotClientRef = useRef<ReturnType<typeof createMatrixClaimBotClient>>();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!parentCollectionId) {
      setBlockReason('parent-not-tracked');
      return;
    }
    if (!parentTracked) {
      setBlockReason('parent-not-tracked');
      return;
    }
    if (allowedForParent && !allowedForParent.includes(subCollectionId)) {
      setBlockReason('sub-not-allowed');
      return;
    }
    if (authzChecked && !hasEvalAuthz) {
      setBlockReason('no-eval-authz');
      return;
    }
    setBlockReason(null);
  }, [parentCollectionId, parentTracked, allowedForParent, subCollectionId, authzChecked, hasEvalAuthz]);

  useEffect(() => {
    onBlockedChange(blockReason);
  }, [blockReason, onBlockedChange]);

  useEffect(() => {
    if (!parentCollectionId || !parentTracked) return;
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
        console.warn('[SubclaimSheet] authz check failed', err);
        setHasEvalAuthz(false);
        setAuthzChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [parentCollectionId, parentTracked, address]);

  useEffect(() => {
    if (!parentCollectionId || !parentTracked || !hasEvalAuthz) return;
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
        console.warn('[SubclaimSheet] fetch parent claims failed', err);
        if (!cancelled) setClaims([]);
      } finally {
        if (!cancelled) setLoadingClaims(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [parentCollectionId, parentTracked, hasEvalAuthz, dispatch]);

  useEffect(() => {
    if (!parentCollectionId || !hasEvalAuthz || parentTemplate) return;
    if (view !== 'form') return;
    let cancelled = false;
    (async () => {
      try {
        const parentCol = await fetchCollectionByCollectionId(parentCollectionId);
        const protocolDid = parentCol.protocol;
        const protocolEntity = await fetchProtocolEntity(protocolDid);
        const endpoint =
          protocolEntity?.linkedResource?.find((r: any) => r?.id?.includes('#vct')) ??
          protocolEntity?.linkedResource?.find((r: any) => r?.id?.includes('surveyTemplate'));
        if (!endpoint?.serviceEndpoint) return;
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
        console.warn('[SubclaimSheet] load parent template failed', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [parentCollectionId, hasEvalAuthz, view, parentTemplate, dispatch]);

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
      setViewedClaimData(cached);
      return;
    }
    setViewedClaimLoading(true);
    try {
      const client = getClaimBotClient();
      if (!client) {
        setViewedClaimData({});
        return;
      }
      const openIdToken = await getMatrixOpenIdToken();
      const response = await client.claim.v1beta1.queryClaim(parentCollectionId, claimId, openIdToken, did);
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
      console.warn('[SubclaimSheet] load claim data failed', err);
      setViewedClaimData({});
    } finally {
      setViewedClaimLoading(false);
    }
  }

  function handleSelectClaim(claimId: string) {
    onSelect(claimId);
    setViewedClaimData(null);
    loadParentClaimData(claimId);
    setView('form');
    setExpanded(true);
  }

  function handleBackToList() {
    setView('list');
    setExpanded(true);
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
      console.warn('[SubclaimSheet] build parent survey failed', err);
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

  if (!open || !mounted) return null;
  const portalRoot = typeof document !== 'undefined' ? document.getElementById('modal-root') : null;
  if (!portalRoot) return null;

  const isCollapsed = view === 'form' && !expanded;

  const headerActions = (
    <div className={styles.headerActions}>
      <button
        type='button'
        className={styles.iconBtn}
        onClick={() => setExpanded((prev) => !prev)}
        aria-label={expanded ? 'Collapse panel' : 'Expand panel'}
      >
        <ChevronDown className={cls(styles.chevronIcon, { [styles.chevronUp]: !expanded })} />
      </button>
    </div>
  );

  return ReactDOM.createPortal(
    <div className={cls(styles.container, { [styles.collapsed]: isCollapsed })} role='dialog' aria-modal='true'>
      {view === 'list' ? (
        <div className={styles.header}>
          <h2 className={styles.title}>Select a base claim</h2>
        </div>
      ) : (
        <div className={styles.headerRowWrap}>
          {(() => {
            const selectedClaim = claims.find((c) => c.claimId === selectedParentClaimId);
            if (selectedClaim) {
              return <ClaimRow claim={selectedClaim} selected disabled={false} asHeader rightSlot={headerActions} />;
            }
            return (
              <div className={cls(styles.row, styles.rowHeader)}>
                <div className={styles.rowMain}>
                  <div className={styles.rowClaimId}>{selectedParentClaimId ?? 'Base claim'}</div>
                </div>
                {headerActions}
              </div>
            );
          })()}
        </div>
      )}

      {view === 'list' ? (
        <div className={styles.content}>
          {blockReason === 'parent-not-tracked' && (
            <div className={styles.warningCard}>
              This subcollection is linked to a base collection that isn&apos;t tracked in this app. Submission is
              disabled.
            </div>
          )}
          {blockReason === 'sub-not-allowed' && (
            <div className={styles.warningCard}>
              This collection isn&apos;t registered as a subcollection of its linked parent. Submission is disabled.
            </div>
          )}
          {blockReason === 'no-eval-authz' && (
            <div className={styles.warningCard}>
              You don&apos;t have evaluation authorization on the base collection, so claim data cannot be loaded.
              Submission is disabled.
            </div>
          )}

          {!blockReason && (
            <>
              {loadingClaims ? (
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
                            disabled={true}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </>
              )}
            </>
          )}
        </div>
      ) : (
        <div className={styles.inlineFormWrapper}>
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
        </div>
      )}
    </div>,
    portalRoot,
  );
}
