import { useState, useEffect, useRef, useCallback, HTMLAttributes } from 'react';

import { AuthContext } from '@contexts/auth';
import authConstants from '@constants/auth';
import { secureSave, secureLoad, secureReset } from '@utils/storage';
import { secret } from '@utils/secrets';
import { logoutMatrixClient } from '@utils/matrix';
import { clearDeckPrefsStorage } from '@utils/deckPrefs';
import { clearLocalCurrencyStorage } from '@utils/localCurrency';
import { cleanUrlString } from '@utils/url';
import { clearReturnTo, saveReturnTo, suppressReturnTo } from '@utils/returnTo';
import { clearLinkState, clearYref } from '@utils/yomaLink';
import { signAndBroadcastWithSessionKey } from 'lib/authHub/signAndBroadcast';
import type { AuthHubSessionData } from 'lib/authHub/redirect';
import { store, persistor } from '@store/index';
import { setAccount, clearAccount } from '@store/slices/accountSlice';
import { clearEntities } from '@store/slices/entitiesSlice';
import { clearCollections } from '@store/slices/collectionsSlice';
import { clearProtocols } from '@store/slices/protocolsSlice';
import { clearProfiles } from '@store/slices/profilesSlice';
import { setMatrixProfile, clearMatrixProfile } from '@store/slices/matrixProfileSlice';
import { clearAllDrafts } from '@store/slices/claimDraftsSlice';
import { clearProjects } from '@store/slices/projectsSlice';
import { clearKycData } from '@store/slices/kycSlice';

const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours
const AUTH_VERSION = '2'; // Bump to force clean break from passkey-based accounts

/** Fetch own Matrix displayname/avatar into the store. No-ops until the Matrix
 *  session tokens exist, so backgroundSetup re-invokes it after Matrix login. */
export function fetchMatrixProfile() {
  try {
    const baseUrl = secret.baseUrl;
    const accessToken = secret.accessToken;
    const userId = secret.userId;
    if (!baseUrl || !accessToken || !userId) return;

    fetch(cleanUrlString(`${baseUrl}/_matrix/client/v3/profile/${encodeURIComponent(userId)}`), {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        const avatarUrl = data.avatar_url
          ? cleanUrlString(
              `${baseUrl}/_matrix/media/v3/thumbnail/${data.avatar_url.replace('mxc://', '')}?width=96&height=96&method=crop`,
            )
          : null;
        store.dispatch(setMatrixProfile({ displayName: data.displayname ?? null, avatarUrl }));
      })
      .catch((err) => console.warn('Matrix profile fetch failed:', err));
  } catch (err) {
    console.warn('Matrix profile fetch failed:', err);
  }
}

function isSessionExpired(): boolean {
  const createdAt = secureLoad(authConstants.secretKey.SESSION_CREATED_AT);
  if (!createdAt) return true;
  return Date.now() - Number(createdAt) > SESSION_MAX_AGE_MS;
}

export const AuthProvider = ({ children }: HTMLAttributes<HTMLDivElement>) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [address, setAddress] = useState<string | null>(null);
  const [did, setDid] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [sessionAuthenticatorId, setSessionAuthenticatorId] = useState<string | null>(null);
  const [matrixUserId, setMatrixUserId] = useState<string | null>(null);
  const [matrixRoomId, setMatrixRoomId] = useState<string | null>(null);

  // Refs for stable callback access
  const stateRef = useRef({ address, sessionAuthenticatorId });
  stateRef.current = { address, sessionAuthenticatorId };

  function persistAuthState(data: AuthHubSessionData) {
    secureSave(authConstants.secretKey.ADDRESS, data.address);
    secureSave(authConstants.secretKey.DID, data.did);
    if (data.sessionMnemonic) secureSave(authConstants.secretKey.SESSION_MNEMONIC, data.sessionMnemonic);
    if (data.sessionAuthenticatorId)
      secureSave(authConstants.secretKey.SESSION_AUTHENTICATOR_ID, data.sessionAuthenticatorId);
    if (data.edSigningMnemonic) secureSave(authConstants.secretKey.ED_SIGNING_MNEMONIC, data.edSigningMnemonic);
    if (data.matrixMnemonic) secureSave(authConstants.secretKey.MATRIX_MNEMONIC, data.matrixMnemonic);
    if (data.matrixUserId) secureSave(authConstants.secretKey.MATRIX_USER_ID, data.matrixUserId);
    if (data.matrixRoomId) secureSave(authConstants.secretKey.MATRIX_ROOM_ID, data.matrixRoomId);
    if (data.displayName) secureSave(authConstants.secretKey.DISPLAY_NAME, data.displayName);
    if (data.email) secureSave(authConstants.secretKey.EMAIL, data.email);
    secureSave(authConstants.secretKey.SESSION_CREATED_AT, String(Date.now()));
  }

  function clearAuthStorage() {
    Object.values(authConstants.secretKey).forEach((key) => secureReset(key));
  }

  function clearAllState() {
    clearAuthStorage();
    // Wipe deck prefs for ALL accounts: if the next user's Matrix session fails,
    // the localStorage fallback must not surface the previous user's deck.
    clearDeckPrefsStorage();
    clearLocalCurrencyStorage();
    setIsLoggedIn(false);
    setAddress(null);
    setDid(null);
    setDisplayName(null);
    setEmail(null);
    setSessionAuthenticatorId(null);
    setMatrixUserId(null);
    setMatrixRoomId(null);
    store.dispatch(clearAccount());
    store.dispatch(clearEntities());
    store.dispatch(clearCollections());
    store.dispatch(clearProtocols());
    store.dispatch(clearProfiles());
    store.dispatch(clearMatrixProfile());
    store.dispatch(clearAllDrafts());
    store.dispatch(clearProjects());
    store.dispatch(clearKycData());
  }

  // Auth version migration guard + session revival
  useEffect(() => {
    try {
      // Clean break: wipe old passkey-based state if auth version changed
      const storedVersion = localStorage.getItem('auth_version');
      if (storedVersion !== AUTH_VERSION) {
        console.info('Auth version changed — clearing old auth state');
        clearAllState();
        persistor.purge();
        localStorage.setItem('auth_version', AUTH_VERSION);
        return;
      }

      const persistedAccount = store.getState().account;
      if (!persistedAccount?.address) {
        clearAuthStorage();
        return;
      }

      // Validate secure storage matches Redux
      const storedAddress = secureLoad(authConstants.secretKey.ADDRESS);
      const storedDid = secureLoad(authConstants.secretKey.DID);
      const storedSessionMnemonic = secureLoad(authConstants.secretKey.SESSION_MNEMONIC);

      if (persistedAccount.address !== storedAddress || persistedAccount.did !== storedDid || !storedSessionMnemonic) {
        console.warn('Secure storage does not match Redux account — logging out');
        clearAllState();
        return;
      }

      // Check session expiry
      if (isSessionExpired()) {
        console.info('Session expired — logging out');
        clearAllState();
        return;
      }

      // Restore React state
      setAddress(persistedAccount.address);
      setDid(persistedAccount.did);
      setDisplayName(persistedAccount.displayName ?? null);
      // Optional — sessions created before the auth hub returned an email
      // simply have none until the next login.
      setEmail(persistedAccount.email ?? null);
      setSessionAuthenticatorId(persistedAccount.sessionAuthenticatorId ?? null);
      setMatrixUserId(persistedAccount.matrixUserId ?? null);
      setMatrixRoomId(persistedAccount.matrixRoomId ?? null);
      setIsLoggedIn(true);
      fetchMatrixProfile();
    } catch (error) {
      console.error('Session revival failed:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loginWithAuthHub = useCallback((data: AuthHubSessionData) => {
    setAddress(data.address);
    setDid(data.did);
    setDisplayName(data.displayName);
    setEmail(data.email ?? null);
    setSessionAuthenticatorId(data.sessionAuthenticatorId);
    setMatrixUserId(data.matrixUserId);
    setMatrixRoomId(data.matrixRoomId);
    persistAuthState(data);
    setIsLoggedIn(true);
    store.dispatch(
      setAccount({
        address: data.address,
        did: data.did,
        signingMethod: 'session_key',
        sessionAuthenticatorId: data.sessionAuthenticatorId,
        displayName: data.displayName,
        email: data.email ?? null,
        matrixUserId: data.matrixUserId,
        matrixRoomId: data.matrixRoomId,
      }),
    );
    fetchMatrixProfile();
  }, []);

  const [signingState, setSigningState] = useState<{ visible: boolean; label: string }>({ visible: false, label: '' });
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  function getTxLabel(messages: any[]): string {
    if (!messages?.length) return 'Transaction';
    const typeUrl = messages[0]?.typeUrl || '';
    if (typeUrl.includes('MsgExec')) {
      const innerMsgs = messages[0]?.value?.msgs;
      if (innerMsgs?.length) {
        const inner = innerMsgs[0]?.typeUrl || '';
        if (inner.includes('MsgSubmitClaim')) return 'Submit Claim';
        if (inner.includes('MsgEvaluateClaim')) return 'Evaluate Claim';
        return inner.split('.').pop() || 'Transaction';
      }
    }
    if (typeUrl.includes('MsgAddVerification')) return 'Register Signing Key';
    if (typeUrl.includes('MsgGrantEntityAccountAuthz')) return 'Grant Authorization';
    return typeUrl.split('.').pop() || 'Transaction';
  }

  const onSign = useCallback(async (messages: any[]) => {
    const { address: addr, sessionAuthenticatorId: authId } = stateRef.current;

    if (!addr || !authId) {
      throw new Error('Not authenticated');
    }

    // Check session expiry before signing
    if (isSessionExpired()) {
      clearAllState();
      window.location.href = '/auth';
      throw new Error('Session expired — please sign in again');
    }

    const sessionMnemonic = secureLoad(authConstants.secretKey.SESSION_MNEMONIC);
    if (!sessionMnemonic) {
      throw new Error('Session key not found — please sign in again');
    }

    const label = getTxLabel(messages);
    setSigningState({ visible: true, label });

    try {
      const result = await signAndBroadcastWithSessionKey({
        address: addr,
        messages,
        sessionMnemonic,
        sessionAuthenticatorId: authId,
      });

      setSigningState({ visible: false, label: '' });
      return result;
    } catch (err) {
      setSigningState({ visible: false, label: '' });
      throw err;
    }
  }, []);

  const logout = useCallback(async (options?: { preserveReturnTo?: boolean }) => {
    const preserveReturnTo = options?.preserveReturnTo ?? false;
    if (preserveReturnTo) {
      // "Switch account" logout (Yoma wrong-account prompt): the next sign-in
      // SHOULD land back on this page, so save it explicitly and leave the
      // yref hand-off marker in place for the re-comparison. Only the
      // previous account's link cache is wiped.
      saveReturnTo(window.location.pathname + window.location.search);
    } else {
      // Clean-break logout: before any state flips, wipe the saved deep link
      // and block re-saves — AuthGuard reacts to the logged-out flip below
      // and would otherwise capture the page the user logged out from (see
      // utils/returnTo.ts). Also drop any Yoma hand-off marker: on a shared
      // computer the next person must not inherit it.
      suppressReturnTo();
      clearYref();
    }
    // Either way, the per-account Yoma link cache and session-check flag
    // belong to the account signing out — never to the next login.
    clearLinkState();
    setIsLoggingOut(true);

    // Overall safety net: never let matrix cleanup block the redirect for more than 8s.
    // Individual matrix steps already have their own timeouts (logoutMatrixClient), but
    // a misbehaving promise should still not strand the user on this screen.
    const matrixCleanup = logoutMatrixClient({ baseUrl: secret.baseUrl }).catch((err) => {
      console.warn('Matrix logout failed (continuing):', err);
    });
    const safety = new Promise<void>((resolve) => setTimeout(resolve, 8000));
    await Promise.race([matrixCleanup, safety]);

    clearAllState();
    try {
      await Promise.race([persistor.purge(), new Promise<void>((resolve) => setTimeout(resolve, 2000))]);
    } catch (err) {
      console.warn('persistor.purge failed (continuing):', err);
    }

    // Clean break only — drop any deep link AuthGuard saved while this
    // page's auth state flipped (e.g. /settings), so the next sign-in starts
    // fresh instead of resuming where the user logged out. The switch-account
    // variant deliberately keeps its explicitly saved return path.
    if (!preserveReturnTo) clearReturnTo();

    window.location.href = '/auth';
  }, []);

  const value = {
    isLoggedIn,
    isLoading,
    address,
    did,
    displayName,
    email,
    sessionAuthenticatorId,
    matrixUserId,
    matrixRoomId,
    loginWithAuthHub,
    onSign,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
      {signingState.visible && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 2000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(30, 22, 38, 0.44)',
            backdropFilter: 'blur(4px)',
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--surface, #fff)',
              borderRadius: 16,
              padding: '32px 28px',
              maxWidth: 340,
              width: '90%',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 20,
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                border: '3px solid var(--border-color)',
                borderTopColor: 'var(--accent-color)',
                borderRadius: '50%',
                animation: 'authSpinner 0.8s linear infinite',
              }}
            />
            <div>
              <p style={{ color: 'var(--text-primary)', fontSize: 16, fontWeight: 600, margin: 0 }}>
                Signing Transaction
              </p>
              <p style={{ color: 'var(--text-secondary)', fontSize: 14, margin: '8px 0 0' }}>{signingState.label}</p>
            </div>
          </div>
          <style>{`
            @keyframes authSpinner {
              to { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      )}
      {isLoggingOut && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 2100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(30, 22, 38, 0.44)',
            backdropFilter: 'blur(4px)',
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--surface, #fff)',
              borderRadius: 16,
              padding: '32px 28px',
              maxWidth: 340,
              width: '90%',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 20,
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                border: '3px solid var(--border-color)',
                borderTopColor: 'var(--accent-color)',
                borderRadius: '50%',
                animation: 'authSpinner 0.8s linear infinite',
              }}
            />
            <div>
              <p style={{ color: 'var(--text-primary)', fontSize: 16, fontWeight: 600, margin: 0 }}>Signing out…</p>
              <p style={{ color: 'var(--text-secondary)', fontSize: 14, margin: '8px 0 0' }}>
                Please wait while we log you out.
              </p>
            </div>
          </div>
          <style>{`
            @keyframes authSpinner {
              to { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      )}
    </AuthContext.Provider>
  );
};
