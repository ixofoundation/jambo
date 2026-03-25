import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { GrantAuthorization } from '@ixo/impactxclient-sdk/types/codegen/cosmos/authz/v1beta1/authz';
import { createQueryClient, createRegistry } from '@ixo/impactxclient-sdk';
import { createMatrixBidBotClient } from '@ixo/matrixclient-sdk';

import { useAuth } from '@hooks/useAuth';
import { useBackgroundSetup } from '@hooks/useBackgroundSetup';
import { useProtocolCollections } from '@hooks/useProtocolCollections';
import { useAppSelector, useAppDispatch } from '@store/hooks';
import { addProject } from '@store/slices/projectsSlice';
import Header from '@components/Header/Header';
import GradientBand from '@components/GradientBand/GradientBand';
import { GRADIENT_COLORS } from '@constants/gradientColors';
import { CHAIN_RPC_URL } from '@constants/common';
import { TRANSACTION_TYPES } from '@constants/transaction';
import { secret } from '@utils/secrets';
import { getMatrixOpenIdToken } from '@utils/matrix';

function readableStatus(status?: number): string {
  if (status === 0) return 'Created';
  if (status === 1) return 'Active';
  if (status === 2) return 'Paused';
  if (status === 3) return 'Closed';
  return 'Active';
}

function readableType(type?: string): string {
  if (!type) return '';
  // "dao/project" → "Project", "protocol/claim" → "Claim Protocol"
  const parts = type.split('/');
  const last = parts[parts.length - 1] || '';
  return last.charAt(0).toUpperCase() + last.slice(1);
}

export default function Dashboard() {
  const router = useRouter();
  const entityDid = router.query.entityId as string | undefined;

  const authContext = useAuth();
  const { awaitCompletion } = useBackgroundSetup();
  const did = authContext.did!;
  const address = authContext.address!;

  const { collections: protocolCollections, loading: collectionsLoading } = useProtocolCollections(entityDid);

  const dispatch = useAppDispatch();
  const profile = useAppSelector((state) => (entityDid ? state.profiles.byEntityDid[entityDid] : undefined));
  const entity = useAppSelector((state) => (entityDid ? state.entities.byId[entityDid] : undefined));

  const projectName = profile?.name || entityDid || '';
  const projectType = readableType(profile?.type || entity?.type);
  const projectStatus = readableStatus(entity?.status);

  // Auto-add this entity to the projects list if it's a project type
  useEffect(() => {
    if (!entityDid) return;
    const type = (entity?.type || profile?.type || '').toLowerCase();
    if (type.includes('project')) {
      dispatch(addProject(entityDid));
    }
  }, [entityDid, entity?.type, profile?.type, dispatch]);

  // Per-collection authz status: 'agent' | 'pending' | 'unauthorized' | undefined (loading)
  const [collectionStatus, setCollectionStatus] = useState<Record<string, 'agent' | 'pending' | 'unauthorized'>>({});
  const [statusLoading, setStatusLoading] = useState(true);
  const bidBotClientRef = useRef<ReturnType<typeof createMatrixBidBotClient>>();

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

  useEffect(() => {
    if (!address || !did || protocolCollections.length === 0 || collectionsLoading) return;

    let cancelled = false;
    async function checkStatuses() {
      try {
        await awaitCompletion();
        if (cancelled) return;

        const queryClient = await createQueryClient(CHAIN_RPC_URL);
        const { grants } = await queryClient.cosmos.authz.v1beta1.granteeGrants({ grantee: address });
        const typedGrants = grants as GrantAuthorization[];

        const statuses: Record<string, 'agent' | 'pending' | 'unauthorized'> = {};
        const bidClient = getBidBotClient();
        const openIdToken = bidClient ? await getMatrixOpenIdToken() : undefined;
        const registry = createRegistry();

        await Promise.all(
          protocolCollections.map(async (c) => {
            const hasSubmit = typedGrants?.find((g) => {
              if (g.authorization?.typeUrl !== TRANSACTION_TYPES.SubmitClaimAuthorization || g.granter !== c.admin)
                return false;
              try {
                const decoded = registry.decode(g.authorization);
                const constraints = decoded.constraints ?? [];
                if (constraints.length === 0) return true;
                return constraints.some((con: any) => con.collectionId === c.collectionId);
              } catch {
                return false;
              }
            });
            if (hasSubmit) {
              statuses[c.collectionId] = 'agent';
              return;
            }
            if (bidClient) {
              try {
                const response = await bidClient.bid.v1beta1.queryBidsByDid(c.collectionId, did, openIdToken!, did);
                if (response.data?.length > 0) {
                  statuses[c.collectionId] = 'pending';
                  return;
                }
              } catch (err) {
                console.warn(`[Dashboard] Bid query failed for collection ${c.collectionId}:`, err);
              }
            }
            statuses[c.collectionId] = 'unauthorized';
          }),
        );

        if (!cancelled) {
          setCollectionStatus(statuses);
          setStatusLoading(false);
        }
      } catch (err) {
        console.warn('[Dashboard] checkStatuses error:', err);
        if (!cancelled) setStatusLoading(false);
      }
    }

    checkStatuses();
    return () => {
      cancelled = true;
    };
  }, [address, did, protocolCollections, collectionsLoading]);

  function statusBadge(status?: 'agent' | 'pending' | 'unauthorized') {
    if (!status) return null;
    const config = {
      agent: { label: 'Agent', color: 'var(--green-primary)' },
      pending: { label: 'Pending', color: 'var(--yellow-primary)' },
      unauthorized: { label: 'Unauthorized', color: 'var(--text-secondary)' },
    }[status];
    return (
      <span
        style={{
          fontSize: '11px',
          fontWeight: 600,
          color: config.color,
          backgroundColor: `color-mix(in srgb, ${config.color} 12%, transparent)`,
          padding: '2px 8px',
          borderRadius: '10px',
          flexShrink: 0,
          whiteSpace: 'nowrap',
        }}
      >
        {config.label}
      </span>
    );
  }

  return (
    <div style={{ position: 'relative', minHeight: '100vh' }}>
      <GradientBand {...GRADIENT_COLORS.dashboard} />
      <Header onGradient />
      <main
        style={{
          position: 'relative',
          zIndex: 1,
          maxWidth: 'var(--max-width)',
          margin: '0 auto',
          padding: '0 16px 16px',
          paddingTop: 'calc(var(--header-height) + 8px)',
          minHeight: '100vh',
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
            onClick={() => router.push('/entities')}
            aria-label='Go back to projects'
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
            Projects
          </button>
          <h1
            style={{
              margin: '0 0 4px',
              fontSize: '20px',
              fontWeight: 600,
              color: '#fff',
              letterSpacing: '-0.3px',
              lineHeight: 1.2,
            }}
          >
            {projectName}
          </h1>
          {(projectType || projectStatus) && (
            <p style={{ margin: 0, fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>
              {projectType}
              {projectType && projectStatus ? ' \u00B7 ' : ''}
              {projectStatus}
            </p>
          )}
        </div>

        {/* Collection list */}
        {collectionsLoading ? (
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
        ) : protocolCollections.length === 0 ? (
          <div
            style={{
              backgroundColor: 'var(--bg-secondary)',
              borderRadius: '16px',
              border: '1px solid var(--border-color)',
              padding: '32px 16px',
              textAlign: 'center',
            }}
          >
            <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)' }}>No collections found</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {protocolCollections.map((c) => (
              <button
                key={c.collectionId}
                onClick={() =>
                  router.push(`/entities/${entityDid}/claimCollections/${encodeURIComponent(c.collectionId)}`)
                }
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px 16px',
                  border: '1px solid var(--border-color)',
                  borderRadius: '16px',
                  backgroundColor: 'var(--bg-secondary)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  width: '100%',
                  color: 'var(--text-primary)',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p
                    style={{
                      margin: 0,
                      fontSize: '15px',
                      fontWeight: 500,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                    }}
                  >
                    {c.formName || `Collection ${c.collectionId}`}
                  </p>
                  <div style={{ margin: '4px 0 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      {c.endDate && new Date(c.endDate).getFullYear() > 1970 && new Date(c.endDate) < new Date()
                        ? `Ended ${new Date(c.endDate).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}`
                        : c.startDate
                        ? `Started ${new Date(c.startDate).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}`
                        : ''}
                    </span>
                    {!statusLoading && statusBadge(collectionStatus[c.collectionId])}
                  </div>
                </div>
                <div style={{ flexShrink: 0, marginLeft: '12px' }}>
                  <svg
                    width='16'
                    height='16'
                    viewBox='0 0 24 24'
                    fill='none'
                    stroke='var(--text-secondary)'
                    strokeWidth='2'
                    strokeLinecap='round'
                    strokeLinejoin='round'
                  >
                    <polyline points='9 18 15 12 9 6' />
                  </svg>
                </div>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
