import { useRef, useState } from 'react';
import { utils } from '@ixo/impactxclient-sdk';

import Button, { BUTTON_BG_COLOR, BUTTON_COLOR, BUTTON_SIZE } from '@components/Button/Button';
import { BLOCKSYNC_URL } from '@constants/common';
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

enum STEPS {
  loading = 0,
  passkey = 1,
  address = 2,
  pin = 3,
}

const STEPS_STATE = [STEPS.loading, STEPS.passkey, STEPS.address, STEPS.pin];

type LoginProps = {
  onBack: () => void;
  onLogin: (response: { credentialId: string; address: string; did: string; authenticatorId?: string }) => void;
};

type AddressData = {
  address: string;
  id?: string;
};

function LoginPasskey({ onLogin, onBack }: LoginProps) {
  const { step, reset, goTo } = useSteps(STEPS_STATE, STEPS.passkey);

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
  const stepIsPasskey = step === STEPS.passkey;
  const stepIsAddress = step === STEPS.address;
  const stepIsPin = step === STEPS.pin;

  function handleBack() {
    if (stepIsPasskey) {
      onBack();
    } else if (stepIsAddress) {
      goTo(STEPS.passkey);
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

  async function fetchAddresses(keyId: string) {
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
    console.log({ BLOCKSYNC_URL, addresses });

    if (addresses.length === 1) {
      setSelectedAddress(addresses[0].address);
    }
  }

  async function handleInitialChallenge() {
    goTo(STEPS.loading);
    setError('');

    try {
      // Get initial challenge
      const authOptions = await fetch('/api/auth/initial-challenge').then((r) => r.json());
      console.log({ authOptions });

      const publicKeyOptions: PublicKeyCredentialRequestOptions = {
        ...authOptions,
        challenge: base64urlDecode(authOptions.challenge),
      };

      // Step 3: Use navigator.credentials.get() to get passkey assertion
      const assertion: any = await navigator.credentials.get({ publicKey: publicKeyOptions });
      if (!assertion) {
        throw new Error('Credential assertion failed');
      }
      console.log({ assertion });

      // Skip authn verification as we only care to get the keyId
      const newKeyId = assertion.id;
      setKeyId(newKeyId);
      setAssertion(assertion);

      await fetchAddresses(newKeyId);
      goTo(STEPS.address);
    } catch (err: any) {
      setError(err.message || 'Failed to verify passkey');
      goTo(STEPS.passkey);
    }
  }

  async function handleFinalAuthentication() {
    goTo(STEPS.loading);
    setError('');

    try {
      if (!selectedAddress) {
        setError('Please select an address');
        return;
      }
      const address = selectedAddress;
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
        ...assertion,
        response: {
          ...assertion.response,
          clientDataJSON: base64urlEncode(assertion.response.clientDataJSON),
          authenticatorData: base64urlEncode(assertion.response.authenticatorData),
          signature: base64urlEncode(assertion.response.signature),
        },
      };

      // prepare assertion for request to server
      const { encryptedMnemonic, roomId } = await loginPasskey({
        address: selectedAddress,
        authnResult: parsedAssertion,
      });
      if (!encryptedMnemonic) {
        setError('Failed to login with passkey.');
        return;
      }

      const pin = (await requestPin(encryptedMnemonic)) as string;

      // Find the authenticatorId for the selected address
      const selectedAddressData = addresses.find((addr) => addr.address === selectedAddress);
      const authenticatorId = selectedAddressData?.id;

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
      console.log('mxLogin', account);
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
      onLogin({
        credentialId: keyId,
        authenticatorId,
        address: address,
        did: did,
      });
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
            border: '1px solid #e9ecef',
            borderRadius: '8px',
            padding: '24px',
            backgroundColor: 'white',
          }}
        >
          <h2
            style={{
              textAlign: 'center',
              marginBottom: '16px',
            }}
          >
            Login with Passkey
          </h2>

          {stepIsLoading ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                height: '100%',
              }}
            >
              {/* @ts-ignore */}
              <Loader />
              <p style={{ marginLeft: '16px' }}>Loading...</p>
            </div>
          ) : stepIsPasskey ? (
            <>
              <p
                style={{
                  marginBottom: '16px',
                }}
              >
                Click below to login with your passkey
              </p>

              {error && (
                <p
                  style={{
                    color: 'red',
                    marginBottom: '20px',
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
                  onClick={handleInitialChallenge}
                  label='Next'
                  color={BUTTON_COLOR.white}
                  size={BUTTON_SIZE.mediumLarge}
                  bgColor={BUTTON_BG_COLOR.primary}
                />
              </div>
            </>
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
                  onClick={handleFinalAuthentication}
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
