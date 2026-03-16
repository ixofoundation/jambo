import { useState, useEffect, useRef, useCallback, HTMLAttributes } from 'react';
import Long from 'long';
import { createQueryClient } from '@ixo/impactxclient-sdk';

import { AuthContext, SigningMethod } from '@contexts/auth';
import authConstants from '@constants/auth';
import { CHAIN_RPC_URL } from '@constants/common';
import { secureSave, secureLoad, secureReset } from '@utils/storage';
import { secret } from '@utils/secrets';
import { logoutMatrixClient } from '@utils/matrix';
import { cleanUrlString } from '@utils/url';
import { SecpClient } from '@utils/secp';
import { decodeGrants, isAllowanceExpired, isAllowanceLimitReached, queryAddressAllowances } from '@utils/feegrant';
import { signAndBroadcastWithMnemonic } from '@utils/transaction';
import { signAndBroadcastWithPasskey } from 'lib/authn/signAndBroadcast';
import { signAndBroadcastWithSignX } from 'lib/authn/signAndBroadcastSignX';
import { store, persistor } from '@store/index';
import { setAccount, clearAccount } from '@store/slices/accountSlice';
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

function deriveSigningMethod(credentialId: string): SigningMethod {
  if (!credentialId) return undefined;
  if (credentialId === 'secp256k1') return 'mnemonic';
  if (credentialId === 'signx') return 'signx';
  return 'passkey';
}

export const AuthProvider = ({ children }: HTMLAttributes<HTMLDivElement>) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [credentialId, setCredentialId] = useState('');
  const [address, setAddress] = useState<string | null>(null);
  const [did, setDid] = useState<string | null>(null);
  const [authenticatorId, setAuthenticatorId] = useState<string | undefined>();
  const [wallet, setWallet] = useState<SecpClient | null>(null);
  const [signXUser, setSignXUser] = useState<any>(null);

  const signingMethod = deriveSigningMethod(credentialId);

  // Single ref object for stable callback access to latest state
  const stateRef = useRef({ credentialId, address, authenticatorId, wallet, signXUser, signingMethod });
  stateRef.current = { credentialId, address, authenticatorId, wallet, signXUser, signingMethod };

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

  const loginWithMnemonic = useCallback(
    (data: { wallet: SecpClient; credentialId: string; address: string; did: string }) => {
      setWallet(data.wallet);
      setCredentialId(data.credentialId);
      setAddress(data.address);
      setDid(data.did);
      // Mnemonic sessions are not persisted (wallet is not serializable)
      setIsLoggedIn(true);
      store.dispatch(setAccount({ address: data.address, did: data.did, signingMethod: 'mnemonic' }));
      fetchMatrixProfile();
    },
    [],
  );

  const loginWithSignX = useCallback((data: { address: string; did: string; credentialId: string; signXUser: any }) => {
    setCredentialId(data.credentialId);
    setAddress(data.address);
    setDid(data.did);
    setSignXUser(data.signXUser);
    // SignX sessions are not persisted (signXUser is not serializable)
    setIsLoggedIn(true);
    store.dispatch(setAccount({ address: data.address, did: data.did, signingMethod: 'signx' }));
    fetchMatrixProfile();
  }, []);

  const [signingState, setSigningState] = useState<{ visible: boolean; label: string }>({ visible: false, label: '' });

  function getTxLabel(messages: any[]): string {
    if (!messages?.length) return 'Transaction';
    const typeUrl = messages[0]?.typeUrl || '';
    if (typeUrl.includes('MsgExec')) {
      // Unwrap MsgExec to show inner message type
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
    const { signingMethod: method, address: addr, credentialId: cId, authenticatorId: authId, wallet: w, signXUser: sxUser } = stateRef.current;

    if (!method) {
      throw new Error('Unable to determine signing method');
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
      let result;
      switch (method) {
        case 'passkey':
          result = await signAndBroadcastWithPasskey({
            address: addr!,
            messages,
            credentialId: cId,
            authenticatorId: authId,
            feegrantGranter,
          });
          break;
        case 'mnemonic':
          result = await signAndBroadcastWithMnemonic({
            offlineSigner: w!,
            messages,
            feegrantGranter,
          });
          break;
        case 'signx':
          if (!sxUser) {
            throw new Error('SignX user not found');
          }
          result = await signAndBroadcastWithSignX({
            address: addr!,
            messages,
            signXUser: sxUser,
            feegrantGranter,
          });
          break;
        default:
          throw new Error('Unable to determine signing method');
      }
      setSigningState({ visible: false, label: '' });
      return result;
    } catch (err) {
      setSigningState({ visible: false, label: '' });
      throw err;
    }
  }, []);

  const onAuthenticate = useCallback(async () => {
    const { signingMethod: method, address: addr, authenticatorId: authId, wallet: w, signXUser: sxUser } = stateRef.current;

    switch (method) {
      case 'mnemonic': {
        const authenticatorType = 'SignatureVerification';
        const accounts = await w?.getAccounts();
        const pubkey = accounts?.[0]?.pubkey;
        if (!pubkey) {
          throw new Error('Unable to get pubkey');
        }
        // @ts-ignore
        const authenticatorData = new Uint8Array(Buffer.from(pubkey, 'hex'));
        return {
          type: authenticatorType,
          data: authenticatorData,
        };
      }
      case 'passkey': {
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
      }
      case 'signx': {
        const authenticatorType = 'SignXVerification';
        const authenticatorData = new Uint8Array(Buffer.from(sxUser?.address || '', 'utf8'));
        return {
          type: authenticatorType,
          data: authenticatorData,
        };
      }
      default:
        throw new Error('Unable to determine signing method');
    }
  }, []);

  const logout = useCallback(async () => {
    await logoutMatrixClient({ baseUrl: secret.baseUrl });
    clearAuthStorage();
    setIsLoggedIn(false);
    setCredentialId('');
    setAddress(null);
    setDid(null);
    setAuthenticatorId(undefined);
    setWallet(null);
    setSignXUser(null);
    store.dispatch(clearAccount());
    store.dispatch(clearEntities());
    store.dispatch(clearCollections());
    store.dispatch(clearProtocols());
    store.dispatch(clearProfiles());
    store.dispatch(clearMatrixProfile());
    store.dispatch(clearAllDrafts());
    await persistor.purge();
    // AuthGuard will redirect to /auth
  }, []);

  const value = {
    isLoggedIn,
    isLoading,
    credentialId,
    address,
    did,
    authenticatorId,
    signingMethod,
    wallet,
    signXUser,
    loginWithPasskey,
    registerWithPasskey,
    loginWithMnemonic,
    loginWithSignX,
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
              backgroundColor: 'var(--bg-color, #1a1a2e)',
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
                borderTopColor: 'var(--primary-color, #3b82f6)',
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
