import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { utils } from '@ixo/impactxclient-sdk';

import { getSecpClient, SecpClient } from '@utils/secp';
import { saveMnemonicWithWebCrypto, upgradeVaultToPinEncryption } from '@utils/setupVault';
import GradientBand from '@components/GradientBand/GradientBand';
import AuthHeader from '@components/AuthHeader/AuthHeader';
import MatrixPinForm from '@components/MatrixPinForm/MatrixPinForm';
import { GRADIENT_COLORS } from '@constants/gradientColors';
import config from '@constants/config.json';
import Loader from '@components/Loader/Loader';
import SecretPhraseStep from '@components/SecretPhraseStep/SecretPhraseStep';
import { useAuth } from '@hooks/useAuth';
import { useBackgroundSetup } from '@hooks/useBackgroundSetup';
import useSteps from '@hooks/useSteps';
import { passkeyRegisterBlocking, registerBackground, ensureFeegrant, RegisterBlockingResult } from 'lib/auth/passkeyFlow';
import { store } from '@store/index';
import { startFlow, advanceStep } from '@store/slices/setupFlowSlice';

enum STEPS {
  loading = 0,
  mnemonic = 1,
  pin = 2,
}

const STEPS_STATE = [STEPS.loading, STEPS.mnemonic, STEPS.pin];

function RegisterPasskey() {
  const router = useRouter();
  const auth = useAuth();
  const { startSetup, getFlowCallbacks } = useBackgroundSetup();
  const { step, goTo } = useSteps(STEPS_STATE, STEPS.mnemonic);
  const [wallet, setWallet] = useState<SecpClient | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingMessage, setLoadingMessage] = useState('Loading...');
  const [blockingResult, setBlockingResult] = useState<RegisterBlockingResult | null>(null);
  const feegrantPromiseRef = useRef<Promise<void> | null>(null);
  const registeringRef = useRef(false);

  useEffect(function () {
    if (!wallet) {
      (async function () {
        const mnemonic = utils.mnemonic.generateMnemonic();
        const newWallet = await getSecpClient(mnemonic);
        setWallet(newWallet);

        // Save mnemonic to vault immediately (WebCrypto tier)
        try {
          store.dispatch(startFlow({ flowType: 'register' }));
          await saveMnemonicWithWebCrypto('wallet', mnemonic);
          store.dispatch(advanceStep('MNEMONIC_SAVED'));
        } catch (err) {
          console.error('Failed to save mnemonic to vault:', err);
          // Non-fatal — the flow will still work, just won't survive interruption
        }

        // Start feegrant in background while user reads mnemonic
        feegrantPromiseRef.current = ensureFeegrant(newWallet.baseAccount.address).catch(() => {});
      })();
    }
  }, []);

  const stepIsLoading = step === STEPS.loading;
  const stepIsMnemonic = step === STEPS.mnemonic;
  const stepIsPin = step === STEPS.pin;

  async function handleRegister() {
    if (registeringRef.current) return;
    registeringRef.current = true;
    setError(null);
    goTo(STEPS.loading);
    try {
      if (!wallet?.baseAccount?.address) {
        throw new Error('No wallet found');
      }

      const blockingCallbacks = {
        onStatusUpdate: (msg: string) => {
          setLoadingMessage(msg);
          goTo(STEPS.loading);
        },
        requestPin: getFlowCallbacks().requestPin,
      };

      // Blocking phase: feegrant → passkey → verify
      const result = await passkeyRegisterBlocking({
        wallet,
        callbacks: blockingCallbacks,
        pendingFeegrantPromise: feegrantPromiseRef.current,
      });

      // Passkey registered — now collect PIN before entering the app
      setBlockingResult(result);
      goTo(STEPS.pin);
    } catch (err: any) {
      console.error('Register error:', err);
      setError((typeof err === 'string' ? err : err.message) || 'Failed to register. Please try again.');
      goTo(STEPS.mnemonic);
      registeringRef.current = false;
    }
  }

  async function handlePinSuccess(pin: string) {
    setError(null);
    goTo(STEPS.loading);
    setLoadingMessage('Securing your account...');

    try {
      if (!blockingResult) throw new Error('No registration result — please try again');

      // Upgrade vault from WebCrypto to PIN encryption
      await upgradeVaultToPinEncryption(pin);
      store.dispatch(advanceStep('PIN_COLLECTED'));

      // Registration complete (address + DID verified) — enter the app
      auth.registerWithPasskey({
        credentialId: blockingResult.credentialId,
        address: blockingResult.address,
        did: blockingResult.did,
        authenticatorId: blockingResult.authenticatorId,
      });

      // Start background Matrix setup (pass PIN so it can encrypt mnemonic)
      startSetup(() =>
        registerBackground({
          address: blockingResult.address,
          did: blockingResult.did,
          wallet: blockingResult.wallet,
          pin,
          callbacks: getFlowCallbacks(),
        }),
      );

      // Navigate to app
      const entityId: string | undefined = (config as any).entity;
      router.push(entityId ? `/entities/${encodeURIComponent(entityId)}` : '/');
    } catch (err: any) {
      console.error('PIN setup error:', err);
      setError(err.message || 'Failed to secure account. Please try again.');
      goTo(STEPS.pin);
    }
  }

  function handlePinError(errorMsg: string) {
    setError(errorMsg);
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
          {stepIsLoading ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
                <div style={{ width: '28px' }} />
                <h1 style={{ flex: 1, textAlign: 'center', margin: 0, color: 'var(--text-primary)', fontSize: '14px' }}>
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
                <p style={{ marginTop: '16px', color: 'var(--text-secondary)', fontSize: '14px' }}>{loadingMessage}</p>
              </div>
            </>
          ) : stepIsMnemonic ? (
            <SecretPhraseStep
              mnemonic={wallet?.mnemonic ?? ''}
              error={error}
              onBack={() => router.push('/auth')}
              onContinue={handleRegister}
            />
          ) : stepIsPin ? (
            <MatrixPinForm onSuccess={handlePinSuccess} onError={handlePinError} />
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default RegisterPasskey;
