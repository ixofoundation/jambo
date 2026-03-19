import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { utils } from '@ixo/impactxclient-sdk';

import Button, { BUTTON_BG_COLOR, BUTTON_COLOR, BUTTON_SIZE } from '@components/Button/Button';
import { BLOCKSYNC_URL } from '@constants/common';
import config from '@constants/config.json';
import gqlQuery from '@utils/graphql';
import { base64urlDecode, base64urlEncode } from '@utils/encoding';
import { checkIidDocumentExists } from '@utils/did';
import { loginPasskey } from 'lib/authn/login';
import {
  createMatrixClient,
  generatePassphraseFromMnemonic,
  generatePasswordFromMnemonic,
  generateUsernameFromAddress,
  hasCrossSigningAccountData,
  logoutMatrixClient,
  mxLogin,
  setupCrossSigning,
} from '@utils/matrix';
import useSteps from '@hooks/useSteps';
import Loader from '@components/Loader/Loader';
import MatrixPinForm from '@components/MatrixPinForm/MatrixPinForm';
import { decrypt } from '@utils/encryption';
import { errorToast } from '@components/Toast/Toast';
import { delay } from '@utils/timestamp';
import { useAuth } from '@hooks/useAuth';

enum STEPS {
  loading = 0,
  address = 1,
  pin = 2,
}

const STEPS_STATE = [STEPS.loading, STEPS.address, STEPS.pin];

type AddressData = {
  address: string;
  id?: string;
};

function LoginPasskey() {
  const router = useRouter();
  const auth = useAuth();
  const { step, reset, goTo } = useSteps(STEPS_STATE, STEPS.loading);

  const [error, setError] = useState('');
  const [keyId, setKeyId] = useState('');
  const [assertion, setAssertion] = useState<any>(null);
  const [addresses, setAddresses] = useState<AddressData[]>([]);
  const [selectedAddress, setSelectedAddress] = useState('');

  const handlerRef = useRef<{
    resolve?: (value: any) => void;
    reject?: (reason: any) => void;
  }>({});
  const encryptedMnemonicRef = useRef<string | undefined>(undefined);

  const stepIsLoading = step === STEPS.loading;
  const stepIsAddress = step === STEPS.address;
  const stepIsPin = step === STEPS.pin;

  const initRef = useRef<boolean>(false);

  useEffect(() => {
    if (!initRef.current) {
      initRef.current = true;
      (async () => {
        goTo(STEPS.loading);
        setError('');

        try {
          await delay(200);
          // Get initial challenge
          const authOptions = await fetch('/api/auth/initial-challenge').then((r) => r.json());
          const publicKeyOptions: PublicKeyCredentialRequestOptions = {
            ...authOptions,
            challenge: base64urlDecode(authOptions.challenge),
          };

          // Step 3: Use navigator.credentials.get() to get passkey assertion
          const assertion: any = await navigator.credentials.get({ publicKey: publicKeyOptions });
          if (!assertion) {
            throw new Error('Credential assertion failed');
          }
          // Skip authn verification as we only care to get the keyId
          const newKeyId = assertion.id;
          setKeyId(newKeyId);
          setAssertion(assertion);

          const fetchedAddresses = await fetchAddresses(newKeyId);
          goTo(STEPS.address);
          if (fetchedAddresses.length === 1) {
            await delay(200);
            handleFinalAuthentication({
              address: fetchedAddresses[0].address,
              authenticatorId: fetchedAddresses[0].id,
              assertionData: assertion,
              keyIdData: newKeyId,
              addressesData: fetchedAddresses,
            });
          }
        } catch (err: any) {
          errorToast(err.message || 'Failed to verify passkey');
          setTimeout(() => router.push('/auth'), 1500);
        }
      })();
    }
  }, []);

  function handleBack() {
    if (stepIsAddress) {
      router.push('/auth');
    }
  }

  async function requestPin(encryptedMnemonic?: string) {
    encryptedMnemonicRef.current = undefined;
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
      encryptedMnemonicRef.current = encryptedMnemonic;
      goTo(STEPS.pin);
    });
  }

  async function fetchAddresses(keyId: string): Promise<AddressData[]> {
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

    const result = await gqlQuery<any>(BLOCKSYNC_URL, query);
    const addresses = result.data?.data?.smartAccountAuthenticators?.nodes || [];
    setAddresses(addresses);

    if (addresses.length === 1) {
      setSelectedAddress(addresses[0].address);
    }

    return addresses;
  }

  async function handleFinalAuthentication(overrides?: {
    address: string;
    authenticatorId?: string;
    assertionData: any;
    keyIdData: string;
    addressesData: AddressData[];
  }) {
    goTo(STEPS.loading);
    setError('');

    const resolvedAddress = overrides?.address || selectedAddress;
    const resolvedAssertion = overrides?.assertionData || assertion;
    const resolvedKeyId = overrides?.keyIdData || keyId;
    const resolvedAddresses = overrides?.addressesData || addresses;

    try {
      if (!resolvedAddress) {
        setError('Please select an address');
        return;
      }
      const address = resolvedAddress;
      const did = utils.did.generateSecpDid(address);

      // =================================================================================================
      // DID
      // =================================================================================================
      const didExists = await checkIidDocumentExists(did);
      if (!didExists) {
        throw new Error('Iid Document does not exist, please try another account.');
      }

      // =================================================================================================
      // MATRIX
      // =================================================================================================
      // prepare assertion for request to server
      const parsedAssertion = {
        id: resolvedAssertion.id,
        type: resolvedAssertion.type,
        rawId: base64urlEncode(resolvedAssertion.rawId),
        authenticatorAttachment: resolvedAssertion.authenticatorAttachment,
        response: {
          clientDataJSON: base64urlEncode(resolvedAssertion.response.clientDataJSON),
          authenticatorData: base64urlEncode(resolvedAssertion.response.authenticatorData),
          signature: base64urlEncode(resolvedAssertion.response.signature),
          userHandle: resolvedAssertion.response.userHandle
            ? base64urlEncode(resolvedAssertion.response.userHandle)
            : null, // userHandle might be null
        },
      };

      // prepare assertion for request to server
      const { encryptedMnemonic, roomId } = await loginPasskey({
        address: resolvedAddress,
        authnResult: parsedAssertion,
      });
      if (!encryptedMnemonic) {
        setError('Failed to login with passkey.');
        return;
      }

      const pin = (await requestPin(encryptedMnemonic)) as string;

      // Find the authenticatorId for the selected address
      const authenticatorId =
        overrides?.authenticatorId ?? resolvedAddresses.find((addr) => addr.address === resolvedAddress)?.id;

      const mxMnemonic = decrypt(encryptedMnemonic, pin);
      let homeServerUrl = process.env.NEXT_PUBLIC_MATRIX_HOMESERVER_URL as string;
      const mxUsername = generateUsernameFromAddress(address);
      const mxPassword = generatePasswordFromMnemonic(mxMnemonic);
      const mxPassphrase = generatePassphraseFromMnemonic(mxMnemonic);
      // login ONLY
      await logoutMatrixClient({ baseUrl: homeServerUrl });
      const account = await mxLogin({
        homeServerUrl: homeServerUrl,
        username: mxUsername,
        password: mxPassword,
      });
      if (!account?.accessToken) {
        throw new Error('Failed to login matrix account, please try again later.');
      }
      // setup matrix client
      const mxClient = await createMatrixClient();
      // cross signing
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

      // done: Pass the authenticatorId along with the other data
      auth.loginWithPasskey({
        credentialId: resolvedKeyId,
        authenticatorId,
        address: address,
        did: did,
      });
      const entityId: string | undefined = (config as any).entity;
      router.push(entityId ? `/entities/${encodeURIComponent(entityId)}` : '/');
    } catch (err: any) {
      setError(err.message || 'Login failed');
      clearState();
      goTo(STEPS.address);
    }
  }

  function clearState() {
    setKeyId('');
    setAssertion(null);
    setAddresses([]);
    setSelectedAddress('');
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
          <h1
            style={{
              textAlign: 'center',
              marginBottom: '16px',
              color: 'white',
            }}
          >
            Welcome
          </h1>

          {stepIsLoading ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                height: '100%',
                gap: '16px',
              }}
            >
              {/* @ts-ignore */}
              <Loader />
              <p style={{ marginLeft: '16px', color: 'white' }}>Authenticating with passkey...</p>
            </div>
          ) : stepIsAddress ? (
            <>
              <div style={{ marginBottom: '24px' }}>
                <p style={{ marginBottom: '12px' }}>Select your smart account address:</p>
                <div style={{ marginTop: '8px' }}>
                  {!addresses?.length ? (
                    <p style={{ color: 'red' }}>No addresses found for this passkey</p>
                  ) : (
                    addresses.map((addr) => (
                      <div key={addr.address} style={{ marginBottom: '8px' }}>
                        <label
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            cursor: 'pointer',
                            fontSize: 14,
                          }}
                        >
                          <input
                            type='radio'
                            name='address'
                            value={addr.address}
                            checked={selectedAddress === addr.address}
                            onChange={(e) => setSelectedAddress(e.target.value)}
                            style={{ marginRight: '8px' }}
                          />
                          {addr.address}
                        </label>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {error && (
                <p
                  style={{
                    color: 'red',
                    marginBottom: '16px',
                  }}
                >
                  {error}
                </p>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                {/* @ts-ignore */}
                <Button
                  label='Back'
                  color={BUTTON_COLOR.primary}
                  size={BUTTON_SIZE.mediumLarge}
                  bgColor={BUTTON_BG_COLOR.white}
                  onClick={handleBack}
                />
                {/* @ts-ignore */}
                <Button
                  onClick={() => {
                    void handleFinalAuthentication();
                  }}
                  disabled={!selectedAddress}
                  label='Next'
                  color={BUTTON_COLOR.white}
                  size={BUTTON_SIZE.mediumLarge}
                  bgColor={BUTTON_BG_COLOR.primary}
                />
              </div>
            </>
          ) : stepIsPin ? (
            // @ts-ignore
            <MatrixPinForm
              encryptedMnemonic={encryptedMnemonicRef.current}
              onSuccess={handlePinSuccess}
              onError={handlePinError}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default LoginPasskey;
