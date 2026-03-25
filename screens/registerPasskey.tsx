import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { utils } from '@ixo/impactxclient-sdk';

import { getSecpClient, SecpClient } from '@utils/secp';
import GradientBand from '@components/GradientBand/GradientBand';
import AuthHeader from '@components/AuthHeader/AuthHeader';
import { GRADIENT_COLORS } from '@constants/gradientColors';
import Loader from '@components/Loader/Loader';
import SecretPhraseStep from '@components/SecretPhraseStep/SecretPhraseStep';
import { useAuth } from '@hooks/useAuth';
import { useBackgroundSetup } from '@hooks/useBackgroundSetup';
import useSteps from '@hooks/useSteps';
import { ensureFeegrant, passkeyRegisterBlocking, registerBackground } from 'lib/auth/passkeyFlow';
import { loadPendingSSO, clearPendingSSO } from 'lib/sso/pending';
import { store } from '@store/index';
import { setSSOSession } from '@store/slices/ssoSlice';
import { secureSave } from '@utils/storage';
import authConstants from '@constants/auth';

enum STEPS {
  loading = 0,
  mnemonic = 1,
}

const STEPS_STATE = [STEPS.loading, STEPS.mnemonic];

function RegisterPasskey() {
  const router = useRouter();
  const auth = useAuth();
  const { startSetup, getFlowCallbacks } = useBackgroundSetup();
  const { step, goTo } = useSteps(STEPS_STATE, STEPS.mnemonic);
  const [wallet, setWallet] = useState<SecpClient | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingMessage, setLoadingMessage] = useState('Loading...');
  const feegrantRef = useRef<Promise<void> | null>(null);

  useEffect(function () {
    if (!wallet) {
      (async function () {
        const mnemonic = utils.mnemonic.generateMnemonic();
        const newWallet = await getSecpClient(mnemonic);
        setWallet(newWallet);
        // Start feegrant in background while user backs up mnemonic
        feegrantRef.current = ensureFeegrant(newWallet.baseAccount.address);
      })();
    }
  }, []);

  const stepIsLoading = step === STEPS.loading;
  const stepIsMnemonic = step === STEPS.mnemonic;

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
        requestPin: getFlowCallbacks().requestPin,
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

      // Registration complete (address + DID verified) — enter the app
      auth.registerWithPasskey({
        credentialId: result.credentialId,
        address: result.address,
        did: result.did,
        authenticatorId: result.authenticatorId,
      });

      // Promote pending SSO data to Redux (persisted) now that blocking is complete
      if (pendingSSO) {
        store.dispatch(setSSOSession(pendingSSO));
        secureSave(authConstants.yomaKey.ACCESS_TOKEN, pendingSSO.accessToken);
        if (pendingSSO.refreshToken) secureSave(authConstants.yomaKey.REFRESH_TOKEN, pendingSSO.refreshToken);
        secureSave(authConstants.yomaKey.EXPIRES_AT, String(pendingSSO.expiresAt));
        clearPendingSSO();
      }

      // Start background Matrix setup
      startSetup(() =>
        registerBackground({
          address: result.address,
          did: result.did,
          wallet: result.wallet,
          callbacks: getFlowCallbacks(),
        }),
      );

      // Navigate to app — home page handles multi-project routing
      router.push('/');
    } catch (err: any) {
      console.error('Register error:', err);
      setError((typeof err === 'string' ? err : err.message) || 'Failed to register. Please try again.');
      goTo(STEPS.mnemonic);
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
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default RegisterPasskey;
