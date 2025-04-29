import { useState, useRef, useEffect } from 'react';
import { createMatrixClaimBotClient } from '@ixo/matrixclient-sdk';
import { cosmos, ixo } from '@ixo/impactxclient-sdk';
import { DeliverTxResponse } from '@cosmjs/stargate';
import 'survey-core/defaultV2.min.css';
import 'survey-core/themes/borderless-dark';

import Button, { BUTTON_BG_COLOR, BUTTON_COLOR, BUTTON_SIZE } from '@components/Button/Button';
import { secret } from '@utils/secrets';
import gqlQuery from '@utils/graphql';
import { BLOCKSYNC_URL } from '@constants/common';
import { fetchCollectionByCollectionId } from '@utils/claims';

interface Claim {
  agentAddress: string;
  agentDid: string;
  claimId: string;
  collectionId: string;
  paymentsStatus: any;
  schemaType: string;
  submissionDate: string;
}
interface ClaimWithData extends Claim {
  data?: any;
  error?: string;
}

interface CollectionClaimsProps {
  did: string;
  address: string;
  collectionId: string;
  onSign: (messages: any[]) => Promise<DeliverTxResponse>;
}

type MatrixClaimBotClient = ReturnType<typeof createMatrixClaimBotClient>;

export default function CollectionClaims({ did, address, collectionId, onSign }: CollectionClaimsProps) {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedClaim, setSelectedClaim] = useState<ClaimWithData | undefined>();

  const claimBotClientRef = useRef<MatrixClaimBotClient>();
  const fetchCollectionClaimsRef = useRef<string | undefined>();

  useEffect(
    function () {
      if (did && address && collectionId) {
        fetchCollectionClaims();
      }
    },
    [did, address, collectionId],
  );

  function getClaimBotClient() {
    if (claimBotClientRef.current?.claim) {
      return claimBotClientRef.current;
    }
    claimBotClientRef.current = createMatrixClaimBotClient({
      botUrl: process.env.NEXT_PUBLIC_MATRIX_CLAIM_BOT_URL!,
      accessToken: secret.accessToken as string,
    });
    return claimBotClientRef.current;
  }

  async function fetchCollectionClaims() {
    const key = `${collectionId}@${did}`;
    if (fetchCollectionClaimsRef.current === key) {
      return;
    }
    fetchCollectionClaimsRef.current = key;
    try {
      setLoading(true);
      setError(null);
      const query = `
        query GetClaims {
          claims(filter: { collectionId: { equalTo: "${collectionId}" } }) {
            nodes {
              agentAddress
              agentDid
              claimId
              collectionId
              paymentsStatus
              schemaType
              submissionDate
            }
          }
        }
      `;
      const result = await gqlQuery<any>(BLOCKSYNC_URL, query);
      const claims = result.data?.data?.claims?.nodes || [];
      setClaims(claims);
    } catch (err) {
      console.error('fetchCollectionClaims::', err);
      setError((err as Error).message);
    } finally {
      setLoading(false);
      fetchCollectionClaimsRef.current = undefined;
    }
  }

  async function selectClaim(claim: Claim) {
    try {
      setSelectedClaim(claim);
      const client = getClaimBotClient();
      const response = await client.claim.v1beta1.queryClaim(collectionId, claim.claimId);
      // @ts-ignore
      setSelectedClaim((prevState) => ({ ...prevState, data: response }));
    } catch (err) {
      // @ts-ignore
      setSelectedClaim((prevState) => ({ ...prevState, error: (err as Error)?.message }));
    }
  }

  async function handleApproveClaim() {
    try {
      if (!selectedClaim) {
        throw new Error('No bid selected to evaluate');
      }
      const collection = await fetchCollectionByCollectionId(collectionId);
      const evaluation = ixo.claims.v1beta1.MsgEvaluateClaim.fromPartial({
        adminAddress: collection.admin,
        agentAddress: selectedClaim.agentAddress,
        agentDid: selectedClaim.agentDid,
        oracle: did,
        claimId: selectedClaim.claimId,
        collectionId: selectedClaim.collectionId,
        status: ixo.claims.v1beta1.EvaluationStatus.APPROVED,
        reason: 1,
        verificationProof: 'cid of verificationProof',
        // if want to do custom amount, must be within allowed authz if through authz
        // amount: customAmount,
        // cw20Payment: customCW20Payment,
      });
      const message = {
        typeUrl: '/cosmos.authz.v1beta1.MsgExec',
        value: cosmos.authz.v1beta1.MsgExec.fromPartial({
          grantee: address,
          msgs: [
            {
              typeUrl: '/ixo.claims.v1beta1.MsgEvaluateClaim',
              value: ixo.claims.v1beta1.MsgEvaluateClaim.encode(evaluation).finish(),
            },
          ],
        }),
      };
      const trxResponse = await onSign([message]);
      console.log('trxResponse', trxResponse);
      setSelectedClaim(undefined);
      fetchCollectionClaims();
      fetchCollectionClaims();
    } catch (err) {
      console.error(err);
      setError((err as Error).message);
    }
  }

  async function handleRejectClaim() {
    try {
      if (!selectedClaim) {
        throw new Error('No claim selected to evaluate');
      }
      const collection = await fetchCollectionByCollectionId(collectionId);
      const evaluation = ixo.claims.v1beta1.MsgEvaluateClaim.fromPartial({
        adminAddress: collection.admin,
        agentAddress: selectedClaim.agentAddress,
        agentDid: selectedClaim.agentDid,
        oracle: did,
        claimId: selectedClaim.claimId,
        collectionId: selectedClaim.collectionId,
        status: ixo.claims.v1beta1.EvaluationStatus.REJECTED,
        reason: 1,
        verificationProof: 'cid of verificationProof',
        // if want to do custom amount, must be within allowed authz if through authz
        // amount: customAmount,
        // cw20Payment: customCW20Payment,
      });
      const message = {
        typeUrl: '/cosmos.authz.v1beta1.MsgExec',
        value: cosmos.authz.v1beta1.MsgExec.fromPartial({
          grantee: address,
          msgs: [
            {
              typeUrl: '/ixo.claims.v1beta1.MsgEvaluateClaim',
              value: ixo.claims.v1beta1.MsgEvaluateClaim.encode(evaluation).finish(),
            },
          ],
        }),
      };
      const trxResponse = await onSign([message]);
      console.log('trxResponse', trxResponse);
      setSelectedClaim(undefined);
      fetchCollectionClaims();
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
        {!claims?.length ? (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <p>No active claims found</p>
          </div>
        ) : (
          claims.map((claim) => (
            <div
              key={claim.claimId}
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
                <p style={{ fontWeight: 500 }}>Claim #{claim.claimId}</p>
                {/* @ts-ignore */}
                <Button
                  size={BUTTON_SIZE.small}
                  color={BUTTON_COLOR.white}
                  bgColor={BUTTON_BG_COLOR.primary}
                  label='View Claim'
                  onClick={() => selectClaim(claim)}
                />
              </div>
              <p style={{ fontWeight: 400, padding: 0, margin: 0, fontSize: 12 }}>DID: {claim.agentDid}</p>
              <p style={{ fontWeight: 400, padding: 0, margin: 0, fontSize: 12 }}>Date: {claim.submissionDate}</p>
            </div>
          ))
        )}
      </div>

      {/* Claim Details Modal */}
      {selectedClaim && (
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
          onClick={() => setSelectedClaim(undefined)}
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
              <h3 style={{ margin: 0 }}>Claim Details #{selectedClaim.claimId}</h3>
              <button
                onClick={() => setSelectedClaim(undefined)}
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
                <p style={{ margin: 0, color: '#495057' }}>{selectedClaim.collectionId}</p>
              </div>

              <div>
                <p style={{ fontWeight: 500, marginBottom: '4px' }}>DID</p>
                <p style={{ margin: 0, color: '#495057' }}>{selectedClaim.agentDid}</p>
              </div>

              <div>
                <p style={{ fontWeight: 500, marginBottom: '4px' }}>Address</p>
                <p style={{ margin: 0, color: '#495057' }}>{selectedClaim.agentAddress}</p>
              </div>

              <div>
                <p style={{ fontWeight: 500, marginBottom: '4px' }}>Payment Status</p>
                <p style={{ margin: 0, color: '#495057' }}>{JSON.stringify(selectedClaim.paymentsStatus)}</p>
              </div>

              <div>
                <p style={{ fontWeight: 500, marginBottom: '4px' }}>Schema Type</p>
                <p style={{ margin: 0, color: '#495057' }}>{JSON.stringify(selectedClaim.schemaType)}</p>
              </div>

              <div>
                <p style={{ fontWeight: 500, marginBottom: '4px' }}>Submission Date</p>
                <p style={{ margin: 0, color: '#495057' }}>{new Date(selectedClaim.submissionDate).toLocaleString()}</p>
              </div>

              <div>
                <p style={{ fontWeight: 500, marginBottom: '4px' }}>Claim Data</p>
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
                  {selectedClaim?.error ??
                    (selectedClaim?.data
                      ? JSON.stringify(
                          typeof selectedClaim.data === 'string' ? JSON.parse(selectedClaim.data) : selectedClaim.data,
                          null,
                          2,
                        )
                      : 'Loading...')}
                </pre>
              </div>
            </div>

            <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
              {/* @ts-ignore */}
              <Button
                size={BUTTON_SIZE.medium}
                color={BUTTON_COLOR.primary}
                bgColor={BUTTON_BG_COLOR.white}
                label='Approve'
                onClick={handleApproveClaim}
              />
              {/* @ts-ignore */}
              <Button
                size={BUTTON_SIZE.medium}
                color={BUTTON_COLOR.primary}
                bgColor={BUTTON_BG_COLOR.white}
                label='Reject'
                onClick={handleRejectClaim}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
