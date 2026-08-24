import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/router';
import { GrantAuthorization } from '@ixo/impactxclient-sdk/types/codegen/cosmos/authz/v1beta1/authz';
import { createQueryClient, createRegistry } from '@ixo/impactxclient-sdk';
import { createMatrixBidBotClient } from '@ixo/matrixclient-sdk';

import { fetchCollectionByCollectionId, fetchClaimsByCollectionId } from '@utils/claims';
import Header from '@components/Header/Header';
import GradientBand from '@components/GradientBand/GradientBand';
import { useAuth } from '@hooks/useAuth';
import { useBackgroundSetup } from '@hooks/useBackgroundSetup';
import { useProtocolCollections } from '@hooks/useProtocolCollections';
import { CHAIN_RPC_URL } from '@constants/common';
import { TRANSACTION_TYPES } from '@constants/transaction';
import { fetchProtocolEntity } from '@utils/entity';
import { secret } from '@utils/secrets';
import { withMatrixOpenIdRetry } from '@utils/matrix';
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
  const [isApplying, setIsApplying] = useState(false);
  const [activeTab, setActiveTab] = useState<'contributor' | 'controller'>('contributor');
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
      fetchMyClaims();
      // Bids are only meaningful for users without SubmitClaimAuthorization — they
      // gate the "Apply as Service Agent" CTA. The dedicated effect below fires
      // fetchBids once authz resolves, and only when the user lacks submit authz.
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
      const response = await withMatrixOpenIdRetry((token) =>
        client.bid.v1beta1.queryBidsByDid(collectionId, did, token, did),
      );
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
      const response = await withMatrixOpenIdRetry((token) =>
        client.bid.v1beta1.queryBids(collectionId, token, did),
      );
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

  // Navigation helpers — open forms on separate page
  function navigateToForm(formType: string, claimId?: string) {
    const base = `/entities/${entityDid}/claimCollections/${collectionId}/${formType}`;
    router.push(claimId ? `${base}?claimId=${claimId}` : base);
  }

  const isServiceAgent = auths.includes(TRANSACTION_TYPES.SubmitClaimAuthorization);
  const isController = auths.includes('admin') || auths.includes('owner');
  const saBids = bids.filter((b: any) => b.role === 'SA');
  const hasPendingSaBid = !isServiceAgent && saBids.length > 0;
  const dataLoading = authzLoading || bidsLoading || claimsLoading;
  const showApplySaButton = !dataLoading && !isServiceAgent && !hasPendingSaBid && isCollectionOpen && hasBcoForm;
  const showNewClaimButton = !dataLoading && isServiceAgent && isCollectionOpen;
  const hasDraft = !!draft && draft.surveyMode === 'claim';
  const contributorBarVisible = activeTab === 'contributor' && (showNewClaimButton || showApplySaButton);
  const showBottomBar = contributorBarVisible;
  const stackedContributorButtons = activeTab === 'contributor' && showNewClaimButton && showApplySaButton;

  // Default tab based on user roles
  useEffect(() => {
    if (!authzLoading) {
      if (isController && !isServiceAgent) {
        setActiveTab('controller');
      }
    }
  }, [authzLoading, isServiceAgent, isController]);

  // Fetch the user's own bids only when they DON'T already hold SubmitClaimAuthorization.
  // Service agents have nothing to bid on (the "Apply as Service Agent" CTA is hidden),
  // so the bid round-trip is a waste of time. Drops `bidsLoading` immediately for them.
  useEffect(() => {
    if (authzLoading) return;
    if (isServiceAgent) {
      setBidsLoading(false);
      return;
    }
    fetchBids();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authzLoading, isServiceAgent]);

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
    if (s === 1) return { text: 'Approved', color: 'var(--green-secondary)', bg: 'var(--mint)' };
    if (s === 2) return { text: 'Rejected', color: 'var(--error-color)', bg: '#fde7e7' };
    if (s === 3) return { text: 'Disputed', color: 'var(--yellow-secondary)', bg: '#fdeed8' };
    return { text: 'Pending', color: 'var(--text-secondary)', bg: 'var(--surface-2)' };
  }

  return (
    <div style={{ overflow: 'hidden', position: 'relative', minHeight: '100vh' }}>
      <GradientBand variant='blue' />
      <Header onGradient title='Claim Collections' onBack={() => router.push(`/entities/${entityDid}`)} />
      <main
        style={{
          position: 'relative',
          zIndex: 1,
          maxWidth: 'var(--max-width)',
          margin: '0 auto',
          padding: '0 20px 16px',
          paddingTop: 'calc(var(--header-height) + 4px)',
          paddingBottom: showBottomBar
            ? stackedContributorButtons
              ? 'calc(196px + env(safe-area-inset-bottom, 0px))'
              : 'calc(144px + env(safe-area-inset-bottom, 0px))'
            : 'var(--dock-clearance)',
        }}
      >
        <h1 className='title-lg' style={{ margin: '4px 0 16px', fontSize: 24, lineHeight: 1.2 }}>
          {collectionName}
        </h1>

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

        {/* Role chips — only shown when the user has access to multiple tabs */}
        {!dataLoading && isController && (
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
                  <div
                    style={{
                      backgroundColor: 'var(--bg-secondary)',
                      borderRadius: '12px',
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'column',
                    }}
                  >
                    {claims.map((claim: any, idx: number) => {
                      const status = statusLabel(claim);
                      const isLast = idx === claims.length - 1;
                      return (
                        <div
                          key={claim.claimId}
                          onClick={() => navigateToForm('view', claim.claimId)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '12px',
                            padding: '12px 14px',
                            backgroundColor: 'transparent',
                            borderBottom: isLast ? 'none' : '1px solid var(--border-color)',
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
                <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)' }}>No pending applications.</p>
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
                          color: bid.role === 'EA' ? 'var(--blue-secondary)' : 'var(--green-secondary)',
                          backgroundColor: bid.role === 'EA' ? '#edf6fd' : 'var(--mint)',
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

      {showBottomBar && (
        <div
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 5,
            display: 'flex',
            justifyContent: 'center',
            // Bottom padding keeps the CTAs clear of the floating dock pill,
            // which occupies the ~50px above the bottom safe area.
            padding: '12px 16px calc(62px + env(safe-area-inset-bottom, 0px))',
            backgroundColor: 'var(--bg-primary)',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 'var(--max-width)',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            {activeTab === 'contributor' && showNewClaimButton && (
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
            {activeTab === 'contributor' && showApplySaButton && (
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
        </div>
      )}
    </div>
  );
}
