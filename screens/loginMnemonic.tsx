import { useRef, useState } from 'react';
import { utils } from '@ixo/impactxclient-sdk';
import { createMatrixApiClient } from '@ixo/matrixclient-sdk';
import { OfflineSigner } from '@cosmjs/proto-signing';

import { getSecpClient, SecpClient } from '@utils/secp';
import Button, { BUTTON_BG_COLOR, BUTTON_COLOR, BUTTON_SIZE } from '@components/Button/Button';
import { checkAddressFeegrant } from '@utils/feegrant';
import { checkIidDocumentExists, createIidDocument } from '@utils/did';
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
import Loader from '@components/Loader/Loader';
import useSteps from '@hooks/useSteps';
import { delay } from '@utils/timestamp';
import EmailFeegrantForm from '@components/EmailFeegrantForm/EmailFeegrantForm';
import MatrixPinForm from '@components/MatrixPinForm/MatrixPinForm';

enum STEPS {
  loading = 0,
  mnemonic = 1,
  pin = 2,
  email = 3,
}

const STEPS_STATE = [STEPS.loading, STEPS.mnemonic, STEPS.pin, STEPS.email];

interface LoginWithMnemonicProps {
  onBack: () => void;
  onLogin: (response: { wallet: SecpClient; address: string; did: string; credentialId: string }) => void;
}

function LoginWithMnemonic({ onLogin, onBack }: LoginWithMnemonicProps) {
  const { step, reset, goTo } = useSteps(STEPS_STATE, STEPS.mnemonic);
  const [mnemonic, setMnemonic] = useState('');
  const [mnemonicFocused, setMnemonicFocused] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlerRef = useRef<{
    resolve?: (value: any) => void;
    reject?: (reason: any) => void;
  }>({});
  const addressRef = useRef<string | undefined>(undefined);
  const encryptedMnemonicRef = useRef<string | undefined>(undefined);

  const stepIsLoading = step === STEPS.loading;
  const stepIsMnemonic = step === STEPS.mnemonic;
  const stepIsPin = step === STEPS.pin;
  const stepIsEmail = step === STEPS.email;

  function handleGenerateMnemonic() {
    const newMnemonic = utils.mnemonic.generateMnemonic(12);
    setMnemonic(newMnemonic);
    navigator.clipboard.writeText(newMnemonic);
    setMnemonicFocused(true);
    setTimeout(function () {
      setMnemonicFocused(false);
    }, 1000);
  }

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

  async function handleLogin() {
    goTo(STEPS.loading);
    setError(null);
    try {
      if (!mnemonic) {
        throw new Error('Please enter your mnemonic phrase');
      }
      // Create wallet from mnemonic
      const wallet = await getSecpClient(mnemonic);
      const address = wallet.baseAccount.address;
      const did = utils.did.generateSecpDid(address);
      const didExists = await checkIidDocumentExists(did);
      if (!didExists) {
        // =================================================================================================
        // FEEGRANT (EMAIL OTP)
        // =================================================================================================
        const feegrant = await checkAddressFeegrant(address);
        if (!feegrant) {
          (await requestEmail(address)) as string;
          goTo(STEPS.loading);
          const feegrant = await checkAddressFeegrant(address);
          if (!feegrant) {
            throw new Error('Failed to grant feegrant, please try again.');
          }
        }

        // =================================================================================================
        // DID
        // =================================================================================================
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

      let pin: string = '';
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
          pin = (await requestPin(encryptedMnemonic)) as string;
          mxMnemonic = decrypt(encryptedMnemonic, pin);
          if (!mxMnemonic) {
            throw new Error('Failed to decrypt mnemonic - incorrect pin');
          }
          mxMnemonicSource = 'decrypted';
          mxPassword = generatePasswordFromMnemonic(mxMnemonic);
          mxPassphrase = generatePassphraseFromMnemonic(mxMnemonic);
          mxRoomId = roomId;
        }
      }
      if (!pin) {
        pin = (await requestPin()) as string;
      }

      // clear residual matrix data
      await logoutMatrixClient({ baseUrl: homeServerUrl });
      // login or register (new or existing account)
      const account = await loginOrRegisterMatrixAccount({
        homeServerUrl: homeServerUrl,
        username: mxUsername,
        password: mxPassword,
        wallet: wallet,
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
        const encryptedMnemonic = encrypt(mxMnemonic, pin);
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
      // alert(err.message || 'Failed to login. Please try again.');
      setError((typeof err === 'string' ? err : err.message) || 'Failed to login. Please try again.');
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
          ) : stepIsMnemonic ? (
            <>
              <p>
                Enter your mnemonic phrase to login or generate a{' '}
                <span
                  style={{
                    color: 'var(--primary-color)',
                    textDecoration: 'underline',
                  }}
                  onClick={handleGenerateMnemonic}
                >
                  new mnemonic
                </span>
              </p>

              <div style={{ marginBottom: '24px' }}>
                <div style={{ marginBottom: '16px' }}>
                  <label
                    style={{
                      display: 'block',
                      marginBottom: '4px',
                      fontSize: '14px',
                      fontWeight: '500',
                    }}
                  >
                    Mnemonic Phrase
                  </label>
                  <input
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #ced4da',
                      borderRadius: '4px',
                      fontSize: '14px',
                      marginBottom: '16px',
                    }}
                    placeholder={'Enter your mnemonic phrase'}
                    value={mnemonic}
                    type={mnemonicFocused ? 'text' : 'password'}
                    onChange={(e) => setMnemonic(e.target.value)}
                    onFocus={() => setMnemonicFocused(true)}
                    onBlur={() => setMnemonicFocused(false)}
                    required
                  />
                </div>

                <p style={{ fontSize: '12px' }}>
                  <span style={{ color: 'var(--warning-color)', fontWeight: 500 }}>Warning:</span> Your mnemonic is the
                  only way to access your account and should be stored somewhere safe (do not share it with anyone).
                </p>
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

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                {/* @ts-ignore */}
                <Button
                  label='Back'
                  color={BUTTON_COLOR.primary}
                  size={BUTTON_SIZE.mediumLarge}
                  bgColor={BUTTON_BG_COLOR.white}
                  onClick={onBack}
                  disabled={stepIsLoading}
                />
                {/* @ts-ignore */}
                <Button
                  label={'Next'}
                  onClick={handleLogin}
                  disabled={stepIsLoading}
                  color={BUTTON_COLOR.white}
                  size={BUTTON_SIZE.mediumLarge}
                  bgColor={BUTTON_BG_COLOR.primary}
                />
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

export default LoginWithMnemonic;
