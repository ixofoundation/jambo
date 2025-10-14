import { useRef, useState } from 'react';
import { utils } from '@ixo/impactxclient-sdk';

import Button, { BUTTON_BG_COLOR, BUTTON_COLOR, BUTTON_SIZE } from '@components/Button/Button';
import { checkIidDocumentExists } from '@utils/did';
import { initializeSignX } from '@utils/signX';
import {
  createMatrixClient,
  generateUsernameFromAddress,
  hasCrossSigningAccountData,
  logoutMatrixClient,
  mxLogin,
  setupCrossSigning,
  generatePasswordFromMnemonic,
  generatePassphraseFromMnemonic,
} from '@utils/matrix';
import useSteps from '@hooks/useSteps';
import Loader from '@components/Loader/Loader';
import { decrypt } from '@utils/encryption';
import MatrixPinForm from '@components/MatrixPinForm/MatrixPinForm';

enum STEPS {
  loading = 0,
  signx = 1,
  pin = 2,
}

const STEPS_STATE = [STEPS.loading, STEPS.signx, STEPS.pin];

interface LoginWithSignXProps {
  onBack: () => void;
  onLogin: (response: { address: string; did: string; credentialId: string; signXUser: any }) => void;
}

function LoginWithSignX({ onLogin, onBack }: LoginWithSignXProps) {
  const { step, reset, goTo } = useSteps(STEPS_STATE, STEPS.signx);
  const [error, setError] = useState<string | null>(null);

  const handlerRef = useRef<{
    resolve?: (value: any) => void;
    reject?: (reason: any) => void;
  }>({});
  const signXUserRef = useRef<any>(undefined);
  const encryptedMnemonicRef = useRef<string | undefined>(undefined);

  const stepIsLoading = step === STEPS.loading;
  const stepIsSignX = step === STEPS.signx;
  const stepIsPin = step === STEPS.pin;

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
      // Initialize SignX and get user data with matrix credentials
      const signXUser = await initializeSignX(process.env.NEXT_PUBLIC_CHAIN_NETWORK);
      if (!signXUser?.address || !signXUser?.did) {
        throw new Error('Failed to login with SignX. Please ensure you have the IXO mobile app with a valid account.');
      }

      const address = signXUser.address;
      const did = signXUser.did;

      // =================================================================================================
      // MATRIX
      // =================================================================================================
      // Check if SignX response includes matrix credentials
      if (!signXUser.matrix?.accessToken || !signXUser.matrix?.userId) {
        throw new Error(
          'Data Vault credentials not found. Please ensure your IXO mobile app is properly configured with a Data Vault account.',
        );
      }

      // Login successful
      onLogin({
        address,
        did,
        credentialId: 'signx',
        signXUser,
      });
    } catch (err: any) {
      console.error('SignX Login error:', err);
      setError((typeof err === 'string' ? err : err.message) || 'Failed to login with SignX. Please try again.');
    } finally {
      goTo(STEPS.signx);
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
            Login with SignX
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
          ) : stepIsSignX ? (
            <>
              <p style={{ marginBottom: '16px' }}>
                Scan the QR code with your{' '}
                <a
                  href='https://apps.apple.com/app/impacts-x/id6444948058'
                  target='_blank'
                  rel='noopener noreferrer'
                  style={{ color: 'var(--primary-color)', textDecoration: 'underline' }}
                >
                  IXO mobile app
                </a>{' '}
                to login. Make sure you allow access to your Data Vault.
              </p>

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
                  label={'Login with SignX'}
                  onClick={handleLogin}
                  disabled={stepIsLoading}
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

export default LoginWithSignX;
