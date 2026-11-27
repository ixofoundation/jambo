import { useState, useEffect, useRef, useCallback, HTMLAttributes } from 'react';

import { AuthContext, type OnSignOptions } from '@contexts/auth';
import authConstants from '@constants/auth';
import { secureSave, secureLoad, secureReset } from '@utils/storage';
import { secret } from '@utils/secrets';
import { logoutMatrixClient } from '@utils/matrix';
import { clearDeckPrefsStorage } from '@utils/deckPrefs';
import { clearLocalCurrencyStorage } from '@utils/localCurrency';
import { cleanUrlString } from '@utils/url';
import { clearReturnTo, saveReturnTo, suppressReturnTo } from '@utils/returnTo';
import { clearLinkState, clearYref } from '@utils/yomaLink';
import { writeCleanupSession, clearCleanupSession } from 'lib/cleanupSession';
import { buildUserTraits, identify, resetAnalytics, track } from 'lib/analytics/client';
import { clearLandingCampaign } from 'lib/analytics/campaign';
import { AnalyticsEvents } from 'lib/analytics/events';
import { consumeFreshLogin, markFreshLogin } from 'lib/analytics/session';
import { signAndBroadcastWithSessionKey } from 'lib/authHub/signAndBroadcast';
import { logoutViaAuthHub, YOMA_SSO_AVAILABLE, type AuthHubSessionData } from 'lib/authHub/redirect';
import { isDirectProvider, normalizeAuthProvider, WORKOS_PROVIDER } from 'lib/authHub/provider';
import { markSwitchAccount } from 'lib/authHub/signInFlow';
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
import { clearHubCredentialCache } from '@utils/kyc/hubCredentials';
import { clearRejectedKycCredentials } from '@utils/approvePayment';

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
              `${baseUrl}/_matrix/media/v3/thumbnail/${data.avatar_url.replace(
                'mxc://',
                '',
              )}?width=96&height=96&method=crop`,
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
  const [authProvider, setAuthProvider] = useState<string | null>(null);
  const [sessionAuthenticatorId, setSessionAuthenticatorId] = useState<string | null>(null);
  const [matrixUserId, setMatrixUserId] = useState<string | null>(null);
  const [matrixRoomId, setMatrixRoomId] = useState<string | null>(null);

  // Refs for stable callback access
  const stateRef = useRef({ address, sessionAuthenticatorId, authProvider });
  stateRef.current = { address, sessionAuthenticatorId, authProvider };

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
    // The youth app under /cleanup reads its own record — one sign-in, both apps.
    writeCleanupSession({
      address: data.address,
      did: data.did,
      displayName: data.displayName,
      sessionMnemonic: data.sessionMnemonic,
      sessionAuthenticatorId: data.sessionAuthenticatorId,
    });
  }

  function clearAuthStorage() {
    Object.values(authConstants.secretKey).forEach((key) => secureReset(key));
    // Ending a session here ends it for the youth app too.
    clearCleanupSession();
  }

  function clearAllState() {
    clearAuthStorage();
    // Wipe deck prefs for ALL accounts: if the next user's Matrix session fails,
    // the localStorage fallback must not surface the previous user's deck.
    clearDeckPrefsStorage();
    clearLocalCurrencyStorage();
    // Identity claims read from the Auth Hub are held in memory only: drop them
    // with the session.
    clearHubCredentialCache();
    // So are the credentials a verifier refused in this session.
    clearRejectedKycCredentials();
    // Forget the PostHog person with the session (no-op until analytics is on).
    resetAnalytics();
    setIsLoggedIn(false);
    setAddress(null);
    setDid(null);
    setDisplayName(null);
    setEmail(null);
    setAuthProvider(null);
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
      // Same for the sign-in provider: unknown until the next login.
      setAuthProvider(normalizeAuthProvider(persistedAccount.authProvider));
      setSessionAuthenticatorId(persistedAccount.sessionAuthenticatorId ?? null);
      setMatrixUserId(persistedAccount.matrixUserId ?? null);
      setMatrixRoomId(persistedAccount.matrixRoomId ?? null);
      setIsLoggedIn(true);
      // Re-written on every revival, so a session from before the youth app
      // shared this login gets its record without signing in again.
      writeCleanupSession({
        address: persistedAccount.address,
        did: persistedAccount.did ?? storedDid,
        displayName: persistedAccount.displayName ?? null,
        sessionMnemonic: storedSessionMnemonic,
        sessionAuthenticatorId: persistedAccount.sessionAuthenticatorId ?? null,
      });
      fetchMatrixProfile();

      // Analytics: the account is already in Redux (rehydrated), so the event
      // carries the user context. A boot straight after login is not a
      // "restore" — that login already produced `user_logged_in`.
      const restoredDid = persistedAccount.did ?? storedDid;
      if (restoredDid) {
        identify(
          restoredDid,
          buildUserTraits({
            did: restoredDid,
            address: persistedAccount.address,
            displayName: persistedAccount.displayName,
            matrixUserId: persistedAccount.matrixUserId,
          }),
        );
      }
      if (!consumeFreshLogin()) track(AnalyticsEvents.SessionRestored);
    } catch (error) {
      console.error('Session revival failed:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loginWithAuthHub = useCallback((data: AuthHubSessionData) => {
    const provider = normalizeAuthProvider(data.authProvider);
    setAddress(data.address);
    setDid(data.did);
    setDisplayName(data.displayName);
    setEmail(data.email ?? null);
    setAuthProvider(provider);
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
        authProvider: provider,
        matrixUserId: data.matrixUserId,
        matrixRoomId: data.matrixRoomId,
      }),
    );
    // Analytics — after the Redux dispatch so the event carries the user
    // context, identify first so the event lands on the DID. The auth hub does
    // not say whether this account is new, so registration is not tracked here.
    identify(
      data.did,
      buildUserTraits({
        did: data.did,
        address: data.address,
        displayName: data.displayName,
        matrixUserId: data.matrixUserId,
      }),
    );
    track(AnalyticsEvents.UserLoggedIn, { place: 'auth hub callback' });
    // The callback page ends in a full-page navigation; the next boot must not
    // also count as a `session_restored`.
    markFreshLogin();
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
    if (typeUrl.includes('MsgClaimIntent')) return 'Convert Cleanup rewards';
    if (typeUrl.includes('MsgAddVerification')) return 'Register Signing Key';
    if (typeUrl.includes('MsgGrantEntityAccountAuthz')) return 'Grant Authorization';
    return typeUrl.split('.').pop() || 'Transaction';
  }

  const onSign = useCallback(async (messages: any[], labelOverride?: string, options?: OnSignOptions) => {
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

    const label = labelOverride || getTxLabel(messages);
    setSigningState({ visible: true, label });

    try {
      const result = await signAndBroadcastWithSessionKey({
        address: addr,
        messages,
        sessionMnemonic,
        sessionAuthenticatorId: authId,
        memo: options?.memo,
        gas: options?.gas,
        onSigned: options?.onSigned,
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
    // Read before clearAllState() forgets it: it decides where logout ends.
    const provider = stateRef.current.authProvider;
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
      // Same for the partner campaign this tab arrived with: the next person
      // on a shared device did not click that link.
      clearLandingCampaign();
    }
    // Either way, the per-account Yoma link cache and session-check flag
    // belong to the account signing out — never to the next login.
    clearLinkState();
    setIsLoggingOut(true);
    // Captured while the account is still in Redux (user context) and before
    // clearAllState() resets the PostHog person. The Matrix cleanup below gives
    // the SDK's batch time to flush before the navigation to /auth.
    track(AnalyticsEvents.UserLoggedOut);

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

    if (isDirectProvider(provider)) {
      // A Yoma account: sign out at the hub AND at Yoma, or the next "Login
      // with Yoma" silently hands back the same Yoma person. The hub returns
      // to /auth/callback, which bounces to /auth. For a switch, /auth then
      // starts a fresh Yoma sign-in (prompt=login); the deep link, the yref
      // hand-off marker and the campaign stay in this tab's sessionStorage.
      if (preserveReturnTo) markSwitchAccount(provider);
      logoutViaAuthHub(provider);
      return;
    }
    // WorkOS (IXO team) accounts and sessions from before the hub said which
    // provider (at most 24 hours old): local sign-out, as before. An IXO
    // account goes back to its own sign-in page, unless it is switching to
    // the Yoma account a hand-off was for.
    window.location.href = provider === WORKOS_PROVIDER && YOMA_SSO_AVAILABLE && !preserveReturnTo ? '/ixo' : '/auth';
  }, []);

  const value = {
    isLoggedIn,
    isLoading,
    address,
    did,
    displayName,
    email,
    authProvider,
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
              <p style={{ color: 'var(--text-primary)', fontSize: 16, fontWeight: 600, margin: 0 }}>Confirming…</p>
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
