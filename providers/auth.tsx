import { useState, useEffect, useRef, useCallback, HTMLAttributes } from 'react';
import Long from 'long';
import { createQueryClient } from '@ixo/impactxclient-sdk';

import { AuthContext } from '@contexts/auth';
import authConstants from '@constants/auth';
import { CHAIN_RPC_URL } from '@constants/common';
import { secureSave, secureLoad, secureReset } from '@utils/storage';
import { secret } from '@utils/secrets';
import { logoutMatrixClient } from '@utils/matrix';
import { cleanUrlString } from '@utils/url';
import { decodeGrants, isAllowanceExpired, isAllowanceLimitReached, queryAddressAllowances } from '@utils/feegrant';
import { signAndBroadcastWithPasskey } from 'lib/authn/signAndBroadcast';
import { store, persistor, RootState } from '@store/index';
import { setAccount, clearAccount } from '@store/slices/accountSlice';
import { clearSSOSession } from '@store/slices/ssoSlice';
import { ssoConfig } from 'lib/sso/config';
import { clearEntities } from '@store/slices/entitiesSlice';
import { clearCollections } from '@store/slices/collectionsSlice';
import { clearProtocols } from '@store/slices/protocolsSlice';
import { clearProfiles } from '@store/slices/profilesSlice';
import { setMatrixProfile, clearMatrixProfile } from '@store/slices/matrixProfileSlice';
import { clearAllDrafts } from '@store/slices/claimDraftsSlice';

function fetchMatrixProfile() {
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
          ? cleanUrlString(`${baseUrl}/_matrix/media/v3/thumbnail`) +
            `/${data.avatar_url.replace('mxc://', '')}?width=96&height=96&method=crop`
          : null;
        store.dispatch(setMatrixProfile({ displayName: data.displayname ?? null, avatarUrl }));
      })
      .catch((err) => console.warn('Matrix profile fetch failed:', err));
  } catch (err) {
    console.warn('Matrix profile fetch failed:', err);
  }
}

export const AuthProvider = ({ children }: HTMLAttributes<HTMLDivElement>) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [credentialId, setCredentialId] = useState('');
  const [address, setAddress] = useState<string | null>(null);
  const [did, setDid] = useState<string | null>(null);
  const [authenticatorId, setAuthenticatorId] = useState<string | undefined>();

  const signingMethod = credentialId ? 'passkey' as const : undefined;

  // Single ref object for stable callback access to latest state
  const stateRef = useRef({ credentialId, address, authenticatorId });
  stateRef.current = { credentialId, address, authenticatorId };

  // Session revival on mount — Redux is the primary source of truth
  useEffect(() => {
    try {
      const persistedAccount = store.getState().account;

      // If Redux has no account, user is not logged in
      if (!persistedAccount?.address) {
        // Clear any stale secure storage
        clearAuthStorage();
        return;
      }

      // Redux says logged in — validate against secure storage
      const storedAddress = secureLoad(authConstants.secretKey.ADDRESS);
      const storedDid = secureLoad(authConstants.secretKey.DID);
      const storedCredentialId = secureLoad(authConstants.secretKey.CREDENTIAL_ID);
      const storedAuthenticatorId = secureLoad(authConstants.secretKey.AUTHENTICATOR_ID);

      if (persistedAccount.address !== storedAddress || persistedAccount.did !== storedDid || !storedCredentialId) {
        console.warn('Secure storage does not match Redux account — logging out');
        clearAuthStorage();
        store.dispatch(clearAccount());
        store.dispatch(clearEntities());
        store.dispatch(clearCollections());
        store.dispatch(clearProtocols());
        store.dispatch(clearProfiles());
        store.dispatch(clearAllDrafts());
        return;
      }

      // Both sources agree — restore React state
      setAddress(persistedAccount.address);
      setDid(persistedAccount.did);
      setCredentialId(storedCredentialId);
      if (storedAuthenticatorId) setAuthenticatorId(storedAuthenticatorId);
      setIsLoggedIn(true);
      fetchMatrixProfile();
    } catch (error) {
      console.error('Session revival failed:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  function persistAuthState(cId: string, addr: string, d: string, authId?: string) {
    secureSave(authConstants.secretKey.CREDENTIAL_ID, cId);
    secureSave(authConstants.secretKey.ADDRESS, addr);
    secureSave(authConstants.secretKey.DID, d);
    if (authId) secureSave(authConstants.secretKey.AUTHENTICATOR_ID, authId);
  }

  function clearAuthStorage() {
    secureReset(authConstants.secretKey.CREDENTIAL_ID);
    secureReset(authConstants.secretKey.ADDRESS);
    secureReset(authConstants.secretKey.DID);
    secureReset(authConstants.secretKey.AUTHENTICATOR_ID);
  }

  const loginWithPasskey = useCallback(
    (data: { credentialId: string; authenticatorId?: string; address: string; did: string }) => {
      setCredentialId(data.credentialId);
      setAuthenticatorId(data.authenticatorId);
      setAddress(data.address);
      setDid(data.did);
      persistAuthState(data.credentialId, data.address, data.did, data.authenticatorId);
      setIsLoggedIn(true);
      store.dispatch(setAccount({ address: data.address, did: data.did, signingMethod: 'passkey' }));
      fetchMatrixProfile();
    },
    [],
  );

  const registerWithPasskey = useCallback(
    (data: { address: string; did: string; credentialId: string; authenticatorId?: string }) => {
      setCredentialId(data.credentialId);
      if (data.authenticatorId) setAuthenticatorId(data.authenticatorId);
      setAddress(data.address);
      setDid(data.did);
      persistAuthState(data.credentialId, data.address, data.did, data.authenticatorId);
      setIsLoggedIn(true);
      store.dispatch(setAccount({ address: data.address, did: data.did, signingMethod: 'passkey' }));
      fetchMatrixProfile();
    },
    [],
  );

  const [signingState, setSigningState] = useState<{ visible: boolean; label: string }>({ visible: false, label: '' });

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
    const { address: addr, credentialId: cId, authenticatorId: authId } = stateRef.current;

    if (!cId) {
      throw new Error('Not authenticated');
    }

    const label = getTxLabel(messages);
    setSigningState({ visible: true, label });

    try {
      let feegrantGranter: string | undefined;
      try {
        const allowances = await queryAddressAllowances(addr!);
        feegrantGranter = allowances?.length
          ? decodeGrants(allowances)?.find(
              (allowance) =>
                !!allowance &&
                !isAllowanceExpired(allowance.expiration as number) &&
                !isAllowanceLimitReached(allowance.limit),
            )?.granter
          : undefined;
      } catch (error) {
        console.error(error);
      }

      const result = await signAndBroadcastWithPasskey({
        address: addr!,
        messages,
        credentialId: cId,
        authenticatorId: authId,
        feegrantGranter,
      });

      setSigningState({ visible: false, label: '' });
      return result;
    } catch (err) {
      setSigningState({ visible: false, label: '' });
      throw err;
    }
  }, []);

  const onAuthenticate = useCallback(async () => {
    const { address: addr, authenticatorId: authId } = stateRef.current;

    const authenticatorType = 'AuthnVerification';
    const queryClient = await createQueryClient(CHAIN_RPC_URL);
    const response = await queryClient.ixo.smartaccount.v1beta1.getAuthenticator({
      account: addr!,
      authenticatorId: Long.fromString(authId!),
    });
    if (!response.accountAuthenticator?.config) {
      throw new Error('Unable to get authenticator data');
    }
    const authenticatorData = Buffer.from(response.accountAuthenticator?.config).toString('hex');
    return {
      type: authenticatorType,
      data: authenticatorData,
    };
  }, []);

  const logout = useCallback(async () => {
    // Capture SSO id_token before clearing state (needed for Keycloak logout)
    const ssoState = (store.getState() as RootState).sso;
    const idToken = ssoState?.idToken;

    await logoutMatrixClient({ baseUrl: secret.baseUrl });
    clearAuthStorage();
    setIsLoggedIn(false);
    setCredentialId('');
    setAddress(null);
    setDid(null);
    setAuthenticatorId(undefined);
    store.dispatch(clearAccount());
    store.dispatch(clearEntities());
    store.dispatch(clearCollections());
    store.dispatch(clearProtocols());
    store.dispatch(clearProfiles());
    store.dispatch(clearMatrixProfile());
    store.dispatch(clearAllDrafts());
    store.dispatch(clearSSOSession());
    await persistor.purge();

    // Redirect to Keycloak logout (navigates away from app, which triggers full re-auth on return)
    const appUrl = window.location.origin + '/auth';
    const logoutParams = new URLSearchParams({ post_logout_redirect_uri: appUrl });
    if (idToken) logoutParams.set('id_token_hint', idToken);
    window.location.href = `${ssoConfig.logoutEndpoint}?${logoutParams.toString()}`;
  }, []);

  const value = {
    isLoggedIn,
    isLoading,
    credentialId,
    address,
    did,
    authenticatorId,
    signingMethod,
    loginWithPasskey,
    registerWithPasskey,
    onSign,
    onAuthenticate,
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
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(4px)',
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--bg-primary, #1a1a2e)',
              borderRadius: 16,
              padding: '32px 28px',
              maxWidth: 340,
              width: '90%',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 20,
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                border: '3px solid rgba(255, 255, 255, 0.15)',
                borderTopColor: 'var(--accent-color, #3b82f6)',
                borderRadius: '50%',
                animation: 'authSpinner 0.8s linear infinite',
              }}
            />
            <div>
              <p style={{ color: 'white', fontSize: 16, fontWeight: 600, margin: 0 }}>
                Signing Transaction
              </p>
              <p style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: 14, margin: '8px 0 0' }}>
                {signingState.label}
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
