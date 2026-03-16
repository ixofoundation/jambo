import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { GrantAuthorization } from '@ixo/impactxclient-sdk/types/codegen/cosmos/authz/v1beta1/authz';
import { createQueryClient, createRegistry } from '@ixo/impactxclient-sdk';
import { createMatrixBidBotClient } from '@ixo/matrixclient-sdk';

import { useAuth } from '@hooks/useAuth';
import EditAccountModal from '@components/EditAccountModal/EditAccountModal';
import { useProtocolCollections } from '@hooks/useProtocolCollections';
import { useAppSelector } from '@store/hooks';
import Header from '@components/Header/Header';
import { CHAIN_RPC_URL } from '@constants/common';
import { TRANSACTION_TYPES } from '@constants/transaction';
import { secret } from '@utils/secrets';

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
  const did = authContext.did!;
  const address = authContext.address!;
  const method = authContext.signingMethod!;
  const onSign = authContext.onSign;
  const onAuthenticate = authContext.onAuthenticate;
  const [showEditAccount, setShowEditAccount] = useState(false);

  const {
    collections: protocolCollections,
    loading: collectionsLoading,
  } = useProtocolCollections(entityDid);

  const profile = useAppSelector((state) => (entityDid ? state.profiles.byEntityDid[entityDid] : undefined));
  const entity = useAppSelector((state) => (entityDid ? state.entities.byId[entityDid] : undefined));

  const projectName = profile?.name || entityDid || '';
  const projectType = readableType(profile?.type || entity?.type);
  const projectStatus = readableStatus(entity?.status);

  // Per-collection authz status: 'agent' | 'pending' | 'unauthorized' | undefined (loading)
  const [collectionStatus, setCollectionStatus] = useState<Record<string, 'agent' | 'pending' | 'unauthorized'>>({});
  const [statusLoading, setStatusLoading] = useState(true);
  const bidBotClientRef = useRef<ReturnType<typeof createMatrixBidBotClient>>();

  function getBidBotClient() {
    if (bidBotClientRef.current?.bid) return bidBotClientRef.current;
    bidBotClientRef.current = createMatrixBidBotClient({
      botUrl: process.env.NEXT_PUBLIC_MATRIX_BID_BOT_URL!,
      accessToken: secret.accessToken as string,
    });
    return bidBotClientRef.current;
  }

  useEffect(() => {
    if (!address || !did || protocolCollections.length === 0 || collectionsLoading) return;

    let cancelled = false;
    async function checkStatuses() {
      try {
        const queryClient = await createQueryClient(CHAIN_RPC_URL);
        const { grants } = await queryClient.cosmos.authz.v1beta1.granteeGrants({ grantee: address });
        const typedGrants = grants as GrantAuthorization[];

        const statuses: Record<string, 'agent' | 'pending' | 'unauthorized'> = {};
        const bidClient = getBidBotClient();
        const registry = createRegistry();

        await Promise.all(
          protocolCollections.map(async (c) => {
            const hasSubmit = typedGrants?.find((g) => {
              if (g.authorization?.typeUrl !== TRANSACTION_TYPES.SubmitClaimAuthorization || g.granter !== c.admin) return false;
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
            try {
              const response = await bidClient.bid.v1beta1.queryBidsByDid(c.collectionId, did);
              if (response.data?.length > 0) {
                statuses[c.collectionId] = 'pending';
                return;
              }
            } catch {}
            statuses[c.collectionId] = 'unauthorized';
          }),
        );

        if (!cancelled) {
          setCollectionStatus(statuses);
          setStatusLoading(false);
        }
      } catch {
        if (!cancelled) setStatusLoading(false);
      }
    }

    checkStatuses();
    return () => { cancelled = true; };
  }, [address, did, protocolCollections, collectionsLoading]);

  function statusBadge(status?: 'agent' | 'pending' | 'unauthorized') {
    if (!status) return null;
    const config = {
      agent: { label: 'Agent', color: 'var(--success-color)' },
      pending: { label: 'Pending', color: 'var(--warning-color)' },
      unauthorized: { label: 'Unauthorized', color: 'var(--muted-font-color)' },
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
    <>
      <Header />
      <main
        style={{
          maxWidth: 'var(--max-width)',
          margin: '0 auto',
          padding: '0 16px 16px',
          paddingTop: 'calc(var(--header-height) + 8px)',
          minHeight: '100vh',
        }}
      >
        {/* Title */}
        <h1
          style={{
            margin: '0 0 4px',
            fontSize: '20px',
            fontWeight: 600,
            color: 'var(--main-font-color)',
            letterSpacing: '-0.3px',
            lineHeight: 1.2,
          }}
        >
          {projectName}
        </h1>

        {/* Subtitle */}
        {(projectType || projectStatus) && (
          <p style={{ margin: '0 0 24px', fontSize: '13px', color: 'var(--muted-font-color)' }}>
            {projectType}{projectType && projectStatus ? ' \u00B7 ' : ''}{projectStatus}
          </p>
        )}
        {!projectType && !projectStatus && <div style={{ marginBottom: '24px' }} />}

        {/* Collection list */}
        {collectionsLoading ? (
          <p style={{ margin: '32px 0', fontSize: '14px', color: 'var(--muted-font-color)', textAlign: 'center' }}>
            Loading...
          </p>
        ) : protocolCollections.length === 0 ? (
          <p style={{ margin: '32px 0', fontSize: '14px', color: 'var(--muted-font-color)', textAlign: 'center' }}>
            No collections found
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {protocolCollections.map((c, i) => (
              <button
                key={c.collectionId}
                onClick={() => router.push(`/entities/${entityDid}/claimCollections/${encodeURIComponent(c.collectionId)}`)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px 0',
                  border: 'none',
                  borderBottom: i < protocolCollections.length - 1 ? '1px solid var(--border-color)' : 'none',
                  background: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  width: '100%',
                  color: 'var(--main-font-color)',
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
                    <span style={{ fontSize: '12px', color: 'var(--muted-font-color)' }}>
                      {c.endDate && new Date(c.endDate) < new Date()
                        ? `Ended ${new Date(c.endDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`
                        : c.startDate
                          ? `Started ${new Date(c.startDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`
                          : ''}
                    </span>
                    {!statusLoading && statusBadge(collectionStatus[c.collectionId])}
                  </div>
                </div>
                <div style={{ flexShrink: 0, marginLeft: '12px' }}>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="var(--muted-font-color)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </div>
              </button>
            ))}
          </div>
        )}
      </main>
      {!!showEditAccount && (
        // @ts-ignore
        <EditAccountModal
          address={address}
          did={did}
          method={method}
          onClose={() => setShowEditAccount(false)}
          onSign={onSign}
          onAuthenticate={onAuthenticate}
        />
      )}
    </>
  );
}
