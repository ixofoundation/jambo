import { useState } from 'react';
import { utils } from '@ixo/impactxclient-sdk';

import Button, { BUTTON_BG_COLOR, BUTTON_COLOR, BUTTON_SIZE } from '@components/Button/Button';
import { BLOCKSYNC_URL } from '@constants/common';
import gqlQuery from '@utils/graphql';
import { base64urlDecode, base64urlEncode } from '@utils/encoding';
import { grantAddressFeegrantIfNotExists } from '@utils/feegrant';
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

type LoginProps = {
  onBack: () => void;
  onLogin: (response: { credentialId: string; address: string; did: string; authenticatorId?: string }) => void;
};

type AddressData = {
  address: string;
  id?: string;
};

function LoginPasskey({ onLogin, onBack }: LoginProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [keyId, setKeyId] = useState('');
  const [assertion, setAssertion] = useState<any>(null);
  const [addresses, setAddresses] = useState<AddressData[]>([]);
  const [selectedAddress, setSelectedAddress] = useState('');
  const [password, setPassword] = useState('');

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

    try {
      const result = await gqlQuery<any>(BLOCKSYNC_URL, query);
      const addresses = result.data?.data?.smartAccountAuthenticators?.nodes || [];
      setAddresses(addresses);
      console.log({ BLOCKSYNC_URL, addresses });

      if (addresses.length === 1) {
        setSelectedAddress(addresses[0].address);
      }
    } catch (err) {
      console.error('Error fetching addresses:', err);
      setError('Failed to fetch addresses');
    }
  }

  async function handleInitialChallenge() {
    setLoading(true);
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
    } catch (err: any) {
      setError(err.message || 'Failed to verify passkey');
    } finally {
      setLoading(false);
    }
  }

  async function handleFinalAuthentication() {
    setLoading(true);
    setError('');

    try {
      if (!selectedAddress) {
        setError('Please select an address');
        return;
      }
      if (!password || password.length < 6) {
        setError('Password must be at least 8 characters long');
        return;
      }
      const address = selectedAddress;
      const did = utils.did.generateSecpDid(address);

      // =================================================================================================
      // Feegrant
      // =================================================================================================
      const hasFeegrant = await grantAddressFeegrantIfNotExists({
        address: address,
      });
      if (!hasFeegrant) {
        throw new Error('Failed to grant your feegrant, please try again later.');
      }

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
      const loggedIn = await loginPasskey({
        address: selectedAddress,
        authnResult: parsedAssertion,
        password: password,
      });
      if (!loggedIn) {
        setError('Failed to login with passkey.');
        return;
      }

      // Find the authenticatorId for the selected address
      const selectedAddressData = addresses.find((addr) => addr.address === selectedAddress);
      const authenticatorId = selectedAddressData?.id;

      const mxMnemonic = loggedIn.mnemonic;
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
    } finally {
      setLoading(false);
    }
  }

  const clearState = () => {
    setKeyId('');
    setAssertion(null);
    setAddresses([]);
    setSelectedAddress('');
    setPassword('');
  };

  if (!keyId) {
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
            <p
              style={{
                marginBottom: '24px',
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
            {/* @ts-ignore */}
            <Button
              onClick={handleInitialChallenge}
              // loading={loading}
              disabled={loading}
              label='Load Passkey'
              color={BUTTON_COLOR.white}
              size={BUTTON_SIZE.mediumLarge}
              bgColor={BUTTON_BG_COLOR.primary}
            />
            <div style={{ marginTop: '16px' }} />
            {/* @ts-ignore */}
            <Button
              label='Back'
              color={BUTTON_COLOR.primary}
              size={BUTTON_SIZE.mediumLarge}
              bgColor={BUTTON_BG_COLOR.white}
              onClick={onBack}
              disabled={loading}
            />
          </div>
        </div>
      </div>
    );
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
          {addresses.length === 0 ? (
            <p style={{ color: 'red' }}>No addresses found for this passkey</p>
          ) : (
            <>
              <div style={{ marginBottom: '24px' }}>
                <p style={{ marginBottom: '12px' }}>Select your smart account address:</p>
                <div style={{ marginTop: '8px' }}>
                  {addresses.map((addr) => (
                    <div key={addr.address} style={{ marginBottom: '8px' }}>
                      <label
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          cursor: 'pointer',
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
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label
                  style={{
                    display: 'block',
                    marginBottom: '4px',
                    fontSize: '14px',
                  }}
                >
                  Mnemonic Decryption Password
                </label>
                <input
                  type='password'
                  placeholder='Enter your password'
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #ced4da',
                    borderRadius: '4px',
                    fontSize: '14px',
                  }}
                />
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

              {/* @ts-ignore */}
              <Button
                onClick={handleFinalAuthentication}
                disabled={loading || !selectedAddress || !password || password.length < 6}
                label='Login'
                color={BUTTON_COLOR.white}
                size={BUTTON_SIZE.mediumLarge}
                bgColor={BUTTON_BG_COLOR.primary}
              />
              <div style={{ marginTop: '16px' }} />
              {/* @ts-ignore */}
              <Button
                label='Back'
                color={BUTTON_COLOR.primary}
                size={BUTTON_SIZE.mediumLarge}
                bgColor={BUTTON_BG_COLOR.white}
                onClick={onBack}
                disabled={loading}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default LoginPasskey;
