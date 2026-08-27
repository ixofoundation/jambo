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
import { BadgeCheckIcon, CalendarDaysIcon, ChevronRightIcon, FileCheckIcon, MapPinIcon } from '@components/Icons/icons';
import { CHAIN_RPC_URL } from '@constants/common';
import { TRANSACTION_TYPES } from '@constants/transaction';
import { secret } from '@utils/secrets';
import { withMatrixOpenIdRetry } from '@utils/matrix';
import { ensureEntityProfiles } from '@utils/entityProfiles';

function readableStatus(status?: number): string {
  // Status 0 ("Created") is suppressed: testers read it as the outcome of their
  // own swipe rather than the deed's on-chain state. Unknown no longer defaults
  // to "Active" — only real statuses are shown.
  if (status === 1) return 'Active';
  if (status === 2) return 'Paused';
  if (status === 3) return 'Closed';
  return '';
}

/**
 * On-chain dates carry two "no date" sentinels: epoch-era zeros and far-future
 * (+100 year) stamps. Only dates between those are worth showing.
 */
function isRealDate(iso?: string): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return false;
  return d.getFullYear() > 1970 && d.getFullYear() < new Date().getFullYear() + 90;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
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

  // The deed's own start/end window, from the on-chain entity record.
  const entityStart = isRealDate(entity?.startDate) ? formatDate(entity.startDate) : '';
  const entityEnd = isRealDate(entity?.endDate) ? formatDate(entity.endDate) : '';
  const entityDates =
    entityStart && entityEnd
      ? `${entityStart} – ${entityEnd}`
      : entityStart
      ? `${new Date(entity.startDate) > new Date() ? 'Starts' : 'Started'} ${entityStart}`
      : entityEnd
      ? `Ends ${entityEnd}`
      : '';

  // Auto-add this entity to the projects list if it's a project type
  useEffect(() => {
    if (!entityDid) return;
    const type = (entity?.type || profile?.type || '').toLowerCase();
    if (type.includes('project')) {
      dispatch(addProject(entityDid));
    }
  }, [entityDid, entity?.type, profile?.type, dispatch]);

  // Fetch the full profile document (hero image, description) for this entity.
  useEffect(() => {
    if (entityDid) void ensureEntityProfiles([entityDid]);
  }, [entityDid]);

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
    const badges: { label: string; bg: string; fg: string }[] = [];
    if (status.sa === 'agent') badges.push({ label: 'Contributor', bg: 'var(--mint)', fg: 'var(--green-primary)' });
    else if (status.sa === 'pending') badges.push({ label: 'SA Pending', bg: '#fdeed8', fg: 'var(--warning-color)' });
    if (status.ea === 'agent') badges.push({ label: 'Evaluator', bg: 'var(--mint)', fg: 'var(--green-primary)' });
    else if (status.ea === 'pending') badges.push({ label: 'EA Pending', bg: '#fdeed8', fg: 'var(--warning-color)' });
    if (badges.length === 0) return null;
    return (
      <>
        {badges.map((b, i) => (
          <span
            key={i}
            className='badge'
            style={{ background: b.bg, color: b.fg, fontSize: '12px', padding: '4px 10px', flexShrink: 0, whiteSpace: 'nowrap' }}
          >
            {b.label}
          </span>
        ))}
      </>
    );
  }

  function collectionDates(c: (typeof protocolCollections)[number]): string {
    if (isRealDate(c.endDate) && new Date(c.endDate!) < new Date()) {
      return `Ended ${formatDate(c.endDate!)}`;
    }
    const parts: string[] = [];
    if (isRealDate(c.startDate)) {
      parts.push(`${new Date(c.startDate!) > new Date() ? 'Starts' : 'Started'} ${formatDate(c.startDate!)}`);
    }
    if (isRealDate(c.endDate)) {
      parts.push(`Closes ${formatDate(c.endDate!)}`);
    }
    return parts.join(' · ');
  }

  return (
    <div style={{ position: 'relative', minHeight: '100dvh' }}>
      <Header onGradient title='Back' onBack={() => router.push('/')} />
      <main
        style={{
          position: 'relative',
          zIndex: 1,
          maxWidth: 'var(--max-width)',
          margin: '0 auto',
          padding: '0 20px var(--dock-clearance)',
          paddingTop: 'calc(var(--header-height) + 4px)',
          minHeight: '100dvh',
        }}
      >
        {/* Opportunity hero \u2014 the entity's own imagery on the light ground */}
        {profile?.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.image}
            alt=''
            style={{ width: '100%', height: 165, borderRadius: 14, objectFit: 'cover', display: 'block' }}
          />
        )}
        <h1 className='title-lg' style={{ marginTop: profile?.image ? 16 : 4 }}>
          {projectName}
        </h1>
        <p className='deck-card__provider' style={{ color: 'var(--text-primary)', opacity: 1, marginTop: 4 }}>
          <BadgeCheckIcon size={15} color='var(--green-primary)' />
          {profile?.brand ? `${profile.brand} \u00B7 Verified partner` : 'Verified partner'}
        </p>

        <div className='info-list' style={{ marginTop: 16 }}>
          {(projectType || projectStatus) && (
            <div className='info-row'>
              <span className='info-row__icon'>
                <FileCheckIcon size={20} />
              </span>
              <div>
                <div className='info-row__t'>{projectType || 'Opportunity'}</div>
                {projectStatus && <div className='info-row__s'>{projectStatus}</div>}
              </div>
            </div>
          )}
          {profile?.location && (
            <div className='info-row'>
              <span className='info-row__icon'>
                <MapPinIcon size={20} />
              </span>
              <div>
                <div className='info-row__t'>{profile.location}</div>
              </div>
            </div>
          )}
          {entityDates && (
            <div className='info-row'>
              <span className='info-row__icon'>
                <CalendarDaysIcon size={20} />
              </span>
              <div>
                <div className='info-row__t'>{entityDates}</div>
              </div>
            </div>
          )}
        </div>

        {profile?.description && (
          <>
            <h3 className='muted' style={{ fontSize: 14, margin: '22px 0 8px', fontWeight: 600 }}>
              About
            </h3>
            <p style={{ fontSize: 14.5, lineHeight: 1.6, margin: 0, whiteSpace: 'pre-line' }}>{profile.description}</p>
          </>
        )}

        <div className='section-header'>
          <h2>Submit Your Claims</h2>
        </div>

        {collectionsLoading ? (
          <div className='card card--inset center' style={{ padding: '32px 16px' }}>
            <p className='muted' style={{ margin: 0, fontSize: 14 }}>
              Loading\u2026
            </p>
          </div>
        ) : protocolCollections.length === 0 ? (
          <div className='card card--inset center' style={{ padding: '32px 16px' }}>
            <p className='muted' style={{ margin: 0, fontSize: 14 }}>
              No claim collections found
            </p>
          </div>
        ) : (
          protocolCollections.map((c) => (
            <button
              key={c.collectionId}
              className='status-item'
              style={{ width: '100%', marginBottom: 12 }}
              onClick={() =>
                router.push(`/entities/${entityDid}/claimCollections/${encodeURIComponent(c.collectionId)}`)
              }
            >
              <div className='status-item__body'>
                <div className='status-item__title' style={{ fontSize: 15.5 }}>
                  {c.formName || `Collection ${c.collectionId}`}
                </div>
                <div className='status-item__meta hstack' style={{ gap: 6, flexWrap: 'wrap' }}>
                  {collectionDates(c) && <span>{collectionDates(c)}</span>}
                  {!statusLoading && statusBadges(collectionStatus[c.collectionId])}
                </div>
              </div>
              <ChevronRightIcon size={18} color='var(--text-secondary)' />
            </button>
          ))
        )}
      </main>
    </div>
  );
}
