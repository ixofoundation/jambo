import { useState } from 'react';
import { utils } from '@ixo/impactxclient-sdk';
import { createMatrixApiClient } from '@ixo/matrixclient-sdk';

import { getSecpClient, SecpClient } from '@utils/secp';
import Button, { BUTTON_BG_COLOR, BUTTON_COLOR, BUTTON_SIZE } from '@components/Button/Button';
import { grantAddressFeegrantIfNotExists } from '@utils/feegrant';
import { createIidDocumentIfNotExists } from '@utils/did';
import { decrypt, encrypt } from '@utils/encryption';
import {
  checkIsUsernameAvailable,
  createMatrixClient,
  generatePassphraseFromMnemonic,
  generatePasswordFromMnemonic,
  generateUsernameFromAddress,
  generateUserRoomAliasFromAddress,
  hasCrossSigningAccountData,
  loginOrRegisterMatrixAccount,
  logoutMatrixClient,
  setupCrossSigning,
} from '@utils/matrix';

interface LoginWithMnemonicProps {
  onBack: () => void;
  onLogin: (response: { wallet: SecpClient; address: string; did: string; credentialId: string }) => void;
}

function LoginWithMnemonic({ onLogin, onBack }: LoginWithMnemonicProps) {
  const [mnemonic, setMnemonic] = useState('');
  const [mnemonicFocused, setMnemonicFocused] = useState(false);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin() {
    setLoading(true);
    setError(null);
    try {
      if (!mnemonic) {
        throw new Error('Please enter your mnemonic phrase');
      }
      if (!password) {
        throw new Error('Please enter a password to decrypt your mnemonic');
      }
      // Create wallet from mnemonic
      const wallet = await getSecpClient(mnemonic);
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
      const mxUsername = generateUsernameFromAddress(address);
      const isUsernameAvailable = await checkIsUsernameAvailable({
        homeServerUrl: process.env.NEXT_PUBLIC_MATRIX_HOMESERVER_URL as string,
        username: mxUsername,
      });
      let homeServerUrl = process.env.NEXT_PUBLIC_MATRIX_HOMESERVER_URL as string;
      let mxMnemonicSource: 'decrypted' | 'generated' = 'generated';
      let mxMnemonic = utils.mnemonic.generateMnemonic(12);
      let mxPassword = generatePasswordFromMnemonic(mxMnemonic);
      let mxPassphrase = generatePassphraseFromMnemonic(mxMnemonic);
      let mxRoomAlias: string = generateUserRoomAliasFromAddress(address, homeServerUrl);
      let mxRoomId: string;

      // existing account - fetch matrix mnemonic
      if (!isUsernameAvailable) {
        // Generate challenge (ISO timestamp and base64 encode it)
        const timestamp = new Date().toISOString();
        const challenge = Buffer.from(timestamp).toString('base64');
        // Sign the challenge with the wallet's private key
        // The challenge is already base64 encoded here
        const signature = await wallet.sign(challenge);
        // Call API to get encrypted mnemonic using secp256k1 signature
        const response = await fetch('/api/auth/get-secret-secp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            address: wallet.baseAccount.address,
            secpResult: {
              challenge,
              signature: Buffer.from(signature).toString('base64'),
            },
          }),
        });
        if (!response.ok) {
          const errorData = await response.json();
          console.error('errorData', errorData);
          if (!errorData.error?.includes('M_NOT_FOUND: Room alias')) {
            throw new Error(errorData.error || 'Failed to login');
          }
        } else {
          const { encryptedMnemonic, roomId } = await response.json();
          mxMnemonic = decrypt(encryptedMnemonic, password);
          if (!mxMnemonic) {
            throw new Error('Failed to decrypt mnemonic - incorrect password');
          }
          mxMnemonicSource = 'decrypted';
          mxPassword = generatePasswordFromMnemonic(mxMnemonic);
          mxPassphrase = generatePassphraseFromMnemonic(mxMnemonic);
          mxRoomId = roomId;
        }
      }

      // clear residual matrix data
      await logoutMatrixClient({ baseUrl: homeServerUrl });
      // login or register (new or existing account)
      const account = await loginOrRegisterMatrixAccount({
        homeServerUrl: homeServerUrl,
        username: mxUsername,
        password: mxPassword,
        registrationToken: process.env.NEXT_PUBLIC_MATRIX_REGISTRATION_TOKEN as string,
      });
      if (!account?.accessToken) {
        throw new Error('Failed to login or register matrix account, please try again.');
      }
      // setup clients
      const mxClient = await createMatrixClient();
      const matrixApiClient = createMatrixApiClient({
        homeServerUrl: homeServerUrl,
        accessToken: account.accessToken as string,
      });
      // setup cross signing and create room for new account
      if (mxMnemonicSource === 'generated') {
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
        // setup room
        const queryIdResponse = await matrixApiClient.room.v1beta1.queryId(mxRoomAlias).catch(() => undefined);
        mxRoomId = queryIdResponse?.room_id ?? '';
        if (!mxRoomId) {
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
          mxRoomId = data.roomId;
          if (!mxRoomId) {
            throw new Error('Failed to create user matrix room.');
          }
        }
        // join room
        let joinedMembers = await matrixApiClient.room.v1beta1.listJoinedMembers(mxRoomId).catch(() => undefined);
        let joined = !!joinedMembers?.joined?.[account.userId];
        if (!joined) {
          const joinResponse = await matrixApiClient.room.v1beta1.join(mxRoomId);
          if (!joinResponse.room_id) {
            throw new Error('Failed to join matrix room.');
          }
          joinedMembers = await matrixApiClient.room.v1beta1.listJoinedMembers(mxRoomId);
          joined = !!joinedMembers?.joined?.[account.userId];
          if (!joined) {
            throw new Error('Failed to join matrix room.');
          }
        }
        // store matrix mnemonic
        const encryptedMnemonic = encrypt(mxMnemonic, password);
        const storeEncryptedMnemonicResponse = await fetch(
          `${homeServerUrl}/_matrix/client/r0/rooms/${mxRoomId}/state/ixo.room.state.secure/encrypted_mnemonic`,
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
        const storeEncryptedMnemonicData = await storeEncryptedMnemonicResponse.json();
      }

      // done: use 'secp256k1' as credentialId for secp-based logins
      onLogin({
        wallet,
        credentialId: 'secp256k1',
        did,
        address,
      });
    } catch (err: any) {
      console.error('Login error:', err);
      alert(err.message || 'Failed to login. Please try again.');
      setError(err.message || 'Failed to login. Please try again.');
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
            Login with Mnemonic
          </h2>
          <p
            style={{
              fontWeight: 500,
              marginBottom: '24px',
            }}
          >
            Enter your mnemonic phrase to login
          </p>

          <div style={{ marginBottom: '24px' }}>
            <div style={{ marginBottom: '16px' }}>
              <label
                style={{
                  display: 'block',
                  marginBottom: '4px',
                  fontSize: '14px',
                }}
              >
                Mnemonic
              </label>
              <input
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #ced4da',
                  borderRadius: '4px',
                  fontSize: '14px',
                }}
                placeholder='Enter your mnemonic phrase'
                value={mnemonic}
                type={mnemonicFocused ? 'text' : 'password'}
                onChange={(e) => setMnemonic(e.target.value)}
                onFocus={() => setMnemonicFocused(true)}
                onBlur={() => setMnemonicFocused(false)}
                required
              />
            </div>
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
                type='password'
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #ced4da',
                  borderRadius: '4px',
                  fontSize: '14px',
                }}
                placeholder='Password for mnemonic encryption'
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          {error && (
            <p
              style={{
                color: 'red',
                fontSize: '14px',
                marginBottom: '16px',
              }}
            >
              {error}
            </p>
          )}

          {/* @ts-ignore */}
          <Button
            label={loading ? 'Logging in...' : 'Login'}
            onClick={handleLogin}
            disabled={loading}
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

export default LoginWithMnemonic;
