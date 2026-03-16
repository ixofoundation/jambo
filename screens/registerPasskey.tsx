import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { utils } from '@ixo/impactxclient-sdk';
import { createMatrixApiClient } from '@ixo/matrixclient-sdk';
import { OfflineSigner } from '@cosmjs/proto-signing';

import { getSecpClient, SecpClient } from '@utils/secp';
import gqlQuery from '@utils/graphql';
import { BLOCKSYNC_URL } from '@constants/common';
import config from '@constants/config.json';
import { checkAddressFeegrant } from '@utils/feegrant';
import { checkIidDocumentExists, createIidDocument } from '@utils/did';
import { registerPasskey } from 'lib/authn/register';
import { encrypt } from '@utils/encryption';
import { cleanUrlString } from '@utils/url';
import { delay } from '@utils/timestamp';
import { base64urlEncode, base64urlDecode } from '@utils/encoding';
import {
  checkIsUsernameAvailable,
  createMatrixClient,
  generatePassphraseFromMnemonic,
  generatePasswordFromMnemonic,
  generateUsernameFromAddress,
  generateUserRoomAliasFromAddress,
  hasCrossSigningAccountData,
  logoutMatrixClient,
  mxRegisterWithPasskey,
  setupCrossSigning,
  createUserCreationChallenge,
} from '@utils/matrix';
import useSteps from '@hooks/useSteps';
import Loader from '@components/Loader/Loader';
import EmailFeegrantForm from '@components/EmailFeegrantForm/EmailFeegrantForm';
import MatrixPinForm from '@components/MatrixPinForm/MatrixPinForm';
import { fido2 } from 'lib/authn/client';
import SecretPhraseStep from '@components/SecretPhraseStep/SecretPhraseStep';
import { useAuth } from '@hooks/useAuth';

enum STEPS {
  loading = 0,
  mnemonic = 1,
  feegrantCheck = 2,
  email = 3,
  pin = 4,
}

const STEPS_STATE = [STEPS.loading, STEPS.mnemonic, STEPS.feegrantCheck, STEPS.email, STEPS.pin];

function RegisterPasskey() {
  const router = useRouter();
  const auth = useAuth();
  const { step, reset, goTo } = useSteps(STEPS_STATE, STEPS.mnemonic);
  const [wallet, setWallet] = useState<SecpClient | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingMessage, setLoadingMessage] = useState('Loading...');

  useEffect(function () {
    if (!wallet) {
      (async function () {
        const mnemonic = utils.mnemonic.generateMnemonic();
        const newWallet = await getSecpClient(mnemonic);
        setWallet(newWallet);
      })();
    }
  }, []);

  const handlerRef = useRef<{
    resolve?: (value: any) => void;
    reject?: (reason: any) => void;
  }>({});
  const addressRef = useRef<string | undefined>(undefined);

  const stepIsLoading = step === STEPS.loading;
  const stepIsMnemonic = step === STEPS.mnemonic;
  const stepIsFeegrantCheck = step === STEPS.feegrantCheck;
  const stepIsPin = step === STEPS.pin;
  const stepIsEmail = step === STEPS.email;

  async function requestEmail(address: string) {
    addressRef.current = address;
    return new Promise(function (resolve, reject) {
      handlerRef.current = {
        resolve: function (value: any) {
          resolve(value);
          handlerRef.current = {};
        },
        reject: function (reason: any) {
          reject(reason);
          handlerRef.current = {};
        },
      };
      addressRef.current = address;
      goTo(STEPS.email);
    });
  }

  async function requestPin() {
    return new Promise(function (resolve, reject) {
      handlerRef.current = {
        resolve: function (value: any) {
          resolve(value);
          handlerRef.current = {};
        },
        reject: function (reason: any) {
          reject(reason);
          handlerRef.current = {};
        },
      };
      goTo(STEPS.pin);
    });
  }

  async function fetchAddressAuthenticator(keyId: string, address: string) {
    const query = `
    	query GetAuthenticators {
    		smartAccountAuthenticators(
    			filter: {
    				keyId: { equalTo: "${keyId}" }
    			}
    		) {
    			nodes {
    				address
    				id
    			}
    		}
    	}
    `;
    try {
      const result = await gqlQuery<any>(BLOCKSYNC_URL, query);
      const addresses = result.data?.data?.smartAccountAuthenticators?.nodes || [];
      return addresses.find((addr: any) => addr.address === address);
    } catch (err) {
      console.error('Error fetching addresses:', err);
      return undefined;
    }
  }

  async function handleRegister() {
    goTo(STEPS.feegrantCheck);
    try {
      if (!wallet?.baseAccount?.address) {
        throw new Error('No wallet found');
      }
      const address = wallet.baseAccount.address;
      // =================================================================================================
      // FEEGRANT (EMAIL OTP)
      // =================================================================================================
      const feegrant = await checkAddressFeegrant(address);
      if (!feegrant) {
        (await requestEmail(address)) as string;
        goTo(STEPS.feegrantCheck);
        const feegrant = await checkAddressFeegrant(address);
        if (!feegrant) {
          throw new Error('Failed to grant feegrant, please try again.');
        }
      }
      // =================================================================================================
      // PASSKEY / SMART ACC
      // =================================================================================================
      setLoadingMessage('Creating your passkey...');
      goTo(STEPS.loading);
      const { credentialId } = await registerPasskey({
        wallet: wallet,
      });
      await delay(1000);

      setLoadingMessage('Verifying passkey registration...');
      const authenticator = await fetchAddressAuthenticator(credentialId, wallet!.baseAccount.address);
      if (!authenticator) {
        throw new Error('Failed to register passkey, please try again.');
      }

      // =================================================================================================
      // DID
      // =================================================================================================
      const did = utils.did.generateSecpDid(address);
      const didExists = await checkIidDocumentExists(did);
      if (!didExists) {
        await createIidDocument(did, wallet as OfflineSigner);
        await delay(500);
        const didExists = await checkIidDocumentExists(did);
        if (!didExists) {
          throw new Error('Failed to create did, please try again.');
        }
      }

      // =================================================================================================
      // MATRIX
      // =================================================================================================
      setLoadingMessage('Generating Vault credentials...');
      const mxMnemonic = utils.mnemonic.generateMnemonic(12);
      let homeServerUrl = process.env.NEXT_PUBLIC_MATRIX_HOMESERVER_URL as string;
      const mxUsername = generateUsernameFromAddress(address);
      const mxPassword = generatePasswordFromMnemonic(mxMnemonic);
      const mxPassphrase = generatePassphraseFromMnemonic(mxMnemonic);
      let isUsernameAvailable = await checkIsUsernameAvailable({
        homeServerUrl: homeServerUrl,
        username: mxUsername,
      });
      if (!isUsernameAvailable) {
        throw new Error('Matrix account already exists, please try again.');
      }
      // clear any residual matrix data
      await logoutMatrixClient({ baseUrl: homeServerUrl });

      const options = await fido2.assertionOptions();
      // Create WebAuthn assertion for matrix user creation
      const { challenge, challengeBase64 } = createUserCreationChallenge(address);

      // Create assertion options for the challenge
      const publicKeyOptions: PublicKeyCredentialRequestOptions = {
        ...options,
        challenge: new TextEncoder().encode(JSON.stringify(challenge)),
        allowCredentials: [
          {
            type: 'public-key',
            id: base64urlDecode(credentialId),
          },
        ],
        userVerification: 'preferred',
      };

      // Get WebAuthn assertion for matrix account creation
      const assertion: any = await navigator.credentials.get({
        publicKey: publicKeyOptions,
      });

      if (!assertion) {
        throw new Error('Failed to create WebAuthn assertion for matrix account creation');
      }

      // Format assertion for API
      const authnResult = {
        ...assertion,
        id: assertion.id,
        response: {
          ...assertion.response,
          clientDataJSON: base64urlEncode(assertion.response.clientDataJSON),
          authenticatorData: base64urlEncode(assertion.response.authenticatorData),
          signature: base64urlEncode(assertion.response.signature),
        },
      };

      // register using new API
      setLoadingMessage('Creating Vault account...');
      const account = await mxRegisterWithPasskey(address, mxPassword, authnResult);
      if (!account?.accessToken) {
        throw new Error('Failed to register matrix account, please try again later.');
      }
      // setup matrix clients
      const mxClient = await createMatrixClient();
      const matrixApiClient = createMatrixApiClient({
        homeServerUrl: homeServerUrl,
        accessToken: account.accessToken as string,
      });
      // setup cross signing
      setLoadingMessage('Setting up Vault encryption...');
      let hasCrossSigning = hasCrossSigningAccountData(mxClient);
      if (!hasCrossSigning) {
        hasCrossSigning = await setupCrossSigning(mxClient, {
          securityPhrase: mxPassphrase,
          password: mxPassword,
          forceReset: true,
        });
        if (!hasCrossSigning) {
          throw new Error('Failed to setup cross signing, please try again.');
        }
      }
      // create room
      setLoadingMessage('Creating secure Vault room...');
      const mxRoomAlias = generateUserRoomAliasFromAddress(address, account.baseUrl);
      const queryIdResponse = await matrixApiClient.room.v1beta1.queryId(mxRoomAlias).catch(() => undefined);
      let roomId: string = queryIdResponse?.room_id ?? '';
      if (!roomId) {
        const response = await fetch(`${process.env.NEXT_PUBLIC_MATRIX_ROOM_BOT_URL}/room/source`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            did: did,
            userMatrixId: account.userId,
          }),
        });
        if (!response.ok) {
          throw new Error('Failed to create matrix room.');
        }
        const data = await response.json(); // { did: string; message: string; roomAlias: string; roomId: string; }
        roomId = data.roomId;
        if (!roomId) {
          throw new Error('Failed to create user matrix room.');
        }
      }

      // ensure room is joined
      let joinedMembers = await matrixApiClient.room.v1beta1.listJoinedMembers(roomId).catch(() => undefined);
      let joined = !!joinedMembers?.joined?.[account.userId];
      if (!joined) {
        const joinResponse = await matrixApiClient.room.v1beta1.join(roomId);
        if (!joinResponse.room_id) {
          throw new Error('Failed to join matrix room.');
        }
        joinedMembers = await matrixApiClient.room.v1beta1.listJoinedMembers(roomId);
        joined = !!joinedMembers?.joined?.[account.userId];
        if (!joined) {
          throw new Error('Failed to join matrix room.');
        }
      }

      const pin = (await requestPin()) as string;

      // encrypt and store matrix mnemonic
      setLoadingMessage('Configuring Vault encryption...');
      goTo(STEPS.loading);
      const encryptedMnemonic = encrypt(mxMnemonic, pin);
      const storeEncryptedMnemonicResponse = await fetch(
        cleanUrlString(`${homeServerUrl}/_matrix/client/r0/rooms/${roomId}/state/ixo.room.state.secure/encrypted_mnemonic`),
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${account.accessToken as string}`,
          },
          body: JSON.stringify({
            encrypted_mnemonic: encryptedMnemonic,
          }),
        },
      );
      if (!storeEncryptedMnemonicResponse.ok) {
        throw new Error('Failed to store encrypted mnemonic in matrix room.');
      }
      await storeEncryptedMnemonicResponse.json();
      // done
      auth.registerWithPasskey({
        credentialId,
        address: wallet!?.baseAccount?.address,
        did: utils.did.generateSecpDid(wallet!.baseAccount.address),
        authenticatorId: authenticator?.id,
      });
      const entityId: string | undefined = (config as any).entity;
      router.push(entityId ? `/entities/${encodeURIComponent(entityId)}` : '/');
    } catch (err: any) {
      console.error('Register error:', err);
      setError((typeof err === 'string' ? err : err.message) || 'Failed to register. Please try again.');
    } finally {
      goTo(STEPS.mnemonic);
    }
  }

  function handleEmailSuccess() {
    try {
      handlerRef.current?.resolve?.(true);
    } catch (error) {
      setError('Something went wrong. Please try again.');
      reset();
    }
  }

  function handleEmailError(error: string) {
    try {
      handlerRef.current?.reject?.(error);
    } catch (error) {
      setError('Something went wrong. Please try again.');
      reset();
    }
  }

  function handlePinSuccess(pin: string) {
    try {
      handlerRef.current?.resolve?.(pin);
    } catch (error) {
      setError('Something went wrong. Please try again.');
      reset();
    }
  }

  function handlePinError(error: string) {
    try {
      handlerRef.current?.reject?.(error);
    } catch (error) {
      setError('Something went wrong. Please try again.');
      reset();
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        padding: '20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '400px',
        }}
      >
        <div
          style={{
            borderRadius: '8px',
            padding: '24px',
            backgroundColor: 'rgba(0, 0, 0, 0.2)',
          }}
        >
          {stepIsLoading ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
                <div style={{ width: '28px' }} />
                <h1 style={{ flex: 1, textAlign: 'center', margin: 0, color: 'white', fontSize: '14px' }}>
                  Creating new account
                </h1>
                <div style={{ width: '28px' }} />
              </div>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center',
                  padding: '40px 0',
                }}
              >
                {/* @ts-ignore */}
                <Loader />
                <p style={{ marginTop: '16px', color: 'rgba(255,255,255,0.7)', fontSize: '14px' }}>
                  {loadingMessage}
                </p>
              </div>
            </>
          ) : stepIsMnemonic ? (
            <SecretPhraseStep
              mnemonic={wallet?.mnemonic ?? ''}
              error={error}
              onBack={() => router.push('/auth')}
              onContinue={handleRegister}
            />
          ) : stepIsFeegrantCheck ? (
            <>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
                <button
                  onClick={() => router.push('/auth')}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '4px',
                    fontSize: '20px',
                    lineHeight: 1,
                    color: 'white',
                  }}
                >
                  &#8592;
                </button>
                <h1 style={{ flex: 1, textAlign: 'center', margin: 0, color: 'white', fontSize: '14px' }}>
                  Creating new account
                </h1>
                <div style={{ width: '28px' }} />
              </div>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center',
                  padding: '40px 0',
                }}
              >
                {/* @ts-ignore */}
                <Loader />
                <p style={{ marginTop: '16px', color: 'rgba(255,255,255,0.7)', fontSize: '14px' }}>
                  Checking for feegrant...
                </p>
              </div>
            </>
          ) : stepIsEmail ? (
            // @ts-ignore
            <EmailFeegrantForm
              address={addressRef.current as string}
              onSuccess={handleEmailSuccess}
              onError={handleEmailError}
            />
          ) : stepIsPin ? (
            // @ts-ignore
            <MatrixPinForm onSuccess={handlePinSuccess} onError={handlePinError} />
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default RegisterPasskey;
