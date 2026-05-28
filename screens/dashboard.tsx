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
import { CHAIN_RPC_URL } from '@constants/common';
import { TRANSACTION_TYPES } from '@constants/transaction';
import { secret } from '@utils/secrets';
import { withMatrixOpenIdRetry } from '@utils/matrix';

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

type RoleStatus = 'agent' | 'pending' | 'none';

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

  // Per-collection authz status for SA and EA independently
  const [collectionStatus, setCollectionStatus] = useState<Record<string, { sa: RoleStatus; ea: RoleStatus }>>({});
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

        const statuses: Record<string, { sa: RoleStatus; ea: RoleStatus }> = {};
        const bidClient = getBidBotClient();
        const registry = createRegistry();

        function grantMatchesCollection(g: GrantAuthorization, typeUrl: string, admin: string, colId: string): boolean {
          if (g.authorization?.typeUrl !== typeUrl || g.granter !== admin) return false;
          try {
            const decoded = registry.decode(g.authorization);
            const constraints = decoded.constraints ?? [];
            if (constraints.length === 0) return true;
            return constraints.some((con: any) => con.collectionId === colId);
          } catch {
            return false;
          }
        }

        await Promise.all(
          protocolCollections.map(async (c) => {
            const hasSubmit = typedGrants?.find((g) =>
              grantMatchesCollection(g, TRANSACTION_TYPES.SubmitClaimAuthorization, c.admin, c.collectionId),
            );
            const hasEval = typedGrants?.find((g) =>
              grantMatchesCollection(g, TRANSACTION_TYPES.EvaluateClaimAuthorization, c.admin, c.collectionId),
            );

            let saStatus: RoleStatus = hasSubmit ? 'agent' : 'none';
            let eaStatus: RoleStatus = hasEval ? 'agent' : 'none';

            // Check bids for pending roles
            if (bidClient && (saStatus === 'none' || eaStatus === 'none')) {
              try {
                const response = await withMatrixOpenIdRetry((token) =>
                  bidClient.bid.v1beta1.queryBidsByDid(c.collectionId, did, token, did),
                );
                const bidData = response.data ?? [];
                if (saStatus === 'none' && bidData.some((b: any) => b.role === 'SA')) saStatus = 'pending';
                if (eaStatus === 'none' && bidData.some((b: any) => b.role === 'EA')) eaStatus = 'pending';
              } catch (err) {
                console.warn(`[Dashboard] Bid query failed for collection ${c.collectionId}:`, err);
              }
            }

            statuses[c.collectionId] = { sa: saStatus, ea: eaStatus };
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

  function statusBadges(status?: { sa: RoleStatus; ea: RoleStatus }) {
    if (!status) return null;
    const badges: { label: string; color: string }[] = [];
    if (status.sa === 'agent') badges.push({ label: 'Contributor', color: 'var(--green-primary)' });
    else if (status.sa === 'pending') badges.push({ label: 'SA Pending', color: 'var(--yellow-primary)' });
    if (status.ea === 'agent') badges.push({ label: 'Evaluator', color: 'var(--green-primary)' });
    else if (status.ea === 'pending') badges.push({ label: 'EA Pending', color: 'var(--yellow-primary)' });
    if (badges.length === 0) return null;
    return (
      <>
        {badges.map((b, i) => (
          <span
            key={i}
            style={{
              fontSize: '11px',
              fontWeight: 600,
              color: b.color,
              backgroundColor: `color-mix(in srgb, ${b.color} 12%, transparent)`,
              padding: '2px 8px',
              borderRadius: '10px',
              flexShrink: 0,
              whiteSpace: 'nowrap',
            }}
          >
            {b.label}
          </span>
        ))}
      </>
    );
  }

  return (
    <div style={{ position: 'relative', minHeight: '100vh' }}>
      {/* Gradient band sized to cover the header + project-name section + ~15px overlap
          into the top of the collection list. (Default GradientBand is 30vh which is
          much taller than needed on this screen.) */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 'calc(var(--header-height) + 133px)',
          zIndex: 0,
          pointerEvents: 'none',
          background: 'radial-gradient(ellipse at top right, var(--purple-secondary), var(--purple-primary) 70%)',
        }}
      />
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
        {/* Project header \u2014 sits in the gradient band, styled like Settings/Support titles. */}
        <div
          style={{
            minHeight: '110px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
          }}
        >
          <h1
            style={{
              margin: '0 0 4px',
              fontSize: '1.1rem',
              fontWeight: 500,
              color: '#fff',
              lineHeight: 1.2,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
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
          <div
            style={{
              backgroundColor: 'var(--bg-secondary)',
              borderRadius: '12px',
              overflow: 'hidden',
            }}
          >
            {protocolCollections.map((c, idx) => (
              <button
                key={c.collectionId}
                onClick={() =>
                  router.push(`/entities/${entityDid}/claimCollections/${encodeURIComponent(c.collectionId)}`)
                }
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  width: '100%',
                  padding: '14px 16px',
                  border: 'none',
                  borderBottom:
                    idx === protocolCollections.length - 1 ? 'none' : '1px solid var(--border-color)',
                  backgroundColor: 'transparent',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  textAlign: 'left',
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
                    {!statusLoading && statusBadges(collectionStatus[c.collectionId])}
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
