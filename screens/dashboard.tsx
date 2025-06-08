import { useState, useRef, useEffect } from 'react';
import { GrantAuthorization } from '@ixo/impactxclient-sdk/types/codegen/cosmos/authz/v1beta1/authz';
import { DeliverTxResponse } from '@cosmjs/stargate';
import { createQueryClient } from '@ixo/impactxclient-sdk';

import Button, { BUTTON_BG_COLOR, BUTTON_BORDER_COLOR, BUTTON_COLOR, BUTTON_SIZE } from '@components/Button/Button';
import { secret } from '@utils/secrets';
import { fetchCollectionByCollectionId } from '@utils/claims';
import MyBids from '@components/MyBids/MyBids';
import CollectionBids from '@components/CollectionBids/CollectionBids';
import MyClaims from '@components/MyClaims/MyClaims';
import { logoutMatrixClient } from '@utils/matrix';
import CollectionClaims from '@components/CollectionClaims/CollectionClaims';
import { CHAIN_RPC_URL } from '@constants/common';
import { TRANSACTION_TYPES } from '@constants/transaction';
import { fetchProtocolEntity } from '@utils/entity';

interface Bid {
  id: string;
  did: string;
  collection: string;
  type: 'bid';
  address: string;
  data: string;
  role: string;
  created: string;
}

interface BidsDashboardProps {
  did: string;
  address: string;
  onSign: (messages: any[]) => Promise<DeliverTxResponse>;
}

export default function BidsDashboard({ did, address, onSign }: BidsDashboardProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [collectionId, setCollectionId] = useState<string>('');
  const [activeTab, setActiveTab] = useState('myBids');
  const [auths, setAuths] = useState<string[]>([]);

  const claimCollectionIdRef = useRef<string>('');
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const myBidsEnabled = !!address && !!claimCollectionIdRef.current;
  const collectionBidsEnabled = !!auths.includes('owner') && !!claimCollectionIdRef.current;
  const myClaimsEnabled =
    !!auths.includes(TRANSACTION_TYPES.SubmitClaimAuthorization) && !!claimCollectionIdRef.current;
  const collectionClaimsEnabled =
    !!auths.includes(TRANSACTION_TYPES.EvaluateClaimAuthorization) && !!claimCollectionIdRef.current;

  useEffect(
    function () {
      if (address && claimCollectionIdRef.current) {
        checkAuthz();
      }

      return function () {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
      };
    },
    [claimCollectionIdRef.current, address],
  );

  async function handleSearch() {
    try {
      setLoading(true);
      setError(null);
      const collection = await fetchCollectionByCollectionId(collectionId);
      console.log('collection', collection);
      if (!collection?.id) {
        throw new Error('Collection not found');
      }
      claimCollectionIdRef.current = collectionId;
    } catch (err) {
      setError((err as Error).message);
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function checkAuthz() {
    try {
      const collection = await fetchCollectionByCollectionId(collectionId);
      setAuths((prevState) =>
        collection.admin === address
          ? prevState.some((v) => v === 'admin')
            ? prevState
            : [...prevState, 'admin']
          : prevState.filter((v) => v !== 'admin'),
      );
      const queryClient = await createQueryClient(CHAIN_RPC_URL);
      const [granteeGrants, entity] = await Promise.all([
        queryClient.cosmos.authz.v1beta1.granteeGrants({
          grantee: address,
        }),
        fetchProtocolEntity(collection.entity),
      ]);
      if (entity?.owner === address) {
        if (!auths.includes('owner')) {
          setAuths((prevState) => [...prevState, 'owner']);
        }
      } else {
        if (auths.includes('owner')) {
          setAuths((prevState) => prevState.filter((v) => v !== 'owner'));
        }
      }
      const hasSubmitClaimAuthz = (granteeGrants.grants as GrantAuthorization[])?.find(
        (g) =>
          g.authorization?.typeUrl === TRANSACTION_TYPES.SubmitClaimAuthorization && g.granter === collection.admin,
      );
      if (hasSubmitClaimAuthz) {
        if (!auths.includes(TRANSACTION_TYPES.SubmitClaimAuthorization)) {
          setAuths((prevState) => [...prevState, TRANSACTION_TYPES.SubmitClaimAuthorization]);
        }
      } else {
        if (auths.includes(TRANSACTION_TYPES.SubmitClaimAuthorization)) {
          setAuths((prevState) => prevState.filter((v) => v !== TRANSACTION_TYPES.SubmitClaimAuthorization));
        }
      }
      const hasEvaluateClaimAuthz = (granteeGrants.grants as GrantAuthorization[])?.find(
        (g) =>
          g.authorization?.typeUrl === TRANSACTION_TYPES.EvaluateClaimAuthorization && g.granter === collection.admin,
      );
      if (hasEvaluateClaimAuthz) {
        if (!auths.includes(TRANSACTION_TYPES.EvaluateClaimAuthorization)) {
          setAuths((prevState) => [...prevState, TRANSACTION_TYPES.EvaluateClaimAuthorization]);
        }
      } else {
        if (auths.includes(TRANSACTION_TYPES.EvaluateClaimAuthorization)) {
          setAuths((prevState) => prevState.filter((v) => v !== TRANSACTION_TYPES.EvaluateClaimAuthorization));
        }
      }
    } catch (errr) {
      // silent fail
    } finally {
      timeoutRef.current = setTimeout(checkAuthz, 5000);
    }
  }

  return (
    <div
      style={{
        maxWidth: '768px',
        margin: '0 auto',
        padding: '48px 16px',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div
          style={{
            border: '1px solid #e9ecef',
            borderRadius: '8px',
            padding: '16px',
            backgroundColor: 'white',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <p style={{ fontWeight: 500 }}>Account</p>
            <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between' }}>
              <div>
                <p style={{ margin: 0, fontSize: '12px' }}>
                  <span style={{ fontWeight: '500', padding: 0, margin: 0 }}>ADDRESS:</span> {address}
                </p>
                <p style={{ margin: 0, fontSize: '12px' }}>
                  <span style={{ fontWeight: '500', padding: 0, margin: 0 }}>DID:</span> {did}
                </p>
              </div>
              {/* @ts-ignore */}
              <Button
                label='Logout'
                color={BUTTON_COLOR.white}
                bgColor={BUTTON_BG_COLOR.error}
                size={BUTTON_SIZE.medium}
                onClick={async () => {
                  await logoutMatrixClient({ baseUrl: secret.baseUrl });
                  window.location.reload();
                }}
              />
            </div>
          </div>
        </div>
        <div
          style={{
            border: '1px solid #e9ecef',
            borderRadius: '8px',
            padding: '16px',
            backgroundColor: 'white',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '10px' }}>
            <div style={{ flex: 1 }}>
              <label
                style={{
                  // display: 'block',
                  marginBottom: '4px',
                  fontSize: '14px',
                }}
              >
                Collection ID
              </label>
              <input
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #ced4da',
                  borderRadius: '4px',
                  fontSize: '14px',
                }}
                placeholder='Enter collection ID'
                value={collectionId}
                onChange={(e) => setCollectionId(e.target.value)}
              />
            </div>
            {/* @ts-ignore */}
            <Button
              label='Search'
              disabled={collectionId === claimCollectionIdRef.current}
              onClick={handleSearch}
              color={BUTTON_COLOR.primary}
              size={BUTTON_SIZE.mediumLarge}
              bgColor={BUTTON_BG_COLOR.white}
              borderColor={BUTTON_BORDER_COLOR.primary}
            />
          </div>
          {!!auths.length && (
            <div style={{ marginTop: 10 }}>
              {auths.map((a) => (
                <span
                  key={a}
                  style={{
                    padding: 8,
                    borderRadius: 10,
                    marginRight: 10,
                    border: '1px solid #e9ecef',
                    fontSize: 12,
                  }}
                >
                  {a === TRANSACTION_TYPES.SubmitClaimAuthorization
                    ? 'Service Agent'
                    : a === TRANSACTION_TYPES.EvaluateClaimAuthorization
                    ? 'Evaluation Agent'
                    : a === 'admin'
                    ? 'Collection Admin'
                    : a === 'owner'
                    ? 'Collection Owner'
                    : 'Unknown'}
                </span>
              ))}
            </div>
          )}
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
          }}
        >
          <div
            style={{
              borderBottom: '1px solid #e9ecef',
              display: 'flex',
              gap: '4px',
            }}
          >
            {[
              { id: 'myBids', label: 'My Bids', enabled: myBidsEnabled },
              { id: 'collectionBids', label: 'Collection Bids', enabled: collectionBidsEnabled },
              { id: 'myClaims', label: 'My Claims', enabled: myClaimsEnabled },
              { id: 'collectionClaims', label: 'Collection Claims', enabled: collectionClaimsEnabled },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                disabled={!tab.enabled}
                style={{
                  padding: '12px 16px',
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  opacity: tab.enabled ? 1 : 0.5,
                  borderBottom: activeTab === tab.id ? '2px solid #228be6' : '2px solid transparent',
                  color: activeTab === tab.id ? '#228be6' : '#495057',
                  fontWeight: activeTab === tab.id ? 500 : 400,
                  transition: 'all 0.2s',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'myBids' ? (
            myBidsEnabled ? (
              // @ts-ignore
              <MyBids address={address} did={did} collectionId={claimCollectionIdRef.current} onSign={onSign} />
            ) : null
          ) : activeTab === 'collectionBids' ? (
            collectionBidsEnabled ? (
              // @ts-ignore
              <CollectionBids address={address} did={did} collectionId={claimCollectionIdRef.current} onSign={onSign} />
            ) : null
          ) : activeTab === 'myClaims' ? (
            myClaimsEnabled ? (
              // @ts-ignore
              <MyClaims address={address} did={did} collectionId={claimCollectionIdRef.current} onSign={onSign} />
            ) : null
          ) : activeTab === 'collectionClaims' ? (
            collectionClaimsEnabled ? (
              // @ts-ignore
              <CollectionClaims
                address={address}
                did={did}
                collectionId={claimCollectionIdRef.current}
                onSign={onSign}
              />
            ) : null
          ) : null}
        </div>
      </div>
    </div>
  );
}
