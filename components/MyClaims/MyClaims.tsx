import { useState, useRef, useEffect, useMemo } from 'react';
import { createMatrixClaimBotClient } from '@ixo/matrixclient-sdk';
import { DeliverTxResponse } from '@cosmjs/stargate';
import { cosmos, ixo } from '@ixo/impactxclient-sdk';
import { Model } from 'survey-core';
import { Survey } from 'survey-react-ui';
import 'survey-core/defaultV2.min.css';
import 'survey-core/themes/borderless-dark';

import Button, { BUTTON_BG_COLOR, BUTTON_COLOR, BUTTON_SIZE } from '@components/Button/Button';
import { secret } from '@utils/secrets';
import { fetchCollectionByCollectionId } from '@utils/claims';
import { fetchProtocolEntity } from '@utils/entity';
import { getAdditionalInfo, getServiceEndpoint } from '@utils/url';
import { themeJson } from '@constants/surveyTheme';
import gqlQuery from '@utils/graphql';
import { BLOCKSYNC_URL } from '@constants/common';

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

interface MyClaimsProps {
  did: string;
  address: string;
  collectionId: string;
  onSign: (messages: any[]) => Promise<DeliverTxResponse>;
}

type MatrixClaimBotClient = ReturnType<typeof createMatrixClaimBotClient>;

export default function MyClaims({ did, address, collectionId, onSign }: MyClaimsProps) {
  console.log('secret.accessToken', secret.accessToken);

  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [surveyTemplate, setSurveyTemplate] = useState<string | undefined>();
  const [selectedClaim, setSelectedClaim] = useState<ClaimWithData | undefined>();

  const claimBotClientRef = useRef<MatrixClaimBotClient>();
  const fetchMyClaimsRef = useRef<string | undefined>();

  useEffect(
    function () {
      if (did && address && collectionId) {
        fetchMyClaims();
      }
    },
    [did, address, collectionId],
  );

  const survey = useMemo(
    function () {
      if (!surveyTemplate) {
        return undefined;
      }

      const surveyTemplateData = JSON.parse(surveyTemplate);
      const survey = new Model(surveyTemplateData?.question ?? surveyTemplateData);
      survey.applyTheme(themeJson);
      survey.allowCompleteSurveyAutomatic = false;

      function preventComplete(sender: any, options: any) {
        options.allowComplete = false;
        postResults(sender);
      }

      async function postResults(sender: any) {
        survey.onCompleting.remove(preventComplete);

        survey.completeText = 'Submitting...';
        const claimBotClient = getClaimBotClient();
        try {
          const collection = await fetchCollectionByCollectionId(collectionId);
          const response = await claimBotClient.claim.v1beta1.saveClaim(collectionId, JSON.stringify(sender.data));
          console.log('response', response);
          if (!response.data.cid) {
            throw new Error('Failed to submit claim');
          }
          const value = {
            adminAddress: collection.admin as string,
            agentAddress: address as string,
            agentDid: did as string,
            claimId: response.data.cid as string,
            collectionId: collectionId as string,
            useIntent: false,
            amount: [],
            cw20Payment: [],
          };
          const message = {
            typeUrl: '/cosmos.authz.v1beta1.MsgExec',
            value: cosmos.authz.v1beta1.MsgExec.fromPartial({
              grantee: address,
              msgs: [
                {
                  typeUrl: '/ixo.claims.v1beta1.MsgSubmitClaim',
                  value: ixo.claims.v1beta1.MsgSubmitClaim.encode(value).finish(),
                },
              ] as any[],
            }),
          };
          const trxResponse = await onSign([message]);
          console.log('trxResponse', trxResponse);
          sender.doComplete();
          setSurveyTemplate(undefined);
          fetchMyClaims();
        } catch (err) {
          console.error('error', err);
          alert((err as Error).message);
          survey.completeText = 'Try again';
          survey.onCompleting.add(preventComplete);
        }
      }

      survey.onCompleting.add(preventComplete);
      survey.completeText = 'Submit';

      return survey;
    },
    [did, surveyTemplate, claimBotClientRef.current?.claim],
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

  async function fetchMyClaims() {
    const key = `${collectionId}@${did}`;
    if (fetchMyClaimsRef.current === key) {
      return;
    }
    fetchMyClaimsRef.current = key;
    try {
      setLoading(true);
      setError(null);
      const query = `
        query GetClaims {
          claims(filter: { collectionId: { equalTo: "${collectionId}" }, agentAddress: { equalTo: "${address}" } }) {
            nodes {
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
      console.error('fetchMyClaims::', err);
      setError((err as Error).message);
    } finally {
      setLoading(false);
      fetchMyClaimsRef.current = undefined;
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

  async function handleNewClaimPress() {
    try {
      console.log('handleNewClaimPress');
      if (!collectionId) {
        throw new Error('Collection ID is required');
      }
      const collection = await fetchCollectionByCollectionId(collectionId);
      const protocolEntity = await fetchProtocolEntity(collection.protocol);
      const formServiceEndpoints = [protocolEntity].filter(
        (e) =>
          e?.linkedResource?.find((r: any) => r?.id?.includes('#surveyTemplate') || r?.id?.includes('#vct'))
            ?.serviceEndpoint,
      );
      const formResponses = await Promise.allSettled(
        formServiceEndpoints.map((e) =>
          getAdditionalInfo(
            getServiceEndpoint(
              e?.linkedResource?.find((r: any) => r?.id?.includes('#surveyTemplate') || r?.id?.includes('#vct'))
                .serviceEndpoint,
              e.service,
            ),
          ),
        ),
      );
      const forms = formResponses.reduce((acc, response, index) => {
        if (response.status !== 'fulfilled') {
          return acc;
        }
        const key = formServiceEndpoints[index].linkedResource.find(
          (r: any) => r?.id?.includes('#surveyTemplate') || r?.id?.includes('#vct'),
        ).serviceEndpoint;
        return { ...acc, [key]: JSON.stringify(response.value) };
      }, {});
      setSurveyTemplate(Object.entries(forms)?.[0]?.[1] as string);
    } catch (err) {
      console.error(err);
      setError((err as Error)?.message);
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
        {/* @ts-ignore */}
        <Button
          size={BUTTON_SIZE.medium}
          color={BUTTON_COLOR.white}
          bgColor={BUTTON_BG_COLOR.primary}
          label='New Claim'
          onClick={handleNewClaimPress}
        />
        {!claims?.length ? (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <p>No claims found</p>
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

      {surveyTemplate && (
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
          onClick={() => setSurveyTemplate(undefined)}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '8px',
              padding: '24px',
              paddingBottom: '0',
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
              <h3 style={{ margin: 0 }}>New Claim (Claim Collection {collectionId})</h3>
              <button
                onClick={() => setSurveyTemplate(undefined)}
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

            {/* @ts-ignore */}
            <Survey model={survey} />
          </div>
        </div>
      )}

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
                <p style={{ fontWeight: 500, marginBottom: '4px' }}>Created</p>
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
                label='Close'
                onClick={() => setSelectedClaim(undefined)}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
