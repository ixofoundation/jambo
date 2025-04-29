import { useEffect, useState } from 'react';
import { utils } from '@ixo/impactxclient-sdk';
import { createMatrixApiClient } from '@ixo/matrixclient-sdk';

import Button, { BUTTON_BG_COLOR, BUTTON_COLOR, BUTTON_SIZE } from '@components/Button/Button';
import { getSecpClient, SecpClient } from '@utils/secp';
import gqlQuery from '@utils/graphql';
import { BLOCKSYNC_URL } from '@constants/common';
import { grantAddressFeegrantIfNotExists } from '@utils/feegrant';
import { createIidDocumentIfNotExists } from '@utils/did';
import { registerPasskey } from 'lib/authn/register';
import { encrypt } from '@utils/encryption';
import { delay } from '@utils/timestamp';
import {
  checkIsUsernameAvailable,
  createMatrixClient,
  generatePassphraseFromMnemonic,
  generatePasswordFromMnemonic,
  generateUsernameFromAddress,
  generateUserRoomAliasFromAddress,
  hasCrossSigningAccountData,
  logoutMatrixClient,
  mxRegister,
  setupCrossSigning,
} from '@utils/matrix';

type Props = {
  onBack: () => void;
  onRegister: (response: { address: string; did: string; credentialId: string; authenticatorId?: string }) => void;
};

function RegisterPasskey({ onRegister, onBack }: Props) {
  const [loading, setLoading] = useState(false);
  const [wallet, setWallet] = useState<SecpClient | null>(null);
  const [password, setPassword] = useState('');

  useEffect(function () {
    (async function () {
      const mnemonic = utils.mnemonic.generateMnemonic();
      const newWallet = await getSecpClient(mnemonic);
      setWallet(newWallet);
    })();
  }, []);

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
    setLoading(true);
    try {
      if (!wallet?.baseAccount?.address) {
        throw new Error('No wallet found');
      }
      if (!password || password.length < 6) {
        throw new Error('Password must be at least 8 characters long');
      }
      const address = wallet.baseAccount.address;

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
      // PASSKEY / SMART ACC
      // =================================================================================================
      const { credentialId } = await registerPasskey({
        wallet: wallet,
      });
      await delay(1000);
      const authenticator = await fetchAddressAuthenticator(credentialId, wallet!.baseAccount.address);
      if (!authenticator) {
        throw new Error('Failed to register passkey, please try again.');
      }

      // =================================================================================================
      // DID
      // =================================================================================================
      const did = await createIidDocumentIfNotExists({
        address: address,
        offlineSigner: wallet,
      });
      if (!did) {
        throw new Error('Failed to create did, please try again.');
      }

      // =================================================================================================
      // MATRIX
      // =================================================================================================
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
      // register ONLY
      const account = await mxRegister({
        homeServerUrl: homeServerUrl,
        username: mxUsername,
        password: mxPassword,
        registrationToken: process.env.NEXT_PUBLIC_MATRIX_REGISTRATION_TOKEN as string,
      });
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

      // encrypt and store matrix mnemonic
      const encryptedMnemonic = encrypt(mxMnemonic, password);
      const storeEncryptedMnemonicResponse = await fetch(
        `${homeServerUrl}/_matrix/client/r0/rooms/${roomId}/state/ixo.room.state.secure/encrypted_mnemonic`,
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
      onRegister({
        credentialId,
        address: wallet!?.baseAccount?.address,
        did: utils.did.generateSecpDid(wallet!.baseAccount.address),
        authenticatorId: authenticator?.id,
      });
    } catch (error: any) {
      console.error('handleRegister::', error.message);
      alert('Error during registration: ' + error.message);
    } finally {
      setLoading(false);
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
            Register Passkey
          </h2>

          <p
            style={{
              fontSize: '14px',
              color: '#868e96',
              marginBottom: '20px',
            }}
          >
            This is the only time we are showing you the corresponding mnemonic for you to copy if you want to safely
            back up the mnemonic or test the login with mnemonic flow.
          </p>
          <p
            style={{
              fontSize: '14px',
              color: '#868e96',
              marginBottom: '20px',
            }}
          >
            Please note this is just for testing/demo purposes!
          </p>

          <p
            style={{
              fontSize: '14px',
              fontWeight: 600,
              marginBottom: '20px',
            }}
          >
            {wallet?.mnemonic ?? 'loading...'}
          </p>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              marginBottom: '24px',
            }}
          >
            <div>
              <label
                style={{
                  display: 'block',
                  marginBottom: '4px',
                  fontSize: '14px',
                }}
              >
                Encryption Password
              </label>
              <input
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #ced4da',
                  borderRadius: '4px',
                  fontSize: '14px',
                }}
                type='password'
                placeholder='Password for mnemonic encryption'
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          {/* @ts-ignore */}
          <Button
            label='Register Passkey'
            color={BUTTON_COLOR.white}
            size={BUTTON_SIZE.mediumLarge}
            bgColor={BUTTON_BG_COLOR.primary}
            onClick={handleRegister}
            disabled={loading || !password || password.length < 6}
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

export default RegisterPasskey;
