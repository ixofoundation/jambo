import { useState, useRef, useEffect } from 'react';
import { GrantAuthorization } from '@ixo/impactxclient-sdk/types/codegen/cosmos/authz/v1beta1/authz';
import { DeliverTxResponse } from '@cosmjs/stargate';
import { cosmos, createQueryClient, ixo } from '@ixo/impactxclient-sdk';

import Button, { BUTTON_BG_COLOR, BUTTON_BORDER_COLOR, BUTTON_COLOR, BUTTON_SIZE } from '@components/Button/Button';
import { secret } from '@utils/secrets';
import { fetchCollectionByCollectionId } from '@utils/claims';
import MyBids from '@components/MyBids/MyBids';
import CollectionBids from '@components/CollectionBids/CollectionBids';
import MyClaims from '@components/MyClaims/MyClaims';
import { logoutMatrixClient } from '@utils/matrix';
import CollectionClaims from '@components/CollectionClaims/CollectionClaims';
import { BLOCKSYNC_URL, CHAIN_RPC_URL } from '@constants/common';
import { TRANSACTION_TYPES } from '@constants/transaction';
import { fetchProtocolEntity } from '@utils/entity';
import gqlQuery from '@utils/graphql';
import { signXDataPass } from '@utils/signX';
import { delay } from '@utils/timestamp';

interface EditAccountModalProps {
  did: string;
  address: string;
  method: 'signx' | 'mnemonic' | 'passkey';
  onClose: () => void;
  onSign: (messages: any[]) => Promise<DeliverTxResponse>;
  onAuthenticate: () => Promise<{ type: string; data: Uint8Array }>;
}

export default function EditAccountModal({
  did,
  address,
  method,
  onClose,
  onSign,
  onAuthenticate,
}: EditAccountModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authenticators, setAuthenticators] = useState<any | undefined>();

  useEffect(
    function () {
      fetchSmartAccountAuthenticators();
    },
    [address],
  );

  async function fetchSmartAccountAuthenticators() {
    console.log(BLOCKSYNC_URL);

    const query = `
    	query GetAuthenticators {
    		smartAccountAuthenticators(
    			filter: {
    				address: { equalTo: "${address}" }
    			}
    		) {
    			nodes {
    				address
            config
            createdAt
    				id
            keyId
            type
    			}
    		}
    	}
    `;
    try {
      const result = await gqlQuery<any>(BLOCKSYNC_URL, query);
      const authenticators = result.data?.data?.smartAccountAuthenticators?.nodes || [];
      console.log('authenticators', authenticators);
      setAuthenticators(authenticators);
    } catch (err) {
      console.error('Error fetching addresses:', err);
      return undefined;
    }
  }

  async function handleAddAuthenticator() {
    try {
      setLoading(true);
      setError(null);
      const response = await signXDataPass(
        {
          target: 'client',
          address,
          did,
        },
        'linkPubKey',
      );
      console.log('response', response);
      const responseData = response.response.data;
      const authenticatorType = responseData?.type;
      const authenticatorData = new Uint8Array(Buffer.from(responseData?.pubkey, 'hex'));
      console.log('authenticatorData', authenticatorData);
      const message = {
        typeUrl: '/ixo.smartaccount.v1beta1.MsgAddAuthenticator',
        value: ixo.smartaccount.v1beta1.MsgAddAuthenticator.fromPartial({
          sender: address,
          authenticatorType: authenticatorType,
          data: authenticatorData,
        }),
      };
      console.log('message', message);
      const result = await onSign([message]);
      console.log('result', result);
      fetchSmartAccountAuthenticators();
    } catch (err) {
      console.error('Error adding authenticator:', err);
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleLinkToAnotherAccount() {
    try {
      setLoading(true);
      setError(null);
      const { type, data } = await onAuthenticate();
      const authenticatorType = type;
      console.log('authenticatorType', authenticatorType);
      const authenticatorData = data;
      console.log('authenticatorData', authenticatorData);
      const response = await signXDataPass(
        {
          target: 'mobile',
          type: authenticatorType,
          data: authenticatorData,
        },
        'linkPubKey',
      );
      console.log('response', response);
      const responseData = response.response.data;
      console.log('responseData', responseData);
      const address = responseData?.address;
      const did = responseData?.did;

      // start polling
    } catch (err) {
      console.error('Error adding authenticator:', err);
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleTransactionTest() {
    try {
      const message = {
        typeUrl: '/cosmos.bank.v1beta1.MsgSend',
        value: cosmos.bank.v1beta1.MsgSend.fromPartial({
          fromAddress: address,
          toAddress: address,
          amount: [
            {
              denom: 'uixo',
              amount: '100000',
            },
          ],
        }),
      };
      const result = await onSign([message]);
      console.log('result', result);
      const message2 = {
        typeUrl: '/cosmos.bank.v1beta1.MsgSend',
        value: cosmos.bank.v1beta1.MsgSend.fromPartial({
          fromAddress: address,
          toAddress: address,
          amount: [
            {
              denom: 'uixo',
              amount: '200000',
            },
          ],
        }),
      };
      const result2 = await onSign([message2]);
      console.log('result2', result2);
      const message3 = {
        typeUrl: '/cosmos.bank.v1beta1.MsgSend',
        value: cosmos.bank.v1beta1.MsgSend.fromPartial({
          fromAddress: address,
          toAddress: address,
          amount: [
            {
              denom: 'uixo',
              amount: '300000',
            },
          ],
        }),
      };
      await delay(5000);
      const result3 = await onSign([message3]);
      console.log('result3', result3);
    } catch (error) {
      console.error(error);
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        padding: 20,
        alignItems: 'center',
        justifyContent: 'center',
        display: 'flex',
      }}
    >
      <div
        style={{
          backgroundColor: 'white',
          maxWidth: '768px',
          width: '98%',
          margin: '0 auto',
          padding: '20px',
          borderRadius: 10,
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #e9ecef',
          }}
        >
          <p style={{ fontWeight: 500, fontSize: 20 }}>
            {address} ({method})
          </p>
          <div
            onClick={loading ? () => {} : onClose}
            style={{ fontSize: 20, fontWeight: 600, cursor: 'pointer', padding: '10px' }}
          >
            x
          </div>
        </div>
        <div
          style={{
            paddingBottom: '20px',
          }}
        >
          {method === 'signx' && (
            <p style={{ fontWeight: 500 }} onClick={handleTransactionTest}>
              Transaction Test
            </p>
          )}
          {!authenticators?.length ? (
            <p style={{ fontWeight: 500 }}>Not a Smart Account</p>
          ) : (
            <>
              <p style={{ fontWeight: 500 }}>Smart Account Authenticators</p>
              <div>
                {authenticators?.map((authenticator: any) => (
                  <div
                    key={authenticator.id}
                    style={{ padding: '16px', marginBottom: '5px', borderRadius: 20, border: '1px solid #e9ecef' }}
                  >
                    {authenticator.keyId}
                    <span
                      style={{
                        marginLeft: '5px',
                        fontSize: '.8rem',
                        backgroundColor:
                          authenticator.type === 'SignatureVerification'
                            ? 'var(--secondary-color)'
                            : authenticator.type === 'AuthnVerification'
                            ? 'var(--tertiary-color)'
                            : 'var(--error-color)',
                        color: '#FFF',
                        padding: '2px 5px',
                        borderRadius: 5,
                        fontWeight: 500,
                      }}
                    >
                      {authenticator.type === 'SignatureVerification'
                        ? 'Signature'
                        : authenticator.type === 'AuthnVerification'
                        ? 'Authn'
                        : 'Pubkey'}
                    </span>
                    <div style={{ fontSize: '.8rem', color: 'var(--grey-color)', marginTop: '5px' }}>
                      Created {authenticator.createdAt}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {!!error && <div style={{ color: 'var(--error-color)', marginBottom: '10px' }}>{error}</div>}

        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'flex-end',
          }}
        >
          {/* @ts-ignore */}
          <Button
            label={'Link to Another Account'}
            disabled={loading}
            color={BUTTON_COLOR.white}
            bgColor={BUTTON_BG_COLOR.primary}
            size={BUTTON_SIZE.medium}
            onClick={handleLinkToAnotherAccount}
          />
          {/* @ts-ignore */}
          <Button
            label={'Add Authenticator'}
            disabled={loading}
            color={BUTTON_COLOR.white}
            bgColor={BUTTON_BG_COLOR.primary}
            size={BUTTON_SIZE.medium}
            onClick={handleAddAuthenticator}
          />
        </div>
      </div>
    </div>
  );
}

// ixo13vrv65emgwqsum9npwmj9ugq02k0pq4vqhsz4h;
