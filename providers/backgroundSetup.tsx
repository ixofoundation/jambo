import { FC, ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { HttpApiEvent } from 'matrix-js-sdk';
import type { MatrixClient } from 'matrix-js-sdk';
import { BackgroundSetupContext, BackgroundSetupStatus } from '@contexts/backgroundSetup';
import { useAuth } from '@hooks/useAuth';
import PinModal from '@components/PinModal/PinModal';
import {
  mxLogin,
  createMatrixClient,
  generatePasswordFromMnemonic,
  isCryptoStoreMismatchError,
  isMatrixSessionInvalidError,
  resetLocalMatrixSession,
  stopAllMatrixClients,
  stopMatrixClient,
} from '@utils/matrix';
import { acquireSessionLock, claimSessionLock, releaseSessionLock, SessionLockLostReason } from '@utils/sessionLock';
import {
  isMatrixEncryptionReady,
  repairMatrixEncryption,
  formatEncryptionDiagnostics,
} from '@utils/matrixEncryptionRepair';
import { initialiseDehydrationIfEnabled } from '@utils/dehydration';
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
import { track } from 'lib/analytics/client';
import { AnalyticsEvents } from 'lib/analytics/events';

interface BackgroundSetupProviderProps {
  children: ReactNode;
}

interface RecoveryPending {
  ciphertext: string;
  resolve: () => void;
  reject: (err: Error) => void;
}

const SESSION_ENDED_MESSAGE = 'Your Data Store session has ended. Please sign in again.';
const OPEN_IN_ANOTHER_TAB_MESSAGE = 'The Data Store is open in another tab. Close that tab, or use it here.';
const SETUP_AGAIN_MESSAGE = 'Your Data Store needs to be set up again. Please sign in again.';

export const BackgroundSetupProvider: FC<BackgroundSetupProviderProps> = ({ children }) => {
  const auth = useAuth();
  const router = useRouter();
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
  // Another tab runs the Data Store: the error modal offers "Use here".
  const [lockConflict, setLockConflict] = useState(false);
  // Bumped on every setup attempt; results of older attempts are ignored.
  const attemptRef = useRef(0);
  // Unsubscribes the current client's SessionLoggedOut listener.
  const detachClientRef = useRef<(() => void) | null>(null);
  // The session-ended / setup-again sign-out runs once per page.
  const signOutStartedRef = useRef(false);
  const logoutRef = useRef(auth.logout);
  logoutRef.current = auth.logout;

  const getMatrixClient = useCallback(() => mxClientRef.current, []);

  /** Sign out once per page (session ended, foreign or unusable Data Store session). */
  const signOutOnce = useCallback(async () => {
    if (signOutStartedRef.current) return;
    signOutStartedRef.current = true;
    await logoutRef.current();
  }, []);

  /** Stop this tab's Data Store client(s) and forget the current one. Ends a pending PIN recovery. */
  const stopLocalClient = useCallback(() => {
    detachClientRef.current?.();
    detachClientRef.current = null;
    mxClientRef.current = null;
    void stopAllMatrixClients();
    setPinPrompt(null);
    const pending = recoveryPendingRef.current;
    recoveryPendingRef.current = null;
    pending?.reject(new Error('Data Store was stopped during recovery'));
  }, []);

  const showError = useCallback((message: string, details: string | null = null) => {
    setStatus('error');
    setError(message);
    setErrorDetails(details);
  }, []);

  /** Another tab holds (or took) the Data Store lock. */
  const handleLockedElsewhere = useCallback(() => {
    attemptRef.current += 1;
    stopLocalClient();
    setLockConflict(true);
    showError(OPEN_IN_ANOTHER_TAB_MESSAGE);
    setShowDetails(true);
  }, [stopLocalClient, showError]);

  /**
   * The Matrix device of this session was signed out server-side (M_UNKNOWN_TOKEN). Signs the
   * user out so the next sign-in creates a fresh Data Store session — unless the revoked device
   * is no longer the saved session (another tab already signed out or signed in again), in which
   * case only this tab's stale client is stopped: signing out here would wipe that newer session.
   */
  const handleSessionEnded = useCallback(
    (revokedDeviceId: string | null | undefined) => {
      attemptRef.current += 1;
      stopLocalClient();
      setLockConflict(false);
      showError(SESSION_ENDED_MESSAGE);
      setShowDetails(true);
      if (revokedDeviceId && revokedDeviceId !== secret.deviceId) {
        console.warn('Data Store session ended for a device that is no longer the saved session; not signing out');
        return;
      }
      void signOutOnce();
    },
    [stopLocalClient, showError, signOutOnce],
  );

  /** Lock-lost callback: stop the client so this tab no longer holds the crypto store open. */
  const handleLockLost = useCallback(
    (reason: SessionLockLostReason) => {
      if (reason === 'cleared' && !secret.accessToken) {
        // Another tab signed out and no Data Store session is saved any more: sign this tab out
        // too, so it lands on the sign-in page like the other one.
        attemptRef.current += 1;
        stopLocalClient();
        setLockConflict(false);
        showError(SESSION_ENDED_MESSAGE);
        setShowDetails(true);
        void signOutOnce();
        return;
      }
      // Taken over by another tab — or cleared by a sign-out after which another tab has already
      // signed in again (tokens saved): either way the Data Store now belongs to another tab.
      console.warn(`Data Store taken over by another tab (${reason}), stopping this tab`);
      handleLockedElsewhere();
    },
    [stopLocalClient, showError, handleLockedElsewhere, signOutOnce],
  );

  /** Keep a ready client and sign out if the homeserver later revokes its token. */
  const attachClient = useCallback(
    (mxClient: MatrixClient) => {
      detachClientRef.current?.();
      mxClientRef.current = mxClient;
      const onSessionLoggedOut = () => {
        console.warn('Data Store session logged out by the homeserver (M_UNKNOWN_TOKEN)');
        handleSessionEnded(mxClient.getDeviceId());
      };
      mxClient.on(HttpApiEvent.SessionLoggedOut, onSessionLoggedOut);
      detachClientRef.current = () => {
        mxClient.removeListener(HttpApiEvent.SessionLoggedOut, onSessionLoggedOut);
      };
    },
    [handleSessionEnded],
  );

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
  // Both paths first take the cross-tab session lock: only one tab runs the client, because
  // the rust crypto store cannot be shared or deleted while another tab holds it open.
  const isAuthCallbackPage = router.pathname === '/auth/callback';
  useEffect(() => {
    if (!auth.isLoggedIn || !auth.address || !auth.matrixUserId) return;
    // Namespace deck prefs to this account as soon as we know who's logged in —
    // this must happen even when Matrix never comes up (dev bypass, outages).
    activateDeckPrefs(auth.address);
    // Never start the Data Store on the auth callback page. It logs in and then always ends in a
    // full-page `window.location.replace`, which would tear down an in-flight Matrix login: the
    // homeserver mints a device ("JAMBO CLAIMS") the page never gets to use, and the fresh-login
    // path would start in this document and be observed half-done in the next. The next document
    // (the landing page) runs the setup instead.
    if (isAuthCallbackPage) return;
    if (setupAttemptedRef.current) return;

    const hasMatrixTokens = !!secret.accessToken && !!secret.userId;
    const matrixMnemonic = secureLoad(authConstants.secretKey.MATRIX_MNEMONIC);

    if (!hasMatrixTokens && !matrixMnemonic) {
      console.warn('Matrix mnemonic not available in secure storage and no existing session');
      return;
    }

    setupAttemptedRef.current = true;
    const attempt = ++attemptRef.current;
    const isCurrent = () => attempt === attemptRef.current;
    setLockConflict(false);

    // Data Store tokens saved for a different account than the one signed in (a previous learner
    // on a shared device: session expiry and the auth migration clear only the auth keys) must
    // never be reattached for this learner.
    const normaliseUserId = (id: string | null | undefined) => (id ?? '').trim().toLowerCase();
    const savedUserId: string | undefined = secret.userId;
    const tokensBelongToAnotherAccount =
      hasMatrixTokens && normaliseUserId(savedUserId) !== normaliseUserId(auth.matrixUserId);

    if (tokensBelongToAnotherAccount) {
      void replaceForeignSession();
    } else if (hasMatrixTokens) {
      void reattachMatrix();
    } else if (matrixMnemonic) {
      void setupMatrix(matrixMnemonic);
    }

    async function replaceForeignSession() {
      console.warn(
        `Saved Data Store session belongs to ${savedUserId}, but ${auth.matrixUserId} is signed in; discarding it`,
      );
      setStatus('running');
      setStatusMessage('Connecting to Data Store...');
      setError(null);
      setErrorDetails(null);
      try {
        await resetLocalMatrixSession();
      } catch (err) {
        console.warn('Data Store reset failed:', err);
      }
      if (!isCurrent()) return;
      if (matrixMnemonic) {
        await setupMatrix(matrixMnemonic);
        return;
      }
      // No mnemonic to log in with: sign out so the next sign-in provides one.
      attemptRef.current += 1;
      setLockConflict(false);
      showError(SESSION_ENDED_MESSAGE);
      setShowDetails(true);
      void signOutOnce();
    }

    /** Errors shared by both paths. Returns true when handled. */
    async function handleStartError(err: any): Promise<boolean> {
      // This tab no longer runs a client: let another tab take the Data Store. Retry re-acquires.
      releaseSessionLock();
      if (isMatrixSessionInvalidError(err)) {
        handleSessionEnded(secret.deviceId);
        return true;
      }
      if (isCryptoStoreMismatchError(err)) {
        // Still mismatched after createMatrixClient's one self-heal retry: retrying cannot help.
        // Sign out, so the next sign-in runs the fresh-login path. logout() runs
        // logoutMatrixClient, which does everything resetLocalMatrixSession does (stop clients,
        // drop keys, clear the tokens first, delete the stores) and also revokes this device on
        // the homeserver — a reset first would drop the tokens needed for that revoke.
        console.error('Data Store crypto store still mismatched after self-heal; signing out:', err);
        showError(
          SETUP_AGAIN_MESSAGE,
          formatEncryptionDiagnostics(err, { stage: hasMatrixTokens ? 'reattach' : 'login' }),
        );
        await signOutOnce();
        return true;
      }
      return false;
    }

    async function reattachMatrix() {
      setStatus('running');
      setStatusMessage('Reconnecting to Data Store...');
      setError(null);
      setErrorDetails(null);

      try {
        if (!(await acquireSessionLock(handleLockLost))) {
          if (isCurrent()) handleLockedElsewhere();
          return;
        }
        if (!isCurrent()) return;
        const mxClient = await createMatrixClient();
        if (!isCurrent()) {
          void stopMatrixClient(mxClient);
          return;
        }
        attachClient(mxClient);
        setStatus('success');
        setStatusMessage('Data Store ready');
        // No mnemonic here, so secret storage can't be unlocked: only continue dehydration
        // when this device already cached the dehydration key. Users without one get it on
        // their next fresh login (setupMatrix) or PIN recovery (handlePinSubmit).
        void initialiseDehydrationIfEnabled(mxClient, { onlyIfKeyCached: true, rehydrate: false });
        fetchMatrixProfile();
        void hydrateDeckPrefsFromMatrix(mxClient).catch((err) => console.warn('Deck prefs hydration failed:', err));
        if (auth.matrixRoomId && auth.address) {
          void initLocalCurrency(mxClient, auth.matrixRoomId, auth.address).catch((err) =>
            console.warn('Local currency resolution failed:', err),
          );
        }
      } catch (err: any) {
        if (!isCurrent()) return;
        console.error('Matrix reattach error:', err);
        if (await handleStartError(err)) return;
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
        if (!(await acquireSessionLock(handleLockLost))) {
          if (isCurrent()) handleLockedElsewhere();
          return;
        }
        if (!isCurrent()) return;
        const homeServerUrl = process.env.NEXT_PUBLIC_MATRIX_HOMESERVER_URL as string;
        const mxPassword = generatePasswordFromMnemonic(mnemonic);

        // A fresh login must never open what an earlier session left behind (its crypto store
        // is bound to another device): wipe the local Data Store session first.
        await resetLocalMatrixSession();
        if (!isCurrent()) return;

        setStatusMessage('Logging in to Data Store...');
        await mxLogin({ homeServerUrl, username: auth.matrixUserId!, password: mxPassword });
        if (!isCurrent()) return;

        setStatusMessage('Initializing Data Store...');
        const mxClient = await createMatrixClient();
        if (!isCurrent()) {
          void stopMatrixClient(mxClient);
          return;
        }
        attachClient(mxClient);

        setStatusMessage('Setting up encryption...');
        await repairMatrixEncryption(mxClient, mnemonic);
        if (!isCurrent()) return;

        // Matrix is ready — clear the mnemonic from secure storage (fetch-use-drop).
        // Future page loads recover the mnemonic via the room bot + PIN if needed.
        secureReset(authConstants.secretKey.MATRIX_MNEMONIC);

        setStatus('success');
        setStatusMessage('Data Store ready');
        // First-time Data Store bootstrap after a fresh login (reattach on later boots is not this).
        track(AnalyticsEvents.VaultSetupCompleted);
        // Secret storage is unlocked (repair primed the 4S key): rehydrate any existing
        // dehydrated device and upload a fresh one. Runs in the background, never throws.
        void initialiseDehydrationIfEnabled(mxClient);
        fetchMatrixProfile();
        void hydrateDeckPrefsFromMatrix(mxClient).catch((err) => console.warn('Deck prefs hydration failed:', err));
        if (auth.matrixRoomId && auth.address) {
          void initLocalCurrency(mxClient, auth.matrixRoomId, auth.address).catch((err) =>
            console.warn('Local currency resolution failed:', err),
          );
        }
      } catch (err: any) {
        if (!isCurrent()) return;
        console.error('Matrix setup error:', err);
        if (await handleStartError(err)) return;
        setStatus('error');
        setError(err.message || 'Data Store setup failed');
        setErrorDetails(formatEncryptionDiagnostics(err, { stage: 'login' }));
      }
    }
  }, [
    auth.isLoggedIn,
    auth.address,
    auth.matrixUserId,
    retryCount,
    isAuthCallbackPage,
    // Stable callbacks (their own deps never change), listed for the hooks lint rule.
    attachClient,
    handleLockLost,
    handleLockedElsewhere,
    handleSessionEnded,
    showError,
    signOutOnce,
  ]);

  /** "Use here": take the lock from the other tab (it stops its client), then set up again. */
  const handleUseHere = useCallback(async () => {
    setShowErrorDetails(false);
    setCopied(false);
    setStatus('running');
    setStatusMessage('Moving the Data Store to this tab...');
    setError(null);
    setErrorDetails(null);
    const claimed = await claimSessionLock(handleLockLost);
    if (!claimed) {
      handleLockedElsewhere();
      return;
    }
    setLockConflict(false);
    setupAttemptedRef.current = false;
    setRetryCount((c) => c + 1);
  }, [handleLockLost, handleLockedElsewhere]);

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
    if (!mxClient) throw new Error('Data Store is not ready');

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
      void initialiseDehydrationIfEnabled(mxClientRef.current);
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

  // Stop the retained Matrix client on retry (stale client) and on unmount. stopMatrixClient
  // also closes its stores, so a retry never opens them while this tab still holds them.
  useEffect(() => {
    return () => {
      detachClientRef.current?.();
      detachClientRef.current = null;
      if (mxClientRef.current) {
        void stopMatrixClient(mxClientRef.current);
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
              {lockConflict && (
                <button
                  onClick={() => void handleUseHere()}
                  style={{
                    padding: '10px 24px',
                    borderRadius: 8,
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'transparent',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    fontSize: 14,
                  }}
                >
                  Use here
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
