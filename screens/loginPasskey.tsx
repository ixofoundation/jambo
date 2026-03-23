import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';

import Button, { BUTTON_BG_COLOR, BUTTON_COLOR, BUTTON_SIZE } from '@components/Button/Button';
import GradientBand from '@components/GradientBand/GradientBand';
import AuthHeader from '@components/AuthHeader/AuthHeader';
import { GRADIENT_COLORS } from '@constants/gradientColors';
import config from '@constants/config.json';
import Loader from '@components/Loader/Loader';
import { errorToast } from '@components/Toast/Toast';
import { delay } from '@utils/timestamp';
import { useAuth } from '@hooks/useAuth';
import { useBackgroundSetup } from '@hooks/useBackgroundSetup';
import {
  AddressData,
  passkeyLoginBlocking,
  passkeyLoginBlockingFinalize,
  matrixLoginBackground,
} from 'lib/auth/passkeyFlow';

enum STEPS {
  loading = 0,
  address = 1,
}

function LoginPasskey() {
  const router = useRouter();
  const auth = useAuth();
  const { startSetup, getFlowCallbacks } = useBackgroundSetup();

  const [step, setStep] = useState<STEPS>(STEPS.loading);
  const [error, setError] = useState('');
  const [keyId, setKeyId] = useState('');
  const [assertion, setAssertion] = useState<any>(null);
  const [addresses, setAddresses] = useState<AddressData[]>([]);
  const [selectedAddress, setSelectedAddress] = useState('');

  const initRef = useRef<boolean>(false);

  const stepIsLoading = step === STEPS.loading;
  const stepIsAddress = step === STEPS.address;

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
      const callbacks = getFlowCallbacks();
      const result = await passkeyLoginBlocking(callbacks);
      if (!result) {
        throw new Error('Passkey authentication failed');
      }

      setKeyId(result.keyId);
      setAssertion(result.assertion);
      setAddresses(result.addresses);
      setStep(STEPS.address);

      if (result.addresses.length === 1) {
        setSelectedAddress(result.addresses[0].address);
        await delay(200);
        await handleFinalAuthentication({
          address: result.addresses[0].address,
          authenticatorId: result.addresses[0].id,
          assertionData: result.assertion,
          keyIdData: result.keyId,
          addressesData: result.addresses,
        });
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

      const callbacks = getFlowCallbacks();

      // Blocking phase: verify DID + fetch encrypted mnemonic
      const blockingResult = await passkeyLoginBlockingFinalize({
        address: resolvedAddress,
        authenticatorId: resolvedAuthenticatorId,
        assertion: resolvedAssertion,
        keyId: resolvedKeyId,
        addresses: resolvedAddresses,
        callbacks,
      });

      // Login complete (address + DID verified) — enter the app
      auth.loginWithPasskey({
        credentialId: blockingResult.credentialId,
        authenticatorId: blockingResult.authenticatorId,
        address: blockingResult.address,
        did: blockingResult.did,
      });

      // Start background Matrix setup
      startSetup(() =>
        matrixLoginBackground({
          address: blockingResult.address,
          encryptedMnemonic: blockingResult.encryptedMnemonic,
          callbacks: getFlowCallbacks(),
        }),
      );

      // Navigate to app
      const entityId: string | undefined = (config as any).entity;
      router.push(entityId ? `/entities/${encodeURIComponent(entityId)}` : '/');
    } catch (err: any) {
      setError(err.message || 'Login failed');
      setStep(STEPS.address);
    }
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
      <GradientBand {...GRADIENT_COLORS.auth} />
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
          <h1
            style={{
              textAlign: 'center',
              marginBottom: '16px',
              color: 'var(--text-primary)',
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
              <p style={{ marginLeft: '16px', color: 'var(--text-secondary)' }}>Authenticating with passkey...</p>
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
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default LoginPasskey;
