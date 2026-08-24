import { FC, ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import type { MatrixClient } from 'matrix-js-sdk';
import { BackgroundSetupContext, BackgroundSetupStatus } from '@contexts/backgroundSetup';
import { useAuth } from '@hooks/useAuth';
import PinModal from '@components/PinModal/PinModal';
import { mxLogin, createMatrixClient, generatePasswordFromMnemonic } from '@utils/matrix';
import { isMatrixEncryptionReady, repairMatrixEncryption, formatEncryptionDiagnostics } from '@utils/matrixEncryptionRepair';
import {
  fetchEncryptedMnemonicFromRoomBot,
  fetchEncryptedMnemonicFromRoom,
  decryptEncryptedMnemonic,
} from '@utils/roomBotMnemonic';
import { secret } from '@utils/secrets';
import { secureLoad, secureReset } from '@utils/storage';
import { activateDeckPrefs, hydrateDeckPrefsFromMatrix } from '@utils/deckPrefs';
import { initLocalCurrency } from '@utils/localCurrency';
import { fetchMatrixProfile } from '@providers/auth';
import authConstants from '@constants/auth';

interface BackgroundSetupProviderProps {
  children: ReactNode;
}

interface RecoveryPending {
  ciphertext: string;
  resolve: () => void;
  reject: (err: Error) => void;
}

export const BackgroundSetupProvider: FC<BackgroundSetupProviderProps> = ({ children }) => {
  const auth = useAuth();
  const [status, setStatus] = useState<BackgroundSetupStatus>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showErrorDetails, setShowErrorDetails] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pinPrompt, setPinPrompt] = useState<{ ciphertext: string } | null>(null);

  const awaitersRef = useRef<Array<{ resolve: () => void; reject: (err: Error) => void }>>([]);
  const statusRef = useRef<BackgroundSetupStatus>('idle');
  const setupAttemptedRef = useRef(false);
  const mxClientRef = useRef<MatrixClient | null>(null);
  const recoveryPendingRef = useRef<RecoveryPending | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const getMatrixClient = useCallback(() => mxClientRef.current, []);

  const handleCopyDetails = useCallback(async () => {
    const text = errorDetails || error || '';
    if (!text) return;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        // Fallback for browsers without the async clipboard API.
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.warn('Copy diagnostics failed:', err);
    }
  }, [errorDetails, error]);

  useEffect(() => {
    statusRef.current = status;
    if (status === 'success') {
      const pending = awaitersRef.current.splice(0);
      pending.forEach(({ resolve }) => resolve());
    } else if (status === 'error') {
      const pending = awaitersRef.current.splice(0);
      pending.forEach(({ reject }) => reject(new Error(error || 'Data Store setup failed')));
    }
  }, [status, error]);

  const awaitCompletion = useCallback((): Promise<void> => {
    const current = statusRef.current;
    if (current === 'success' && mxClientRef.current) {
      return Promise.resolve();
    }
    if (current === 'error') {
      return Promise.reject(new Error('Data Store setup failed'));
    }
    // 'idle' (effect hasn't started yet) or 'running' — wait for the matrix client
    // to be ready. Resolved by the status effect below when status flips to success.
    setShowDetails(true);
    return new Promise<void>((resolve, reject) => {
      awaitersRef.current.push({ resolve, reject });
    });
  }, []);

  // Auto-setup Matrix when user is authenticated.
  // - Fresh login (mnemonic in secure storage): full setup including E2EE bootstrap.
  // - Reattach (Matrix tokens already present): just create the client. No E2EE check,
  //   no PIN prompt. Repair is deferred until an explicit `ensureEncryptionReady()` call.
  useEffect(() => {
    if (!auth.isLoggedIn || !auth.address || !auth.matrixUserId) return;
    // Namespace deck prefs to this account as soon as we know who's logged in —
    // this must happen even when Matrix never comes up (dev bypass, outages).
    activateDeckPrefs(auth.address);
    if (setupAttemptedRef.current) return;

    const hasMatrixTokens = !!secret.accessToken && !!secret.userId;
    const matrixMnemonic = secureLoad(authConstants.secretKey.MATRIX_MNEMONIC);

    if (!hasMatrixTokens && !matrixMnemonic) {
      console.warn('Matrix mnemonic not available in secure storage and no existing session');
      return;
    }

    setupAttemptedRef.current = true;

    if (hasMatrixTokens) {
      void reattachMatrix();
    } else if (matrixMnemonic) {
      void setupMatrix(matrixMnemonic);
    }

    async function reattachMatrix() {
      setStatus('running');
      setStatusMessage('Reconnecting to Data Store...');
      setError(null);
      setErrorDetails(null);

      try {
        const mxClient = await createMatrixClient();
        mxClientRef.current = mxClient;
        setStatus('success');
        setStatusMessage('Data Store ready');
        fetchMatrixProfile();
        void hydrateDeckPrefsFromMatrix(mxClient).catch((err) => console.warn('Deck prefs hydration failed:', err));
        if (auth.matrixRoomId && auth.address) {
          void initLocalCurrency(mxClient, auth.matrixRoomId, auth.address).catch((err) =>
            console.warn('Local currency resolution failed:', err),
          );
        }
      } catch (err: any) {
        console.error('Matrix reattach error:', err);
        setStatus('error');
        setError(err.message || 'Data Store reattach failed');
        setErrorDetails(formatEncryptionDiagnostics(err, { stage: 'reattach' }));
      }
    }

    async function setupMatrix(mnemonic: string) {
      setStatus('running');
      setStatusMessage('Connecting to Data Store...');
      setError(null);
      setErrorDetails(null);

      try {
        const homeServerUrl = process.env.NEXT_PUBLIC_MATRIX_HOMESERVER_URL as string;
        const mxPassword = generatePasswordFromMnemonic(mnemonic);

        setStatusMessage('Logging in to Data Store...');
        await mxLogin({ homeServerUrl, username: auth.matrixUserId!, password: mxPassword });

        setStatusMessage('Initializing Data Store...');
        const mxClient = await createMatrixClient();
        mxClientRef.current = mxClient;

        setStatusMessage('Setting up encryption...');
        await repairMatrixEncryption(mxClient, mnemonic);

        // Matrix is ready — clear the mnemonic from secure storage (fetch-use-drop).
        // Future page loads recover the mnemonic via the room bot + PIN if needed.
        secureReset(authConstants.secretKey.MATRIX_MNEMONIC);

        setStatus('success');
        setStatusMessage('Data Store ready');
        fetchMatrixProfile();
        void hydrateDeckPrefsFromMatrix(mxClient).catch((err) => console.warn('Deck prefs hydration failed:', err));
        if (auth.matrixRoomId && auth.address) {
          void initLocalCurrency(mxClient, auth.matrixRoomId, auth.address).catch((err) =>
            console.warn('Local currency resolution failed:', err),
          );
        }
      } catch (err: any) {
        console.error('Matrix setup error:', err);
        setStatus('error');
        setError(err.message || 'Data Store setup failed');
        setErrorDetails(formatEncryptionDiagnostics(err, { stage: 'login' }));
      }
    }
  }, [auth.isLoggedIn, auth.address, auth.matrixUserId, retryCount]);

  /** Fetch the user's encrypted matrix mnemonic. Tries the room bot first (signed
   *  challenge), then falls back to a direct matrix room-state read. */
  const fetchEncryptedMnemonic = useCallback(async (): Promise<string> => {
    const address = auth.address;
    if (!address) throw new Error('Address missing');
    const sessionMnemonic = secureLoad(authConstants.secretKey.SESSION_MNEMONIC);
    const sessionAuthenticatorId = secureLoad(authConstants.secretKey.SESSION_AUTHENTICATOR_ID);

    const roomBotUrl = process.env.NEXT_PUBLIC_MATRIX_ROOM_BOT_URL as string | undefined;
    if (roomBotUrl && sessionMnemonic && sessionAuthenticatorId) {
      try {
        const res = await fetchEncryptedMnemonicFromRoomBot({
          roomBotUrl,
          address,
          sessionMnemonic,
          sessionAuthenticatorId,
        });
        return res.encryptedMnemonic;
      } catch (botErr) {
        console.warn('Room bot recovery failed, falling back to direct room state read:', botErr);
      }
    }

    const homeServerUrl = secret.baseUrl;
    const accessToken = secret.accessToken;
    if (!homeServerUrl || !accessToken) {
      throw new Error('Could not retrieve recovery credentials');
    }
    const res = await fetchEncryptedMnemonicFromRoom({ homeServerUrl, accessToken, address });
    return res.encryptedMnemonic;
  }, [auth.address]);

  const ensureEncryptionReady = useCallback(async (): Promise<void> => {
    // Make sure the provider's setup effect has placed the client into the ref —
    // covers React-strict-mode remounts, HMR, and the small race where the effect
    // hasn't fired yet when a screen mounts and immediately calls this.
    await awaitCompletion();
    const mxClient = mxClientRef.current;
    if (!mxClient) throw new Error('Matrix client not ready');

    const check = await isMatrixEncryptionReady(mxClient);
    if (check.ready) return;

    if (recoveryPendingRef.current) {
      throw new Error('Encryption recovery already in progress');
    }

    setShowDetails(true);
    setStatus('running');
    setStatusMessage('Reconnecting Data Store...');
    setError(null);
    setErrorDetails(null);

    let ciphertext: string;
    try {
      ciphertext = await fetchEncryptedMnemonic();
    } catch (err: any) {
      console.error('Failed to fetch encrypted mnemonic:', err);
      setStatus('error');
      setError(err?.message || 'Could not retrieve recovery credentials');
      setErrorDetails(formatEncryptionDiagnostics(err, { stage: 'recovery' }));
      throw err;
    }

    return await new Promise<void>((resolve, reject) => {
      recoveryPendingRef.current = { ciphertext, resolve, reject };
      setPinPrompt({ ciphertext });
    });
  }, [awaitCompletion, fetchEncryptedMnemonic]);

  const handlePinSubmit = useCallback(async (pin: string) => {
    const pending = recoveryPendingRef.current;
    if (!pending || !mxClientRef.current) {
      throw new Error('No recovery in progress');
    }
    // Throws on bad PIN — caught by PinModal's built-in 3-attempt retry loop.
    const mnemonic = decryptEncryptedMnemonic(pending.ciphertext, pin);

    setPinPrompt(null);
    setStatusMessage('Setting up encryption...');

    try {
      await repairMatrixEncryption(mxClientRef.current, mnemonic);
      setStatus('success');
      setStatusMessage('Data Store ready');
      setShowDetails(false);
      pending.resolve();
    } catch (err: any) {
      console.error('Matrix encryption repair failed:', err);
      setStatus('error');
      setError(err.message || 'Encryption setup failed');
      setErrorDetails(formatEncryptionDiagnostics(err, { stage: 'recovery' }));
      pending.reject(err);
    } finally {
      recoveryPendingRef.current = null;
    }
  }, []);

  const handlePinCancel = useCallback(() => {
    const pending = recoveryPendingRef.current;
    setPinPrompt(null);
    if (pending) {
      setStatus('error');
      setError('Recovery cancelled');
      setErrorDetails(null);
      pending.reject(new Error('Recovery cancelled'));
      recoveryPendingRef.current = null;
    }
  }, []);

  // Stop the retained Matrix client on retry (stale client) and on unmount.
  useEffect(() => {
    return () => {
      if (mxClientRef.current) {
        try {
          mxClientRef.current.stopClient();
        } catch (err) {
          console.warn('Matrix stopClient error:', err);
        }
        mxClientRef.current = null;
      }
    };
  }, [retryCount]);

  return (
    <BackgroundSetupContext.Provider
      value={{
        status,
        statusMessage,
        error,
        errorDetails,
        showDetails,
        setShowDetails,
        awaitCompletion,
        getMatrixClient,
        ensureEncryptionReady,
      }}
    >
      {children}
      {/* Spinner shown during running setup/recovery (but not while PIN modal is up). */}
      {showDetails && status === 'running' && !pinPrompt && (
        <div
          onClick={() => setShowDetails(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1500,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(30, 22, 38, 0.44)',
            backdropFilter: 'blur(4px)',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: 'var(--surface, #fff)',
              borderRadius: 26,
              boxShadow: 'var(--shadow-card)',
              padding: '32px 28px',
              maxWidth: 340,
              width: '90%',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                border: '3px solid var(--border-color)',
                borderTopColor: 'var(--accent-color, #3b82f6)',
                borderRadius: '50%',
                animation: 'bgSetupSpin 0.8s linear infinite',
                margin: '0 auto 16px',
              }}
            />
            <p style={{ color: 'var(--text-primary)', margin: 0, fontSize: 15 }}>{statusMessage}</p>
            <style>{`@keyframes bgSetupSpin { to { transform: rotate(360deg); } }`}</style>
          </div>
        </div>
      )}
      {pinPrompt && (
        <PinModal
          onSuccess={handlePinSubmit}
          onCancel={handlePinCancel}
          helper='Enter your Data Store PIN to restore encryption'
        />
      )}
      {showDetails && status === 'error' && (
        <div
          onClick={() => setShowDetails(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1500,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(30, 22, 38, 0.44)',
            backdropFilter: 'blur(4px)',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: 'var(--surface, #fff)',
              borderRadius: 26,
              boxShadow: 'var(--shadow-card)',
              padding: '28px 24px',
              maxWidth: 360,
              width: '90%',
              maxHeight: '85vh',
              overflowY: 'auto',
              textAlign: 'center',
            }}
          >
            <p style={{ color: 'var(--error-color)', margin: '0 0 16px', fontSize: 14 }}>{error}</p>

            {errorDetails && (
              <>
                <button
                  onClick={() => setShowErrorDetails((s) => !s)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    fontSize: 12,
                    marginBottom: showErrorDetails ? 8 : 16,
                    textDecoration: 'underline',
                  }}
                >
                  {showErrorDetails ? 'Hide details ▲' : 'Show details ▼'}
                </button>

                {showErrorDetails && (
                  <div
                    style={{
                      maxHeight: '40vh',
                      overflowY: 'auto',
                      backgroundColor: 'var(--bg-primary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 8,
                      padding: '12px',
                      marginBottom: 16,
                    }}
                  >
                    <pre
                      style={{
                        margin: 0,
                        textAlign: 'left',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        fontSize: 11,
                        lineHeight: 1.5,
                        color: 'var(--text-secondary)',
                        fontFamily: 'monospace',
                      }}
                    >
                      {errorDetails}
                    </pre>
                  </div>
                )}
              </>
            )}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
              {errorDetails && (
                <button
                  onClick={handleCopyDetails}
                  style={{
                    padding: '10px 20px',
                    borderRadius: 8,
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'transparent',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    fontSize: 14,
                  }}
                >
                  {copied ? 'Copied!' : 'Copy details'}
                </button>
              )}
              <button
                onClick={() => {
                  setupAttemptedRef.current = false;
                  setShowDetails(false);
                  setShowErrorDetails(false);
                  setCopied(false);
                  setRetryCount((c) => c + 1);
                }}
                style={{
                  padding: '10px 24px',
                  borderRadius: 8,
                  border: 'none',
                  backgroundColor: 'var(--accent-color, #3b82f6)',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: 14,
                }}
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      )}
    </BackgroundSetupContext.Provider>
  );
};
