import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';

import Button, { BUTTON_BG_COLOR, BUTTON_COLOR, BUTTON_SIZE } from '@components/Button/Button';
import GradientBand from '@components/GradientBand/GradientBand';
import AuthHeader from '@components/AuthHeader/AuthHeader';
import { GRADIENT_COLORS } from '@constants/gradientColors';
import Loader from '@components/Loader/Loader';
import MatrixPinForm from '@components/MatrixPinForm/MatrixPinForm';
import { errorToast } from '@components/Toast/Toast';
import { useAuth } from '@hooks/useAuth';
import { useBackgroundSetup } from '@hooks/useBackgroundSetup';
import {
  AddressData,
  passkeyLoginBlocking,
  passkeyLoginBlockingFinalize,
  matrixLoginBackground,
} from 'lib/auth/passkeyFlow';
import { loadPendingSSO, clearPendingSSO } from 'lib/sso/pending';
import { store } from '@store/index';
import { setSSOSession } from '@store/slices/ssoSlice';
import { secureSave } from '@utils/storage';
import authConstants from '@constants/auth';
import cons from '@constants/matrix';

enum STEPS {
  loading = 0,
  address = 1,
  pin = 2,
}

function LoginPasskey() {
  const router = useRouter();
  const auth = useAuth();
  const { startSetup } = useBackgroundSetup();

  const [step, setStep] = useState<STEPS>(STEPS.loading);
  const [error, setError] = useState('');
  const [keyId, setKeyId] = useState('');
  const [assertion, setAssertion] = useState<any>(null);
  const [addresses, setAddresses] = useState<AddressData[]>([]);
  const [selectedAddress, setSelectedAddress] = useState('');
  const [loadingMessage, setLoadingMessage] = useState('Authenticating with passkey...');

  const initRef = useRef<boolean>(false);
  const encryptedMnemonicRef = useRef<string>('');
  const pinDeferredRef = useRef<{ resolve: (pin: string) => void; promise: Promise<string> } | null>(null);
  const blockingResultRef = useRef<any>(null);

  const stepIsLoading = step === STEPS.loading;
  const stepIsAddress = step === STEPS.address;
  const stepIsPin = step === STEPS.pin;

  useEffect(() => {
    if (!initRef.current) {
      initRef.current = true;
      void initPasskeyLogin();
    }
  }, []);

  async function initPasskeyLogin() {
    setStep(STEPS.loading);
    setError('');

    try {
      const callbacks = {
        onStatusUpdate: (msg: string) => setLoadingMessage(msg),
        requestPin: () => Promise.reject(new Error('PIN not expected during blocking phase')),
      };
      const result = await passkeyLoginBlocking(callbacks);
      if (!result) {
        throw new Error('Passkey authentication failed');
      }

      setKeyId(result.keyId);
      setAssertion(result.assertion);
      setAddresses(result.addresses);

      if (result.addresses.length === 1) {
        // Single address — auto-select without showing address picker
        await handleFinalAuthentication({
          address: result.addresses[0].address,
          authenticatorId: result.addresses[0].id,
          assertionData: result.assertion,
          keyIdData: result.keyId,
          addressesData: result.addresses,
        });
      } else {
        // Multiple addresses — show address selection UI
        setStep(STEPS.address);
      }
    } catch (err: any) {
      // User cancelled passkey prompt or no passkeys available → register new passkey
      if (err?.name === 'NotAllowedError') {
        router.push('/auth/register');
        return;
      }
      errorToast(err.message || 'Failed to verify passkey');
      setTimeout(() => router.push('/auth'), 1500);
    }
  }

  function handleBack() {
    if (stepIsAddress) {
      router.push('/auth');
    }
  }

  async function handleFinalAuthentication(overrides?: {
    address: string;
    authenticatorId?: string;
    assertionData: any;
    keyIdData: string;
    addressesData: AddressData[];
  }) {
    setStep(STEPS.loading);
    setError('');

    const resolvedAddress = overrides?.address || selectedAddress;
    const resolvedAssertion = overrides?.assertionData || assertion;
    const resolvedKeyId = overrides?.keyIdData || keyId;
    const resolvedAddresses = overrides?.addressesData || addresses;
    const resolvedAuthenticatorId =
      overrides?.authenticatorId ?? resolvedAddresses.find((addr) => addr.address === resolvedAddress)?.id;

    try {
      if (!resolvedAddress) {
        setError('Please select an address');
        setStep(STEPS.address);
        return;
      }

      const callbacks = {
        onStatusUpdate: (msg: string) => setLoadingMessage(msg),
        requestPin: () => Promise.reject(new Error('PIN not expected during blocking phase')),
      };

      // Blocking phase: verify DID + fetch encrypted mnemonic
      const blockingResult = await passkeyLoginBlockingFinalize({
        address: resolvedAddress,
        authenticatorId: resolvedAuthenticatorId,
        assertion: resolvedAssertion,
        keyId: resolvedKeyId,
        addresses: resolvedAddresses,
        callbacks,
      });

      // Store blocking result — auth + SSO promotion deferred to handlePinSuccess
      // (calling auth.loginWithPasskey now would set isLoggedIn=true → GuestGuard redirects away)
      blockingResultRef.current = blockingResult;

      // Store encrypted mnemonic for PIN form validation
      encryptedMnemonicRef.current = blockingResult.encryptedMnemonic;

      // Create deferred PIN promise for background to await
      let resolvePin: (pin: string) => void;
      const pinPromise = new Promise<string>((r) => { resolvePin = r; });
      pinDeferredRef.current = { resolve: resolvePin!, promise: pinPromise };

      // Start background Matrix setup (will await PIN via deferred promise)
      startSetup(() =>
        matrixLoginBackground({
          address: blockingResult.address,
          encryptedMnemonic: blockingResult.encryptedMnemonic,
          callbacks: {
            onStatusUpdate: (msg: string) => setLoadingMessage(msg),
            requestPin: () => pinPromise,
          },
        }),
      );

      // Show PIN input form on auth screen
      setStep(STEPS.pin);
    } catch (err: any) {
      const message = err.message || 'Login failed';
      const isUnrecoverable = message.includes('cannot be recovered');
      errorToast(message);
      setTimeout(() => router.push('/auth'), isUnrecoverable ? 6000 : 1500);
    }
  }

  function handlePinSuccess(pin: string) {
    // Now safe to mark as logged in (PIN collected, about to navigate)
    const br = blockingResultRef.current;
    if (br) {
      auth.loginWithPasskey({
        credentialId: br.credentialId,
        authenticatorId: br.authenticatorId,
        address: br.address,
        did: br.did,
      });
    }

    // Promote pending SSO data to Redux (persisted)
    const pendingSSO = loadPendingSSO();
    if (pendingSSO) {
      store.dispatch(setSSOSession(pendingSSO));
      secureSave(authConstants.yomaKey.ACCESS_TOKEN, pendingSSO.accessToken);
      if (pendingSSO.refreshToken) secureSave(authConstants.yomaKey.REFRESH_TOKEN, pendingSSO.refreshToken);
      secureSave(authConstants.yomaKey.EXPIRES_AT, String(pendingSSO.expiresAt));
      clearPendingSSO();
    }

    // Mark PIN as provided (for recovery if background is interrupted)
    secureSave(cons.secretKey.PIN_PROVIDED, 'true');

    // Resolve deferred promise so background can proceed
    pinDeferredRef.current?.resolve(pin);

    // Navigate to app
    router.push('/');
  }

  function handlePinError(err: string) {
    errorToast(err || 'Failed to verify Data Store PIN.');
    setTimeout(() => router.push('/auth'), 1500);
  }

  return (
    <div
      style={{
        position: 'relative',
        minHeight: '100vh',
        padding: '20px',
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      <GradientBand {...GRADIENT_COLORS.auth} fullScreen />
      <AuthHeader />
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          width: '100%',
          maxWidth: '400px',
          marginTop: 'calc(30vh - 50px)',
        }}
      >
        <div
          style={{
            borderRadius: '12px',
            padding: '24px',
            backgroundColor: 'var(--bg-secondary)',
          }}
        >
          {!stepIsPin && (
            <h1
              style={{
                textAlign: 'center',
                marginBottom: '16px',
                color: 'var(--text-primary)',
              }}
            >
              Welcome
            </h1>
          )}

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
              <p style={{ marginLeft: '16px', color: 'var(--text-secondary)' }}>{loadingMessage}</p>
            </div>
          ) : stepIsAddress ? (
            <>
              <div style={{ marginBottom: '24px' }}>
                <p style={{ marginBottom: '12px', color: 'var(--text-primary)' }}>Select your smart account address:</p>
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
                  bgColor={BUTTON_BG_COLOR.lightGrey}
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
