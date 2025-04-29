import { useState, useRef, useEffect } from 'react';
import { createMatrixBidBotClient } from '@ixo/matrixclient-sdk';
import { cosmos, createQueryClient, createRegistry, ixo, utils } from '@ixo/impactxclient-sdk';
import { DeliverTxResponse } from '@cosmjs/stargate';
import Long from 'long';
import 'survey-core/defaultV2.min.css';
import 'survey-core/themes/borderless-dark';

import Button, { BUTTON_BG_COLOR, BUTTON_COLOR, BUTTON_SIZE } from '@components/Button/Button';
import { secret } from '@utils/secrets';
import { fetchCollectionByCollectionId } from '@utils/claims';
import { CHAIN_RPC_URL } from '@constants/common';
import { addDays } from '@utils/timestamp';

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

interface CollectionBidsProps {
  did: string;
  address: string;
  collectionId: string;
  onSign: (messages: any[]) => Promise<DeliverTxResponse>;
}

type MatrixBidBotClient = ReturnType<typeof createMatrixBidBotClient>;

export default function CollectionBids({ did, address, collectionId, onSign }: CollectionBidsProps) {
  const [bids, setBids] = useState<Bid[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedBid, setSelectedBid] = useState<Bid | undefined>();
  const [reason, setReason] = useState<string | undefined>();

  const bidBotClientRef = useRef<MatrixBidBotClient>();
  const fetchMyBidsRef = useRef<string | undefined>();

  useEffect(
    function () {
      if (did && address && collectionId) {
        fetchCollectionBids();
      }
    },
    [did, address, collectionId],
  );

  function getBidBotClient() {
    if (bidBotClientRef.current?.bid) {
      return bidBotClientRef.current;
    }
    bidBotClientRef.current = createMatrixBidBotClient({
      botUrl: process.env.NEXT_PUBLIC_MATRIX_BID_BOT_URL!,
      accessToken: secret.accessToken as string,
    });
    return bidBotClientRef.current;
  }

  async function fetchCollectionBids() {
    const key = `${collectionId}@${did}`;
    if (fetchMyBidsRef.current === key) {
      return;
    }
    fetchMyBidsRef.current = key;
    try {
      setLoading(true);
      setError(null);
      const client = getBidBotClient();
      const bidsResponse = await client.bid.v1beta1.queryBids(collectionId);
      setBids(bidsResponse.data);
    } catch (err) {
      console.error('fetchCollectionBids::', err);
      setError((err as Error).message);
    } finally {
      setLoading(false);
      fetchMyBidsRef.current = undefined;
    }
  }

  async function handleApproveBid() {
    // [STEPS]
    // 1. grant bid submission or evaluation authz (trx)
    // 2. approve bid with bid bot
    // [DONE]
    try {
      if (!selectedBid) {
        throw new Error('No bid selected to evaluate');
      }
      // only supporting service agent bid evaluation for now
      if (selectedBid.role !== 'SA' && selectedBid.role !== 'EA') {
        throw new Error(`Bid evaluation for role ${selectedBid.role} is not implemented`);
      }
      let message: any;
      const collection = await fetchCollectionByCollectionId(collectionId);
      const adminAddress = collection?.admin ?? collection?.[0].admin;
      const queryClient = await createQueryClient(CHAIN_RPC_URL);
      const granteeGrants = await queryClient.cosmos.authz.v1beta1.granteeGrants({
        grantee: address,
      });
      const registry = createRegistry();
      if (selectedBid.role === 'SA') {
        const submitAuth = granteeGrants.grants?.find(
          (g) =>
            g.authorization?.typeUrl === '/ixo.claims.v1beta1.SubmitClaimAuthorization' && g.granter == adminAddress,
        );
        const granteeCurrentAuthConstraints = !submitAuth
          ? []
          : registry.decode(submitAuth!.authorization!).constraints;
        message = {
          typeUrl: '/ixo.entity.v1beta1.MsgGrantEntityAccountAuthz',
          value: ixo.entity.v1beta1.MsgGrantEntityAccountAuthz.fromPartial({
            id: collection.entity,
            ownerAddress: address,
            name: 'admin',
            granteeAddress: selectedBid.address,
            grant: cosmos.authz.v1beta1.Grant.fromPartial({
              authorization: {
                typeUrl: '/ixo.claims.v1beta1.SubmitClaimAuthorization',
                value: ixo.claims.v1beta1.SubmitClaimAuthorization.encode(
                  ixo.claims.v1beta1.SubmitClaimAuthorization.fromPartial({
                    admin: adminAddress,
                    constraints: [
                      ixo.claims.v1beta1.SubmitClaimConstraints.fromPartial({
                        collectionId,
                        agentQuota: Long.fromNumber(10), // custom agent quota - using default of 10
                        maxAmount: [
                          // custom max amount - using default of 1000000 uixo
                          {
                            amount: '1000000',
                            denom: 'uixo',
                          },
                        ],
                        maxCw20Payment: [], // custom max cw20 payment - using default of none
                        intentDurationNs: utils.proto.toDuration((1000000000 * 60).toString()), // custom intent duration - using default of 1 minute
                      }),
                      ...granteeCurrentAuthConstraints,
                    ],
                  }),
                ).finish(),
              },
              expiration: utils.proto.toTimestamp(addDays(new Date(), 30)), // custom expiration - using default of 30 days
            }),
          }),
        };
      } else if (selectedBid.role === 'EA') {
        const evaluateAuth = granteeGrants.grants?.find(
          (g) =>
            g.authorization?.typeUrl == '/ixo.claims.v1beta1.EvaluateClaimAuthorization' && g.granter == adminAddress,
        );
        const granteeCurrentAuthConstraints = !evaluateAuth
          ? []
          : registry.decode(evaluateAuth!.authorization!).constraints;
        message = {
          typeUrl: '/ixo.entity.v1beta1.MsgGrantEntityAccountAuthz',
          value: ixo.entity.v1beta1.MsgGrantEntityAccountAuthz.fromPartial({
            id: collection.entity,
            ownerAddress: address,
            name: 'admin',
            granteeAddress: selectedBid.address,
            grant: cosmos.authz.v1beta1.Grant.fromPartial({
              authorization: {
                typeUrl: '/ixo.claims.v1beta1.EvaluateClaimAuthorization',
                value: ixo.claims.v1beta1.EvaluateClaimAuthorization.encode(
                  ixo.claims.v1beta1.EvaluateClaimAuthorization.fromPartial({
                    admin: adminAddress,
                    constraints: [
                      ixo.claims.v1beta1.EvaluateClaimConstraints.fromPartial({
                        collectionId,
                        claimIds: [],
                        agentQuota: Long.fromNumber(100),
                        beforeDate: utils.proto.toTimestamp(addDays(new Date(), 365)),
                        // if want to do custom amount, must be within allowed authz if through authz
                        maxCustomAmount: [
                          cosmos.base.v1beta1.Coin.fromPartial({
                            amount: '3000000',
                            denom: 'uixo',
                          }),
                        ],
                        // maxCustomCw20Payment: [
                        //   ixo.claims.v1beta1.CW20Payment.fromPartial({
                        //     address: cw20Address,
                        //     amount: Long.fromNumber(30),
                        //   }),
                        // ],
                      }),
                      ...granteeCurrentAuthConstraints,
                    ],
                  }),
                ).finish(),
              },
              expiration: utils.proto.toTimestamp(addDays(new Date(), 30)),
            }),
          }),
        };
      }
      const trxResponse = await onSign([message]);
      console.log('trxResponse', trxResponse);
      const client = getBidBotClient();
      const bidResponse = await client.bid.v1beta1.approveBid(selectedBid.id, collectionId, selectedBid.did);
      if (!bidResponse.id) {
        throw new Error('Failed to approve bid');
      }
      setSelectedBid(undefined);
      fetchCollectionBids();
    } catch (err) {
      console.error(err);
      setError((err as Error).message);
    }
  }

  async function handleRejectBid() {
    // [STEPS]
    // 1. reject bid with bid bot
    // [DONE]
    try {
      if (!selectedBid) {
        throw new Error('No bid selected to evaluate');
      }
      const client = getBidBotClient();
      const response = await client.bid.v1beta1.rejectBid(
        selectedBid.id,
        collectionId,
        selectedBid.did,
        reason ?? 'Bid rejected',
      );
      if (!response.id) {
        throw new Error('Failed to approve bid');
      }
      setSelectedBid(undefined);
      fetchCollectionBids();
    } catch (err) {
      console.error(err);
      setError((err as Error).message);
    }
  }

  if (!collectionId) {
    return <div>Provide a collection ID to get started</div>;
  }

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {!!error && <p style={{ color: 'red' }}>{error}</p>}
        {!bids?.length ? (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <p>No active bids found</p>
          </div>
        ) : (
          bids.map((bid) => (
            <div
              key={bid.id}
              style={{
                border: '1px solid #e9ecef',
                borderRadius: '8px',
                padding: '16px',
                backgroundColor: 'white',
                cursor: 'pointer',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <p style={{ fontWeight: 500 }}>Bid #{bid.id}</p>
                {/* @ts-ignore */}
                <Button
                  size={BUTTON_SIZE.small}
                  color={BUTTON_COLOR.white}
                  bgColor={BUTTON_BG_COLOR.primary}
                  label='View Bid'
                  onClick={() => setSelectedBid(bid)}
                />
              </div>
              <p style={{ fontWeight: 400, padding: 0, margin: 0, fontSize: 12 }}>Did: {bid.did}</p>
              <p style={{ fontWeight: 400, padding: 0, margin: 0, fontSize: 12 }}>Role: {bid.role}</p>
              <p style={{ fontWeight: 400, padding: 0, margin: 0, fontSize: 12 }}>Date: {bid.created}</p>
            </div>
          ))
        )}
      </div>

      {/* Bid Details Modal */}
      {selectedBid && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setSelectedBid(undefined)}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '8px',
              padding: '24px',
              maxWidth: '800px',
              width: '90%',
              maxHeight: '90vh',
              overflow: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '20px',
              }}
            >
              <h3 style={{ margin: 0 }}>Bid Details #{selectedBid.id}</h3>
              <button
                onClick={() => setSelectedBid(undefined)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '20px',
                  cursor: 'pointer',
                  padding: '4px',
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <p style={{ fontWeight: 500, marginBottom: '4px' }}>Collection</p>
                <p style={{ margin: 0, color: '#495057' }}>{selectedBid.collection}</p>
              </div>

              <div>
                <p style={{ fontWeight: 500, marginBottom: '4px' }}>DID</p>
                <p style={{ margin: 0, color: '#495057' }}>{selectedBid.did}</p>
              </div>

              <div>
                <p style={{ fontWeight: 500, marginBottom: '4px' }}>Address</p>
                <p style={{ margin: 0, color: '#495057' }}>{selectedBid.address}</p>
              </div>

              <div>
                <p style={{ fontWeight: 500, marginBottom: '4px' }}>Role</p>
                <p style={{ margin: 0, color: '#495057' }}>{selectedBid.role}</p>
              </div>

              <div>
                <p style={{ fontWeight: 500, marginBottom: '4px' }}>Created</p>
                <p style={{ margin: 0, color: '#495057' }}>{new Date(selectedBid.created).toLocaleString()}</p>
              </div>

              <div>
                <p style={{ fontWeight: 500, marginBottom: '4px' }}>Bid Data</p>
                <pre
                  style={{
                    backgroundColor: '#f8f9fa',
                    padding: '12px',
                    borderRadius: '4px',
                    overflow: 'auto',
                    margin: 0,
                    fontSize: '14px',
                  }}
                >
                  {JSON.stringify(
                    typeof selectedBid.data === 'string' ? JSON.parse(selectedBid.data) : selectedBid.data,
                    null,
                    2,
                  )}
                </pre>
              </div>
            </div>

            {(selectedBid.role === 'SA' || selectedBid.role === 'EA') && (
              <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
                {/* @ts-ignore */}
                <Button
                  size={BUTTON_SIZE.medium}
                  color={BUTTON_COLOR.primary}
                  bgColor={BUTTON_BG_COLOR.white}
                  label='Approve'
                  onClick={handleApproveBid}
                />
                {/* @ts-ignore */}
                <Button
                  size={BUTTON_SIZE.medium}
                  color={BUTTON_COLOR.primary}
                  bgColor={BUTTON_BG_COLOR.white}
                  label='Reject'
                  onClick={handleRejectBid}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
