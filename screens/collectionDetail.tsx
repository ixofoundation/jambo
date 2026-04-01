import { useState, useRef, useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';
import { GrantAuthorization } from '@ixo/impactxclient-sdk/types/codegen/cosmos/authz/v1beta1/authz';
import { createQueryClient, createRegistry } from '@ixo/impactxclient-sdk';
import { createMatrixBidBotClient } from '@ixo/matrixclient-sdk';

import { fetchCollectionByCollectionId, fetchClaimsByCollectionId, fetchAllClaimsByCollectionId } from '@utils/claims';
import Header from '@components/Header/Header';
import GradientBand from '@components/GradientBand/GradientBand';
import { GRADIENT_COLORS } from '@constants/gradientColors';
import { useAuth } from '@hooks/useAuth';
import { useBackgroundSetup } from '@hooks/useBackgroundSetup';
import { useProtocolCollections } from '@hooks/useProtocolCollections';
import { CHAIN_RPC_URL } from '@constants/common';
import { TRANSACTION_TYPES } from '@constants/transaction';
import { fetchProtocolEntity } from '@utils/entity';
import { secret } from '@utils/secrets';
import { getMatrixOpenIdToken } from '@utils/matrix';
import { useAppSelector } from '@store/hooks';
import { toast } from 'react-toastify';

interface CollectionDetailProps {
  entityDid: string;
  collectionId: string;
}

export default function CollectionDetail({ entityDid, collectionId }: CollectionDetailProps) {
  const router = useRouter();
  const authContext = useAuth();
  const { awaitCompletion } = useBackgroundSetup();
  const address = authContext.address!;
  const did = authContext.did!;

  const draft = useAppSelector((state) => state.claimDrafts.byCollectionId[collectionId]);

  const [auths, setAuths] = useState<string[]>([]);
  const [authzLoading, setAuthzLoading] = useState(true);
  const [bids, setBids] = useState<any[]>([]);
  const [bidsLoading, setBidsLoading] = useState(true);
  const [claims, setClaims] = useState<any[]>([]);
  const [claimsLoading, setClaimsLoading] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [hasBcoForm, setHasBcoForm] = useState(false);
  const [hasBevForm, setHasBevForm] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [allClaims, setAllClaims] = useState<any[]>([]);
  const [allClaimsLoading, setAllClaimsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'contributor' | 'evaluator' | 'controller'>('contributor');
  const [allBids, setAllBids] = useState<any[]>([]);
  const [allBidsLoading, setAllBidsLoading] = useState(false);
  const [viewingBid, setViewingBid] = useState<any | null>(null);

  const claimCollectionIdRef = useRef<string>(collectionId);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const authsRef = useRef<string[]>([]);
  const bidBotClientRef = useRef<ReturnType<typeof createMatrixBidBotClient>>();

  const { collections: protocolCollections } = useProtocolCollections(entityDid);
  const collection = protocolCollections.find((c) => c.collectionId === collectionId);

  const isExpired =
    !!collection?.endDate &&
    new Date(collection.endDate).getFullYear() > 1970 &&
    new Date(collection.endDate) < new Date();
  const hasStarted =
    !collection?.startDate ||
    new Date(collection.startDate).getFullYear() <= 1970 ||
    new Date(collection.startDate) <= new Date();
  const isCollectionOpen = hasStarted && !isExpired;

  function addAuth(auth: string) {
    if (authsRef.current.includes(auth)) return;
    authsRef.current.push(auth);
    setAuths((prev) => [...prev, auth]);
  }
  function removeAuth(auth: string) {
    if (!authsRef.current.includes(auth)) return;
    authsRef.current = authsRef.current.filter((a) => a !== auth);
    setAuths((prev) => prev.filter((a) => a !== auth));
  }

  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    if (address && claimCollectionIdRef.current) {
      checkAuthz();
      fetchBids();
      fetchMyClaims();
      fetchAllClaims();
    }
    return () => {
      cancelledRef.current = true;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [address, collectionId]);

  async function checkAuthz() {
    try {
      const col = await fetchCollectionByCollectionId(claimCollectionIdRef.current);
      if (cancelledRef.current) return;
      if (col.admin === address) addAuth('admin');
      else removeAuth('admin');
      const queryClient = await createQueryClient(CHAIN_RPC_URL);
      const [granteeGrants, entity, protocolEntity] = await Promise.all([
        queryClient.cosmos.authz.v1beta1.granteeGrants({ grantee: address }),
        fetchProtocolEntity(col.entity),
        fetchProtocolEntity(col.protocol),
      ]);
      if (cancelledRef.current) return;
      if (entity?.owner === address) addAuth('owner');
      else removeAuth('owner');
      const linkedResources = protocolEntity?.linkedResource ?? [];
      setHasBcoForm(linkedResources.some((r: any) => r?.id?.includes('#bco')));
      setHasBevForm(linkedResources.some((r: any) => r?.id?.includes('#bev')));
      const grants = granteeGrants.grants as GrantAuthorization[];
      const registry = createRegistry();
      const targetCollectionId = claimCollectionIdRef.current;

      function grantMatchesCollection(g: GrantAuthorization, typeUrl: string): boolean {
        if (g.authorization?.typeUrl !== typeUrl || g.granter !== col.admin) return false;
        try {
          const decoded = registry.decode(g.authorization);
          const constraints = decoded.constraints ?? [];
          if (constraints.length === 0) return true;
          return constraints.some((c: any) => c.collectionId === targetCollectionId);
        } catch {
          return false;
        }
      }

      const hasEval = grants?.find((g) => grantMatchesCollection(g, TRANSACTION_TYPES.EvaluateClaimAuthorization));
      if (hasEval) addAuth(TRANSACTION_TYPES.EvaluateClaimAuthorization);
      else removeAuth(TRANSACTION_TYPES.EvaluateClaimAuthorization);
      const hasSubmit = grants?.find((g) => grantMatchesCollection(g, TRANSACTION_TYPES.SubmitClaimAuthorization));
      if (hasSubmit) addAuth(TRANSACTION_TYPES.SubmitClaimAuthorization);
      else removeAuth(TRANSACTION_TYPES.SubmitClaimAuthorization);
    } catch {
      // silent fail
    } finally {
      if (!cancelledRef.current) {
        setAuthzLoading(false);
        timeoutRef.current = setTimeout(checkAuthz, 5000);
      }
    }
  }

  function getBidBotClient() {
    const token = secret.accessToken as string;
    if (bidBotClientRef.current?.bid && token) return bidBotClientRef.current;
    bidBotClientRef.current = undefined;
    if (!token) return null;
    bidBotClientRef.current = createMatrixBidBotClient({
      homeServerUrl: process.env.NEXT_PUBLIC_MATRIX_HOMESERVER_URL!,
      botUrl: process.env.NEXT_PUBLIC_MATRIX_BID_BOT_URL!,
      accessToken: token,
    });
    return bidBotClientRef.current;
  }

  async function fetchBids() {
    try {
      setBidsLoading(true);
      await awaitCompletion();
      if (cancelledRef.current) return;
      const client = getBidBotClient();
      if (!client) {
        console.warn('[CollectionDetail] No Matrix access token available; skipping bid fetch');
        return;
      }
      const openIdToken = await getMatrixOpenIdToken();
      const response = await client.bid.v1beta1.queryBidsByDid(collectionId, did, openIdToken, did);
      setBids(response.data ?? []);
    } catch (err) {
      console.warn('[CollectionDetail] fetchBids error:', err);
    } finally {
      setBidsLoading(false);
    }
  }

  async function fetchAllBids() {
    try {
      setAllBidsLoading(true);
      await awaitCompletion();
      if (cancelledRef.current) return;
      const client = getBidBotClient();
      if (!client) return;
      const openIdToken = await getMatrixOpenIdToken();
      const response = await client.bid.v1beta1.queryBids(collectionId, openIdToken, did);
      setAllBids(response.data ?? []);
    } catch (err) {
      console.warn('[CollectionDetail] fetchAllBids error:', err);
    } finally {
      setAllBidsLoading(false);
    }
  }

  async function fetchMyClaims() {
    try {
      setClaimsLoading(true);
      const result = await fetchClaimsByCollectionId(collectionId, address);
      setClaims(result ?? []);
    } catch {
      // silent fail
    } finally {
      setClaimsLoading(false);
    }
  }

  async function fetchAllClaims() {
    try {
      setAllClaimsLoading(true);
      const result = await fetchAllClaimsByCollectionId(collectionId);
      setAllClaims(result ?? []);
    } catch {
      // silent fail
    } finally {
      setAllClaimsLoading(false);
    }
  }

  // Navigation helpers — open forms on separate page
  function navigateToForm(formType: string, claimId?: string) {
    const base = `/entities/${entityDid}/claimCollections/${collectionId}/${formType}`;
    router.push(claimId ? `${base}?claimId=${claimId}` : base);
  }

  const isServiceAgent = auths.includes(TRANSACTION_TYPES.SubmitClaimAuthorization);
  const isEvalAgent = auths.includes(TRANSACTION_TYPES.EvaluateClaimAuthorization);
  const isController = auths.includes('admin') || auths.includes('owner');
  const saBids = bids.filter((b: any) => b.role === 'SA');
  const eaBids = bids.filter((b: any) => b.role === 'EA');
  const hasPendingSaBid = !isServiceAgent && saBids.length > 0;
  const hasPendingEaBid = !isEvalAgent && eaBids.length > 0;
  const dataLoading = authzLoading || bidsLoading || claimsLoading;
  const showApplySaButton = !dataLoading && !isServiceAgent && !hasPendingSaBid && isCollectionOpen && hasBcoForm;
  const showApplyEaButton = !dataLoading && !isEvalAgent && !hasPendingEaBid && isCollectionOpen && hasBevForm;
  const showNewClaimButton = !dataLoading && isServiceAgent && isCollectionOpen;
  const hasDraft = !!draft && draft.surveyMode === 'claim';
  const displayedClaims = useMemo(() => {
    const list = activeTab === 'evaluator' ? allClaims : claims;
    return [...list].sort((a, b) => {
      if (activeTab === 'evaluator' && isEvalAgent) {
        const aStatus = a.evaluationByClaimId?.status ?? 0;
        const bStatus = b.evaluationByClaimId?.status ?? 0;
        if (aStatus === 0 && bStatus !== 0) return -1;
        if (aStatus !== 0 && bStatus === 0) return 1;
      }
      return new Date(b.submissionDate).getTime() - new Date(a.submissionDate).getTime();
    });
  }, [activeTab, allClaims, claims, isEvalAgent]);
  const isClaimsListLoading = activeTab === 'evaluator' ? allClaimsLoading : claimsLoading;

  // Default tab based on user roles
  useEffect(() => {
    if (!authzLoading) {
      if (isEvalAgent && !isServiceAgent) {
        setActiveTab('evaluator');
      } else if (isController && !isServiceAgent && !isEvalAgent) {
        setActiveTab('controller');
      }
    }
  }, [authzLoading, isEvalAgent, isServiceAgent, isController]);

  // Lazy fetch all bids when controller tab is selected
  useEffect(() => {
    if (activeTab === 'controller' && isController && allBids.length === 0 && !allBidsLoading) {
      fetchAllBids();
    }
  }, [activeTab, isController]);

  const collectionName = collection?.formName || `Collection ${collectionId}`;
  const submitted = collection?.count ?? 0;
  const approved = collection?.approved ?? 0;
  const quota = collection?.quota ?? 0;

  function statusLabel(claim: any): { text: string; color: string; bg: string } {
    const s = claim.evaluationByClaimId?.status;
    if (s === 1) return { text: 'Approved', color: '#2F6A59', bg: '#dcfce7' };
    if (s === 2) return { text: 'Rejected', color: '#991b1b', bg: '#fee2e2' };
    if (s === 3) return { text: 'Disputed', color: '#E49526', bg: '#fef3c7' };
    return { text: 'Pending', color: '#545859', bg: '#F3F6FA' };
  }

  return (
    <div style={{ overflow: 'hidden', position: 'relative', minHeight: '100vh' }}>
      <GradientBand {...GRADIENT_COLORS.collectionDetail} />
      <Header onGradient />
      <main
        style={{
          position: 'relative',
          zIndex: 1,
          maxWidth: 'var(--max-width)',
          margin: '0 auto',
          padding: '0 16px 16px',
          paddingTop: 'calc(var(--header-height) + 8px)',
        }}
      >
        {/* Page title section */}
        <div
          style={{
            minHeight: '150px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
          }}
        >
          <button
            onClick={() => router.push(`/entities/${entityDid}`)}
            aria-label='Go back to claim collections'
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              margin: '0 0 6px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              color: 'rgba(255,255,255,0.7)',
              fontSize: '13px',
              fontWeight: 400,
              lineHeight: 1.2,
            }}
          >
            <svg
              width='14'
              height='14'
              viewBox='0 0 24 24'
              fill='none'
              stroke='currentColor'
              strokeWidth='2.5'
              strokeLinecap='round'
              strokeLinejoin='round'
            >
              <polyline points='15 18 9 12 15 6' />
            </svg>
            Claim Collections
          </button>
          <h1
            style={{
              margin: 0,
              fontSize: '20px',
              fontWeight: 600,
              color: '#fff',
              letterSpacing: '-0.3px',
              lineHeight: 1.2,
            }}
          >
            {collectionName}
          </h1>
        </div>

        {/* Loading state */}
        {dataLoading && (
          <div
            style={{
              backgroundColor: 'var(--bg-secondary)',
              borderRadius: '16px',
              border: '1px solid var(--border-color)',
              padding: '32px 16px',
              textAlign: 'center',
            }}
          >
            <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)' }}>Loading...</p>
          </div>
        )}

        {/* Role chips */}
        {!dataLoading && (
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <button
              onClick={() => setActiveTab('contributor')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '8px 14px',
                borderRadius: '20px',
                border: 'none',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                backgroundColor: activeTab === 'contributor' ? 'var(--accent-color)' : 'var(--card-bg-color)',
                color: activeTab === 'contributor' ? '#fff' : 'var(--text-secondary)',
              }}
            >
              <svg width='20' height='20' fill='none' viewBox='0 0 24 24'>
                <path
                  d='M12 3.75C9.1084 3.75 6.75 6.1084 6.75 9C6.75 10.8076 7.67285 12.4131 9.07031 13.3594C6.39551 14.5078 4.5 17.1621 4.5 20.25H6C6 16.9277 8.67773 14.25 12 14.25C15.3223 14.25 18 16.9277 18 20.25H19.5C19.5 17.1621 17.6045 14.5078 14.9297 13.3594C16.3271 12.4131 17.25 10.8076 17.25 9C17.25 6.1084 14.8916 3.75 12 3.75ZM12 5.25C14.0801 5.25 15.75 6.91992 15.75 9C15.75 11.0801 14.0801 12.75 12 12.75C9.91992 12.75 8.25 11.0801 8.25 9C8.25 6.91992 9.91992 5.25 12 5.25Z'
                  fill='currentColor'
                ></path>
              </svg>
              Contributor
            </button>
            {(hasBevForm || isEvalAgent) && (
              <button
                onClick={() => setActiveTab('evaluator')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '8px 14px',
                  borderRadius: '20px',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  backgroundColor: activeTab === 'evaluator' ? 'var(--accent-color)' : 'var(--card-bg-color)',
                  color: activeTab === 'evaluator' ? '#fff' : 'var(--text-secondary)',
                }}
              >
                <svg width='20' height='20' fill='none' viewBox='0 0 24 24'>
                  <path
                    d='M9 1.5C6.1084 1.5 3.75 3.8584 3.75 6.75C3.75 8.55762 4.67285 10.1631 6.07031 11.1094C3.39551 12.2578 1.5 14.9121 1.5 18H3C3 14.6777 5.67773 12 9 12C10.0312 12 10.9922 12.2695 11.8359 12.7266C11.0039 13.7578 10.5 15.0762 10.5 16.5C10.5 19.8047 13.1953 22.5 16.5 22.5C19.8047 22.5 22.5 19.8047 22.5 16.5C22.5 13.1953 19.8047 10.5 16.5 10.5C15.1904 10.5 13.9717 10.9307 12.9844 11.6484C12.6533 11.4404 12.293 11.2646 11.9297 11.1094C13.3271 10.1631 14.25 8.55762 14.25 6.75C14.25 3.8584 11.8916 1.5 9 1.5ZM9 3C11.0801 3 12.75 4.66992 12.75 6.75C12.75 8.83008 11.0801 10.5 9 10.5C6.91992 10.5 5.25 8.83008 5.25 6.75C5.25 4.66992 6.91992 3 9 3ZM16.5 12C18.9932 12 21 14.0068 21 16.5C21 18.9932 18.9932 21 16.5 21C14.0068 21 12 18.9932 12 16.5C12 14.0068 14.0068 12 16.5 12ZM18.9609 14.4609L16.5 16.9219L14.7891 15.2109L13.7109 16.2891L15.9609 18.5391L16.5 19.0547L17.0391 18.5391L20.0391 15.5391L18.9609 14.4609Z'
                    fill='currentColor'
                  ></path>
                </svg>
                Evaluator
              </button>
            )}
            {isController && (
              <button
                onClick={() => setActiveTab('controller')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '8px 14px',
                  borderRadius: '20px',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  backgroundColor: activeTab === 'controller' ? 'var(--accent-color)' : 'var(--card-bg-color)',
                  color: activeTab === 'controller' ? '#fff' : 'var(--text-secondary)',
                }}
              >
                <svg width='20' height='20' fill='none' viewBox='0 0 24 24'>
                  <path
                    d='M12 3.75C9.075 3.75 6.75 6.075 6.75 9C6.75 10.8281 7.65747 12.4211 9.05273 13.3594C6.38251 14.5105 4.5 17.1702 4.5 20.25H6C6 16.95 8.7 14.25 12 14.25C12.2559 14.25 12.5045 14.2258 12.75 14.1914V17.625C12.75 21.525 17.8497 23.7756 18.0747 23.8506L18.375 24L18.6753 23.8506C18.9003 23.7756 24 21.525 24 17.625V13.5H23.3247C21.8997 13.5 21.0744 12.9756 20.3994 12.6006C19.7244 12.3006 19.125 12 18.375 12C17.625 12 17.025 12.3006 16.5 12.6006C16.1203 12.8115 15.6648 13.0667 15.0894 13.2524C16.4011 12.3031 17.25 10.7631 17.25 9C17.25 6.075 14.925 3.75 12 3.75ZM12 5.25C14.1 5.25 15.75 6.9 15.75 9C15.75 11.1 14.1 12.75 12 12.75C9.9 12.75 8.25 11.1 8.25 9C8.25 6.9 9.9 5.25 12 5.25ZM18.375 13.5C18.75 13.5 19.0494 13.6497 19.6494 13.9497L19.875 14.0244C20.475 14.3244 21.3 14.7753 22.5 14.9253V17.5503C22.5 20.0253 19.275 21.8244 18.375 22.2744C17.475 21.8244 14.25 20.0253 14.25 17.5503V14.9253C15.525 14.7753 16.3497 14.3244 16.9497 14.0244L17.1753 13.9497H17.25H17.3247C17.7747 13.5747 18 13.5 18.375 13.5Z'
                    fill='currentColor'
                  ></path>
                </svg>
                Controller
              </button>
            )}
          </div>
        )}

        {/* ── Contributor tab ── */}
        {!dataLoading && activeTab === 'contributor' && (
          <>
            {hasPendingSaBid && (
              <div
                style={{
                  padding: '20px',
                  borderRadius: '16px',
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  textAlign: 'center',
                  marginBottom: '8px',
                }}
              >
                <p style={{ margin: '0 0 4px', fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>
                  Service agent application pending
                </p>
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>
                  Your service agent application is being reviewed.
                </p>
              </div>
            )}

            {!isServiceAgent && !hasPendingSaBid && showApplySaButton && (
              <div
                style={{
                  padding: '20px',
                  borderRadius: '16px',
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  textAlign: 'center',
                  marginBottom: '8px',
                }}
              >
                <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)' }}>
                  Apply as a service agent to start submitting claims.
                </p>
              </div>
            )}

            {isServiceAgent && (
              <>
                {claimsLoading ? (
                  <div
                    style={{
                      backgroundColor: 'var(--bg-secondary)',
                      borderRadius: '16px',
                      border: '1px solid var(--border-color)',
                      padding: '32px 16px',
                      textAlign: 'center',
                    }}
                  >
                    <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)' }}>Loading claims...</p>
                  </div>
                ) : claims.length === 0 ? (
                  <div
                    style={{
                      backgroundColor: 'var(--bg-secondary)',
                      borderRadius: '16px',
                      border: '1px solid var(--border-color)',
                      padding: '32px 16px',
                      textAlign: 'center',
                    }}
                  >
                    <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)' }}>
                      No claims yet. Submit your first claim to get started.
                    </p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {claims.map((claim: any) => {
                      const status = statusLabel(claim);
                      return (
                        <div
                          key={claim.claimId}
                          onClick={() => navigateToForm('view', claim.claimId)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '14px 16px',
                            border: '1px solid var(--border-color)',
                            borderRadius: '16px',
                            backgroundColor: 'var(--bg-secondary)',
                            cursor: 'pointer',
                          }}
                        >
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <p style={{ margin: 0, fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>
                              {claim.claimId?.slice(0, 25)}...
                            </p>
                            <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                              {new Date(claim.submissionDate).toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric',
                              })}
                            </p>
                          </div>
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 600,
                              padding: '2px 8px',
                              borderRadius: 9999,
                              color: status.color,
                              backgroundColor: status.bg,
                              whiteSpace: 'nowrap',
                              flexShrink: 0,
                            }}
                          >
                            {status.text}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            {!isCollectionOpen && (
              <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'center' }}>
                <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)', textAlign: 'center' }}>
                  {isExpired ? 'Collection has ended' : 'Collection has not started yet'}
                </p>
              </div>
            )}

            {(showNewClaimButton || showApplySaButton) && (
              <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {showNewClaimButton && (
                  <button
                    onClick={() => navigateToForm('vct')}
                    style={{
                      width: '100%',
                      padding: '14px',
                      borderRadius: '12px',
                      border: 'none',
                      backgroundColor: 'var(--accent-color)',
                      color: '#fff',
                      fontSize: '15px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      letterSpacing: '-0.2px',
                    }}
                  >
                    {hasDraft ? 'Continue Claim' : 'New Claim'}
                  </button>
                )}
                {showApplySaButton && (
                  <button
                    onClick={() => navigateToForm('bco')}
                    style={{
                      width: '100%',
                      padding: '14px',
                      borderRadius: '12px',
                      border: 'none',
                      backgroundColor: 'var(--accent-color)',
                      color: '#fff',
                      fontSize: '15px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      letterSpacing: '-0.2px',
                    }}
                  >
                    Apply as Contributor
                  </button>
                )}
              </div>
            )}
          </>
        )}

        {/* ── Evaluator tab ── */}
        {!dataLoading && activeTab === 'evaluator' && (
          <>
            {hasPendingEaBid && (
              <div
                style={{
                  padding: '20px',
                  borderRadius: '16px',
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  textAlign: 'center',
                  marginBottom: '8px',
                }}
              >
                <p style={{ margin: '0 0 4px', fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>
                  Evaluation agent application pending
                </p>
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>
                  Your evaluation agent application is being reviewed.
                </p>
              </div>
            )}

            {!isEvalAgent && !hasPendingEaBid && showApplyEaButton && (
              <div
                style={{
                  padding: '20px',
                  borderRadius: '16px',
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  textAlign: 'center',
                  marginBottom: '8px',
                }}
              >
                <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)' }}>
                  Apply as an evaluation agent to start reviewing claims.
                </p>
              </div>
            )}

            {isEvalAgent && (
              <>
                {allClaimsLoading ? (
                  <div
                    style={{
                      backgroundColor: 'var(--bg-secondary)',
                      borderRadius: '16px',
                      border: '1px solid var(--border-color)',
                      padding: '32px 16px',
                      textAlign: 'center',
                    }}
                  >
                    <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)' }}>Loading claims...</p>
                  </div>
                ) : displayedClaims.length === 0 ? (
                  <div
                    style={{
                      backgroundColor: 'var(--bg-secondary)',
                      borderRadius: '16px',
                      border: '1px solid var(--border-color)',
                      padding: '32px 16px',
                      textAlign: 'center',
                    }}
                  >
                    <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)' }}>
                      No claims submitted yet.
                    </p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {displayedClaims.map((claim: any) => {
                      const status = statusLabel(claim);
                      return (
                        <div
                          key={claim.claimId}
                          onClick={() => navigateToForm('view', claim.claimId)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '14px 16px',
                            border: '1px solid var(--border-color)',
                            borderRadius: '16px',
                            backgroundColor: 'var(--bg-secondary)',
                            cursor: 'pointer',
                          }}
                        >
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <p style={{ margin: 0, fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>
                              {claim.claimId?.slice(0, 25)}...
                            </p>
                            <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                              {new Date(claim.submissionDate).toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric',
                              })}
                              {claim.agentAddress && (
                                <span style={{ marginLeft: '6px', opacity: 0.7 }}>
                                  {claim.agentAddress.slice(0, 10)}...{claim.agentAddress.slice(-4)}
                                </span>
                              )}
                            </p>
                          </div>
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 600,
                              padding: '2px 8px',
                              borderRadius: 9999,
                              color: status.color,
                              backgroundColor: status.bg,
                              whiteSpace: 'nowrap',
                              flexShrink: 0,
                            }}
                          >
                            {status.text}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            {showApplyEaButton && (
              <div style={{ marginTop: '16px' }}>
                <button
                  onClick={() => navigateToForm('bev')}
                  style={{
                    width: '100%',
                    padding: '14px',
                    borderRadius: '12px',
                    border: 'none',
                    backgroundColor: 'var(--accent-color)',
                    color: '#fff',
                    fontSize: '15px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    letterSpacing: '-0.2px',
                  }}
                >
                  Apply as Evaluation Agent
                </button>
              </div>
            )}
          </>
        )}

        {/* ── Controller tab ── */}
        {!dataLoading && activeTab === 'controller' && isController && (
          <>
            {allBidsLoading ? (
              <div
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  borderRadius: '16px',
                  border: '1px solid var(--border-color)',
                  padding: '32px 16px',
                  textAlign: 'center',
                }}
              >
                <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)' }}>Loading applications...</p>
              </div>
            ) : allBids.length === 0 ? (
              <div
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  borderRadius: '16px',
                  border: '1px solid var(--border-color)',
                  padding: '32px 16px',
                  textAlign: 'center',
                }}
              >
                <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)' }}>
                  No pending applications.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {allBids.map((bid: any) => (
                  <div
                    key={bid.id}
                    style={{
                      padding: '14px 16px',
                      border: '1px solid var(--border-color)',
                      borderRadius: '16px',
                      backgroundColor: 'var(--bg-secondary)',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: '8px',
                      }}
                    >
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <p style={{ margin: 0, fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>
                          {bid.did?.slice(0, 25)}...
                        </p>
                        <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                          {new Date(bid.created).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </p>
                      </div>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 600,
                          padding: '2px 8px',
                          borderRadius: 9999,
                          whiteSpace: 'nowrap',
                          flexShrink: 0,
                          color: bid.role === 'EA' ? '#1e40af' : 'var(--green-secondary)',
                          backgroundColor: bid.role === 'EA' ? '#dbeafe' : '#dcfce7',
                        }}
                      >
                        {bid.role === 'EA' ? 'Evaluator' : 'Service Agent'}
                      </span>
                    </div>

                    {/* Bid data preview */}
                    {viewingBid?.id === bid.id ? (
                      <div style={{ marginBottom: '8px' }}>
                        <div
                          style={{
                            padding: '10px 12px',
                            borderRadius: '10px',
                            backgroundColor: 'var(--card-bg-color)',
                            fontSize: '12px',
                            color: 'var(--text-secondary)',
                            maxHeight: '200px',
                            overflowY: 'auto',
                          }}
                        >
                          {(() => {
                            try {
                              const data = JSON.parse(bid.data);
                              return Object.entries(data).map(([key, value]) => (
                                <div key={key} style={{ marginBottom: '4px' }}>
                                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{key}:</span>{' '}
                                  {String(value)}
                                </div>
                              ));
                            } catch {
                              return <span>{bid.data}</span>;
                            }
                          })()}
                        </div>
                        <button
                          onClick={() => setViewingBid(null)}
                          style={{
                            marginTop: '6px',
                            background: 'none',
                            border: 'none',
                            fontSize: '12px',
                            color: 'var(--accent-color)',
                            cursor: 'pointer',
                            padding: 0,
                          }}
                        >
                          Hide details
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setViewingBid(bid)}
                        style={{
                          marginBottom: '8px',
                          background: 'none',
                          border: 'none',
                          fontSize: '12px',
                          color: 'var(--accent-color)',
                          cursor: 'pointer',
                          padding: 0,
                        }}
                      >
                        View details
                      </button>
                    )}

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => toast.info('Approve functionality coming soon')}
                        style={{
                          flex: 1,
                          padding: '8px',
                          borderRadius: '10px',
                          border: 'none',
                          backgroundColor: 'var(--green-primary)',
                          color: '#fff',
                          fontSize: '13px',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => toast.info('Reject functionality coming soon')}
                        style={{
                          flex: 1,
                          padding: '8px',
                          borderRadius: '10px',
                          border: '1px solid var(--error-color)',
                          backgroundColor: 'transparent',
                          color: 'var(--error-color)',
                          fontSize: '13px',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {formError && (
          <p style={{ margin: '16px 0 0', fontSize: '13px', color: 'var(--error-color)', textAlign: 'center' }}>
            {formError}
          </p>
        )}
      </main>
    </div>
  );
}
