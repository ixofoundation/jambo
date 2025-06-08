import { useState, useRef, useEffect, useMemo } from 'react';
import { createMatrixBidBotClient } from '@ixo/matrixclient-sdk';
import { DeliverTxResponse } from '@cosmjs/stargate';
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

interface MyBidsProps {
  did: string;
  address: string;
  collectionId: string;
  onSign: (messages: any[]) => Promise<DeliverTxResponse>;
}

type MatrixBidBotClient = ReturnType<typeof createMatrixBidBotClient>;

export default function MyBids({ did, address, collectionId }: MyBidsProps) {
  const [bids, setBids] = useState<Bid[]>([]);
  const [selectedRole, setSelectedRole] = useState<'SA' | 'EA' | undefined>('SA');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [surveyTemplate, setSurveyTemplate] = useState<string | undefined>();
  const [selectedBid, setSelectedBid] = useState<Bid | undefined>();
  const bidBotClientRef = useRef<MatrixBidBotClient>();
  const fetchMyBidsRef = useRef<string | undefined>();
  const selectedRoleRef = useRef<'SA' | 'EA' | undefined>(undefined);

  useEffect(
    function () {
      if (did && address && collectionId) {
        fetchMyBids();
      }
    },
    [did, address, collectionId],
  );

  function setRole(role: 'SA' | 'EA') {
    console.log('setRole::', role, selectedRole);
    selectedRoleRef.current = role;
    setSelectedRole(role);
  }

  const survey = useMemo(
    function () {
      if (!surveyTemplate) {
        return undefined;
      }

      const surveyTemplateData = JSON.parse(surveyTemplate);
      const survey = new Model(surveyTemplateData?.question);
      survey.applyTheme(themeJson);
      survey.allowCompleteSurveyAutomatic = false;

      function preventComplete(sender: any, options: any) {
        options.allowComplete = false;
        postResults(sender);
      }

      async function postResults(sender: any) {
        survey.onCompleting.remove(preventComplete);

        survey.completeText = 'Submitting...';
        const bidBotClient = getBidBotClient();
        try {
          const response = await bidBotClient.bid.v1beta1.submitBid(
            collectionId,
            JSON.stringify(sender.data),
            selectedRoleRef.current ?? 'SA',
          );
          if (!response.id) {
            throw new Error('Failed to submit bid');
          }
          sender.doComplete();
          setSurveyTemplate(undefined);
          setRole('SA');
          fetchMyBids();
        } catch (err) {
          alert((err as Error).message);
          survey.completeText = 'Try again';
          survey.onCompleting.add(preventComplete);
        }
      }

      survey.onCompleting.add(preventComplete);
      survey.completeText = 'Submit';

      return survey;
    },
    [did, surveyTemplate, bidBotClientRef.current?.bid],
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

  async function fetchMyBids() {
    const key = `${collectionId}@${did}`;
    if (fetchMyBidsRef.current === key) {
      return;
    }
    fetchMyBidsRef.current = key;
    try {
      setLoading(true);
      setError(null);
      const client = getBidBotClient();
      const bidsResponse = await client.bid.v1beta1.queryBidsByDid(collectionId, did);
      setBids(bidsResponse.data);
    } catch (err) {
      console.error('fetchMyBids::', err);
      setError((err as Error).message);
    } finally {
      setLoading(false);
      fetchMyBidsRef.current = undefined;
    }
  }

  async function handleNewBidPress() {
    try {
      if (!collectionId) {
        throw new Error('Collection ID is required');
      }
      const collection = await fetchCollectionByCollectionId(collectionId);
      const offerEntities = await fetchProtocolEntity(collection.protocol);
      const formServiceEndpoints = []
        .concat(offerEntities)
        // @ts-ignore
        .filter((e) => e?.linkedResource?.find((r: any) => r?.id?.includes('#surveyTemplate'))?.serviceEndpoint);
      const formResponses = await Promise.allSettled(
        formServiceEndpoints.map((e) =>
          getAdditionalInfo(
            getServiceEndpoint(
              // @ts-ignore
              e?.linkedResource?.find((r: any) => r?.id?.includes('#surveyTemplate')).serviceEndpoint,
              // @ts-ignore
              e.service,
            ),
          ),
        ),
      );
      const forms = formResponses.reduce((acc, response, index) => {
        if (response.status !== 'fulfilled') {
          return acc;
        }
        // @ts-ignore
        const key = formServiceEndpoints[index].linkedResource.find((r: any) =>
          r?.id?.includes('#surveyTemplate'),
        ).serviceEndpoint;
        return { ...acc, [key]: JSON.stringify(response.value) };
      }, {});
      setSurveyTemplate(Object.entries(forms)[0][1] as string);
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
        {!bids?.length ? (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <p>No bids found</p>
            {/* @ts-ignore */}
            <Button
              size={BUTTON_SIZE.medium}
              color={BUTTON_COLOR.white}
              bgColor={BUTTON_BG_COLOR.primary}
              label='New Bid'
              onClick={handleNewBidPress}
            />
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
              <p style={{ fontWeight: 400, padding: 0, margin: 0, fontSize: 12 }}>Role: {bid.role}</p>
              <p style={{ fontWeight: 400, padding: 0, margin: 0, fontSize: 12 }}>Date: {bid.created}</p>
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
              <h3 style={{ margin: 0 }}>New Bid (Claim Collection {collectionId})</h3>
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

            <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'flex-end' }}>
              {/* @ts-ignore */}
              <Button
                size={BUTTON_SIZE.medium}
                color={selectedRoleRef.current === 'SA' ? BUTTON_COLOR.white : BUTTON_COLOR.primary}
                bgColor={selectedRoleRef.current === 'SA' ? BUTTON_BG_COLOR.primary : BUTTON_BG_COLOR.white}
                label='Apply as Service Agent'
                onClick={function () {
                  setRole('SA');
                }}
              />
              {/* @ts-ignore */}
              <Button
                size={BUTTON_SIZE.medium}
                color={selectedRoleRef.current === 'EA' ? BUTTON_COLOR.white : BUTTON_COLOR.primary}
                bgColor={selectedRoleRef.current === 'EA' ? BUTTON_BG_COLOR.primary : BUTTON_BG_COLOR.white}
                label='Apply as Evaluation Agent'
                onClick={function () {
                  setRole('EA');
                }}
              />
            </div>
          </div>
        </div>
      )}

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

            <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
              {/* @ts-ignore */}
              <Button
                size={BUTTON_SIZE.medium}
                color={BUTTON_COLOR.primary}
                bgColor={BUTTON_BG_COLOR.white}
                label='Close'
                onClick={() => setSelectedBid(undefined)}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
