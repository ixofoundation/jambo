import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { utils } from '@ixo/impactxclient-sdk';

import { getSecpClient, SecpClient } from '@utils/secp';
import GradientBand from '@components/GradientBand/GradientBand';
import AuthHeader from '@components/AuthHeader/AuthHeader';
import { GRADIENT_COLORS } from '@constants/gradientColors';
import Loader from '@components/Loader/Loader';
import SecretPhraseStep from '@components/SecretPhraseStep/SecretPhraseStep';
import MatrixPinForm from '@components/MatrixPinForm/MatrixPinForm';
import { useAuth } from '@hooks/useAuth';
import { useBackgroundSetup } from '@hooks/useBackgroundSetup';
import useSteps from '@hooks/useSteps';
import { ensureFeegrant, passkeyRegisterBlocking, registerBackground } from 'lib/auth/passkeyFlow';
import { loadPendingSSO, clearPendingSSO } from 'lib/sso/pending';
import { store } from '@store/index';
import { setSSOSession } from '@store/slices/ssoSlice';
import { secureSave } from '@utils/storage';
import { encrypt } from '@utils/encryption';
import { errorToast } from '@components/Toast/Toast';
import authConstants from '@constants/auth';
import cons from '@constants/matrix';

enum STEPS {
  loading = 0,
  mnemonic = 1,
  pin = 2,
}

const STEPS_STATE = [STEPS.loading, STEPS.mnemonic, STEPS.pin];

function RegisterPasskey() {
  const router = useRouter();
  const auth = useAuth();
  const { startSetup } = useBackgroundSetup();
  const { step, goTo } = useSteps(STEPS_STATE, STEPS.mnemonic);
  const [wallet, setWallet] = useState<SecpClient | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingMessage, setLoadingMessage] = useState('Loading...');
  const feegrantRef = useRef<Promise<void> | null>(null);
  const mxMnemonicRef = useRef<string>('');
  const pinDeferredRef = useRef<{ resolve: (pin: string) => void; promise: Promise<string> } | null>(null);
  const blockingResultRef = useRef<any>(null);

  useEffect(function () {
    if (!wallet) {
      (async function () {
        const mnemonic = utils.mnemonic.generateMnemonic();
        const newWallet = await getSecpClient(mnemonic);
        setWallet(newWallet);
        // Start feegrant in background while user backs up mnemonic
        const p = ensureFeegrant(newWallet.baseAccount.address);
        p.catch(() => {}); // prevent uncaught rejection warning; handled in handleRegister
        feegrantRef.current = p;
      })();
    }
  }, []);

  const stepIsLoading = step === STEPS.loading;
  const stepIsMnemonic = step === STEPS.mnemonic;
  const stepIsPin = step === STEPS.pin;

  async function handleRegister() {
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
        requestPin: () => Promise.reject(new Error('PIN not expected during blocking phase')),
      };

      // Await background feegrant (or retry if it failed)
      setLoadingMessage('Checking fee grant...');
      try {
        if (feegrantRef.current) {
          await feegrantRef.current;
        } else {
          await ensureFeegrant(wallet.baseAccount.address);
        }
      } catch {
        setLoadingMessage('Requesting fee grant...');
        feegrantRef.current = ensureFeegrant(wallet.baseAccount.address);
        await feegrantRef.current;
      }

      // Read pending SSO for passkey display name
      const pendingSSO = loadPendingSSO();
      const ssoLabel = pendingSSO?.name || pendingSSO?.email || undefined;

      // Blocking phase: passkey → DID (feegrant already handled)
      const result = await passkeyRegisterBlocking({
        wallet,
        callbacks: blockingCallbacks,
        ssoLabel,
      });

      // Store blocking result — auth + SSO promotion deferred to handlePinSuccess
      // (calling auth.registerWithPasskey now would set isLoggedIn=true → GuestGuard redirects away)
      blockingResultRef.current = { result, pendingSSO };

      // Generate Matrix mnemonic and back it up before starting background
      const mxMnemonic = utils.mnemonic.generateMnemonic(12);
      mxMnemonicRef.current = mxMnemonic;
      secureSave(cons.secretKey.MNEMONIC_BACKUP, mxMnemonic);
      secureSave(cons.secretKey.BACKGROUND_TYPE, 'register');

      // Create deferred PIN promise for background to await
      let resolvePin: (pin: string) => void;
      const pinPromise = new Promise<string>((r) => { resolvePin = r; });
      pinDeferredRef.current = { resolve: resolvePin!, promise: pinPromise };

      // Start background Matrix setup (will await PIN via deferred promise)
      startSetup(() =>
        registerBackground({
          address: result.address,
          did: result.did,
          wallet: result.wallet,
          mxMnemonicOverride: mxMnemonic,
          callbacks: {
            onStatusUpdate: (msg: string) => setLoadingMessage(msg),
            requestPin: () => pinPromise,
          },
        }),
      );

      // Show PIN setup form on auth screen
      goTo(STEPS.pin);
    } catch (err: any) {
      console.error('Register error:', err);
      setError((typeof err === 'string' ? err : err.message) || 'Failed to register. Please try again.');
      goTo(STEPS.mnemonic);
    }
  }

  function handlePinSuccess(pin: string) {
    // Now safe to mark as logged in (PIN collected, about to navigate)
    const stored = blockingResultRef.current;
    if (stored?.result) {
      auth.registerWithPasskey({
        credentialId: stored.result.credentialId,
        address: stored.result.address,
        did: stored.result.did,
        authenticatorId: stored.result.authenticatorId,
      });
    }

    // Promote pending SSO data to Redux (persisted)
    if (stored?.pendingSSO) {
      store.dispatch(setSSOSession(stored.pendingSSO));
      secureSave(authConstants.yomaKey.ACCESS_TOKEN, stored.pendingSSO.accessToken);
      if (stored.pendingSSO.refreshToken) secureSave(authConstants.yomaKey.REFRESH_TOKEN, stored.pendingSSO.refreshToken);
      secureSave(authConstants.yomaKey.EXPIRES_AT, String(stored.pendingSSO.expiresAt));
      clearPendingSSO();
    }

    // Encrypt mnemonic locally (backup in case background is interrupted after PIN)
    const encryptedMnemonic = encrypt(mxMnemonicRef.current, pin);
    secureSave(cons.secretKey.ENCRYPTED_MNEMONIC_LOCAL, encryptedMnemonic);
    secureSave(cons.secretKey.PIN_PROVIDED, 'true');

    // Resolve deferred promise so background can proceed
    pinDeferredRef.current?.resolve(pin);

    // Navigate to app
    router.push('/');
  }

  function handlePinError(err: string) {
    errorToast(err || 'Failed to set Data Store PIN.');
    router.push('/auth');
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
