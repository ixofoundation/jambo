import { FC, ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import type { MatrixClient } from 'matrix-js-sdk';
import { BackgroundSetupContext, BackgroundSetupStatus } from '@contexts/backgroundSetup';
import { useAuth } from '@hooks/useAuth';
import {
  mxLogin,
  createMatrixClient,
  setupCrossSigning,
  generatePasswordFromMnemonic,
  generateRecoveryPhraseFromMnemonic,
} from '@utils/matrix';
import { secret } from '@utils/secrets';
import { secureLoad, secureReset } from '@utils/storage';
import authConstants from '@constants/auth';

interface BackgroundSetupProviderProps {
  children: ReactNode;
}

export const BackgroundSetupProvider: FC<BackgroundSetupProviderProps> = ({ children }) => {
  const auth = useAuth();
  const [status, setStatus] = useState<BackgroundSetupStatus>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const awaitersRef = useRef<Array<{ resolve: () => void; reject: (err: Error) => void }>>([]);
  const statusRef = useRef<BackgroundSetupStatus>('idle');
  const setupAttemptedRef = useRef(false);
  const mxClientRef = useRef<MatrixClient | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const getMatrixClient = useCallback(() => mxClientRef.current, []);

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
    if (current === 'success' || current === 'idle') {
      return Promise.resolve();
    }
    if (current === 'error') {
      return Promise.reject(new Error('Data Store setup failed'));
    }
    setShowDetails(true);
    return new Promise<void>((resolve, reject) => {
      awaitersRef.current.push({ resolve, reject });
    });
  }, []);

  // Auto-setup Matrix when user is authenticated
  useEffect(() => {
    if (!auth.isLoggedIn || !auth.address || !auth.matrixUserId) return;
    if (setupAttemptedRef.current) return;

    // If tokens already exist from a prior session, reattach by creating a client
    // without re-running login or cross-signing setup.
    if (secret.accessToken && secret.userId) {
      setupAttemptedRef.current = true;
      void reattachMatrix();
      return;
    }

    // Fetch mnemonic from secure storage (not React state)
    const matrixMnemonic = secureLoad(authConstants.secretKey.MATRIX_MNEMONIC);
    if (!matrixMnemonic) {
      // No mnemonic and no active session — can't set up Matrix
      console.warn('Matrix mnemonic not available in secure storage');
      return;
    }

    setupAttemptedRef.current = true;
    void setupMatrix(matrixMnemonic);

    async function reattachMatrix() {
      setStatus('running');
      setStatusMessage('Reconnecting to Data Store...');
      setError(null);

      try {
        const mxClient = await createMatrixClient();
        mxClientRef.current = mxClient;
        setStatus('success');
        setStatusMessage('Data Store ready');
      } catch (err: any) {
        console.error('Matrix reattach error:', err);
        setStatus('error');
        setError(err.message || 'Data Store reattach failed');
      }
    }

    async function setupMatrix(mnemonic: string) {
      setStatus('running');
      setStatusMessage('Connecting to Data Store...');
      setError(null);

      try {
        const homeServerUrl = process.env.NEXT_PUBLIC_MATRIX_HOMESERVER_URL as string;
        const mxPassword = generatePasswordFromMnemonic(mnemonic);
        const securityPhrase = generateRecoveryPhraseFromMnemonic(mnemonic);

        setStatusMessage('Logging in to Data Store...');
        await mxLogin({ homeServerUrl, username: auth.matrixUserId!, password: mxPassword });

        setStatusMessage('Initializing Data Store...');
        const mxClient = await createMatrixClient();
        mxClientRef.current = mxClient;

        try {
          setStatusMessage('Setting up encryption...');
          await setupCrossSigning(mxClient, { securityPhrase, password: mxPassword });
        } catch (err) {
          // Cross-signing may fail if already set up — non-fatal
          console.warn('Cross-signing setup:', err);
        }

        // Matrix is ready — clear the mnemonic from secure storage (fetch-use-drop)
        secureReset(authConstants.secretKey.MATRIX_MNEMONIC);

        setStatus('success');
        setStatusMessage('Data Store ready');
      } catch (err: any) {
        console.error('Matrix setup error:', err);
        setStatus('error');
        setError(err.message || 'Data Store setup failed');
      }
    }
  }, [auth.isLoggedIn, auth.address, auth.matrixUserId, retryCount]);

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
        showDetails,
        setShowDetails,
        awaitCompletion,
        getMatrixClient,
      }}
    >
      {children}
      {/* Show a minimal status indicator when details are requested */}
      {showDetails && status === 'running' && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1500,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(4px)',
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--bg-secondary)',
              borderRadius: 16,
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
      {showDetails && status === 'error' && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1500,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(4px)',
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--bg-secondary)',
              borderRadius: 16,
              padding: '28px 24px',
              maxWidth: 340,
              width: '90%',
              textAlign: 'center',
            }}
          >
            <p style={{ color: 'var(--error-color)', margin: '0 0 16px', fontSize: 14 }}>{error}</p>
            <button
              onClick={() => {
                setupAttemptedRef.current = false;
                setShowDetails(false);
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
      )}
    </BackgroundSetupContext.Provider>
  );
};
