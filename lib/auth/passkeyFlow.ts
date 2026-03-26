import { utils } from '@ixo/impactxclient-sdk';
import { createMatrixApiClient } from '@ixo/matrixclient-sdk';
import { OfflineSigner } from '@cosmjs/proto-signing';

import { base64urlDecode, base64urlEncode } from '@utils/encoding';
import { checkIidDocumentExists, createIidDocument } from '@utils/did';
import { loginPasskey } from 'lib/authn/login';
import { registerPasskey } from 'lib/authn/register';
import { checkAddressFeegrant, grantFeegrant } from '@utils/feegrant';
import { getSecpClient, SecpClient } from '@utils/secp';
import { encrypt, decrypt } from '@utils/encryption';
import { cleanUrlString } from '@utils/url';
import { delay } from '@utils/timestamp';
import { secureSave, secureReset } from '@utils/storage';
import gqlQuery from '@utils/graphql';
import cons from '@constants/matrix';
import { BLOCKSYNC_URL } from '@constants/common';
import { store, RootState } from '@store/index';
import { MatrixClient } from 'matrix-js-sdk';
import {
  checkIsUsernameAvailable,
  createMatrixClient,
  generatePassphraseFromMnemonic,
  generatePasswordFromMnemonic,
  generateUsernameFromAddress,
  generateUserRoomAliasFromAddress,
  hasCrossSigningAccountData,
  logoutMatrixClient,
  mxLogin,
  mxRegisterWithSecp,
  setupCrossSigning,
} from '@utils/matrix';

// ─── Types ───────────────────────────────────────────────────────────────────

export type AddressData = {
  address: string;
  id?: string; // authenticatorId
};

export interface FlowCallbacks {
  onStatusUpdate: (message: string) => void;
  requestPin: (encryptedMnemonic?: string) => Promise<string>;
}

export interface LoginBlockingResult {
  credentialId: string;
  authenticatorId?: string;
  address: string;
  did: string;
  encryptedMnemonic: string;
  parsedAssertion: any;
  keyId: string;
  addresses: AddressData[];
}

export interface RegisterBlockingResult {
  credentialId: string;
  authenticatorId?: string;
  address: string;
  did: string;
  wallet: SecpClient;
}

// ─── Shared Helpers ──────────────────────────────────────────────────────────

async function fetchAddressesByKeyId(keyId: string): Promise<AddressData[]> {
  const query = `
    query GetAuthenticators {
      smartAccountAuthenticators(
        filter: {
          keyId: { equalTo: "${keyId}" }
        }
      ) {
        nodes {
          address
          id
        }
      }
    }
  `;
  const result = await gqlQuery<any>(BLOCKSYNC_URL, query);
  return result.data?.data?.smartAccountAuthenticators?.nodes || [];
}

async function fetchAddressAuthenticator(keyId: string, address: string): Promise<AddressData | undefined> {
  const addresses = await fetchAddressesByKeyId(keyId);
  return addresses.find((addr) => addr.address === address);
}

// ─── BLOCKING: Login ─────────────────────────────────────────────────────────
// Steps: get challenge → passkey assertion → query addresses → resolve address →
//        get encrypted mnemonic → verify DID exists

export async function passkeyLoginBlocking(callbacks: FlowCallbacks): Promise<{
  result: LoginBlockingResult;
  addresses: AddressData[];
  assertion: any;
  keyId: string;
} | null> {
  callbacks.onStatusUpdate('Authenticating with passkey...');
  await delay(200);

  // Get initial challenge
  const authOptions = await fetch('/api/auth/initial-challenge').then((r) => r.json());
  const publicKeyOptions: PublicKeyCredentialRequestOptions = {
    ...authOptions,
    challenge: base64urlDecode(authOptions.challenge),
  };

  // Get passkey assertion
  const assertion: any = await navigator.credentials.get({ publicKey: publicKeyOptions });
  if (!assertion) {
    throw new Error('Credential assertion failed');
  }

  const keyId = assertion.id;
  const addresses = await fetchAddressesByKeyId(keyId);

  if (!addresses.length) {
    throw new Error('No addresses found for this passkey');
  }

  // Return addresses and assertion for address selection in the UI
  return { result: null as any, addresses, assertion, keyId };
}

/**
 * Completes the blocking phase after address selection.
 * Verifies DID exists and fetches the encrypted mnemonic.
 */
export async function passkeyLoginBlockingFinalize(params: {
  address: string;
  authenticatorId?: string;
  assertion: any;
  keyId: string;
  addresses: AddressData[];
  callbacks: FlowCallbacks;
}): Promise<LoginBlockingResult> {
  const { address, authenticatorId, assertion, keyId, callbacks } = params;

  callbacks.onStatusUpdate('Verifying identity...');

  const did = utils.did.generateSecpDid(address);

  // Check DID exists
  const didExists = await checkIidDocumentExists(did);
  if (!didExists) {
    throw new Error('Iid Document does not exist, please try another account.');
  }

  // Prepare assertion for server
  const parsedAssertion = {
    id: assertion.id,
    type: assertion.type,
    rawId: base64urlEncode(assertion.rawId),
    authenticatorAttachment: assertion.authenticatorAttachment,
    response: {
      clientDataJSON: base64urlEncode(assertion.response.clientDataJSON),
      authenticatorData: base64urlEncode(assertion.response.authenticatorData),
      signature: base64urlEncode(assertion.response.signature),
      userHandle: assertion.response.userHandle ? base64urlEncode(assertion.response.userHandle) : null,
    },
  };

  console.log('loginPasskey', {
    address,
    authResult: parsedAssertion,
  });

  // Fetch encrypted mnemonic from server
  const { encryptedMnemonic } = await loginPasskey({
    address,
    authnResult: parsedAssertion,
  });
  if (!encryptedMnemonic) {
    throw new Error('Failed to login with passkey.');
  }

  return {
    credentialId: keyId,
    authenticatorId,
    address,
    did,
    encryptedMnemonic,
    parsedAssertion,
    keyId,
    addresses: params.addresses,
  };
}

// ─── BACKGROUND: Login Matrix Setup ─────────────────────────────────────────
// Steps: prompt PIN → decrypt mnemonic → Matrix login → create client →
//        setup cross-signing → done

export async function matrixLoginBackground(params: {
  address: string;
  encryptedMnemonic: string;
  callbacks: FlowCallbacks;
}): Promise<void> {
  const { address, encryptedMnemonic, callbacks } = params;

  // Back up encrypted mnemonic so we can resume if the user refreshes
  secureSave(cons.secretKey.ENCRYPTED_MNEMONIC_BACKUP, encryptedMnemonic);
  secureSave(cons.secretKey.BACKGROUND_TYPE, 'login');

  callbacks.onStatusUpdate('PIN needed to unlock Data Vault...');
  const pin = await callbacks.requestPin(encryptedMnemonic);

  callbacks.onStatusUpdate('Decrypting Data Vault credentials...');
  const mxMnemonic = decrypt(encryptedMnemonic, pin);
  const homeServerUrl = process.env.NEXT_PUBLIC_MATRIX_HOMESERVER_URL as string;
  const mxUsername = generateUsernameFromAddress(address);
  const mxPassword = generatePasswordFromMnemonic(mxMnemonic);
  const mxPassphrase = generatePassphraseFromMnemonic(mxMnemonic);

  callbacks.onStatusUpdate('Connecting to Data Vault...');
  await logoutMatrixClient({ baseUrl: homeServerUrl });
  const account = await mxLogin({
    homeServerUrl,
    username: mxUsername,
    password: mxPassword,
  });
  if (!account?.accessToken) {
    throw new Error('Failed to login to Data Vault, please try again later.');
  }

  callbacks.onStatusUpdate('Setting up encryption...');
  const mxClient = await createMatrixClient();

  // Sync Yoma SSO profile to Matrix (display name + avatar)
  await syncMatrixProfileFromSSO(mxClient);

  let hasCrossSigning = hasCrossSigningAccountData(mxClient);
  if (!hasCrossSigning) {
    hasCrossSigning = await setupCrossSigning(mxClient, {
      securityPhrase: mxPassphrase,
      password: mxPassword,
      forceReset: true,
    });
    if (!hasCrossSigning) {
      throw new Error('Failed to setup cross signing, please try again.');
    }
  }

  // Clear backup — login background completed successfully
  secureReset(cons.secretKey.ENCRYPTED_MNEMONIC_BACKUP);
  secureReset(cons.secretKey.BACKGROUND_TYPE);
}

// ─── Matrix Profile Sync ───────────────────────────────────────────────────

async function syncMatrixProfileFromSSO(mxClient: MatrixClient): Promise<void> {
  const ssoState = (store.getState() as RootState).sso;

  // Display name
  const displayName = ssoState.name || ssoState.email;
  if (displayName) {
    await mxClient.setDisplayName(displayName).catch(console.warn);
  }

  // Avatar (download external URL → upload to Matrix → set mxc:// URL)
  if (ssoState.picture) {
    try {
      const response = await fetch(ssoState.picture);
      const blob = await response.blob();
      const uploaded = await mxClient.uploadContent(blob, { type: blob.type });
      if (uploaded.content_uri) {
        await mxClient.setAvatarUrl(uploaded.content_uri);
      }
    } catch (err) {
      console.warn('Failed to sync SSO avatar to Matrix:', err);
    }
  }
}

// ─── Feegrant Helper ────────────────────────────────────────────────────────

export async function ensureFeegrant(address: string): Promise<void> {
  const hasFeegrant = await checkAddressFeegrant(address);
  if (!hasFeegrant) {
    await grantFeegrant(address);
    const granted = await checkAddressFeegrant(address);
    if (!granted) {
      throw new Error('Failed to grant feegrant, please try again.');
    }
  }
}

// ─── BLOCKING: Register ─────────────────────────────────────────────────────
// Steps: create passkey → verify on-chain → compute DID
// Note: feegrant is handled separately (started in background during mnemonic backup)

export async function passkeyRegisterBlocking(params: {
  wallet: SecpClient;
  callbacks: FlowCallbacks;
  ssoLabel?: string;
}): Promise<RegisterBlockingResult> {
  const { wallet, callbacks } = params;

  if (!wallet?.baseAccount?.address) {
    throw new Error('No wallet found');
  }
  const address = wallet.baseAccount.address;

  // Register passkey (use SSO name if available)
  callbacks.onStatusUpdate('Creating your passkey...');
  const passkeyDisplayName = params.ssoLabel ? `${params.ssoLabel} (${address})` : address;
  const { credentialId } = await registerPasskey({ wallet, passkeyDisplayName });
  await delay(1000);

  // Verify on-chain
  callbacks.onStatusUpdate('Verifying passkey registration...');
  const authenticator = await fetchAddressAuthenticator(credentialId, address);
  if (!authenticator) {
    throw new Error('Failed to register passkey, please try again.');
  }

  // DID is deterministic — compute it but defer on-chain creation to background
  const did = utils.did.generateSecpDid(address);

  return {
    credentialId,
    authenticatorId: authenticator?.id,
    address,
    did,
    wallet,
  };
}

// ─── BACKGROUND: Register Setup (DID + Matrix) ──────────────────────────────
// Steps: create DID on-chain → generate Matrix creds → check username availability →
//        register Matrix → create client → setup cross-signing → create/join room →
//        prompt PIN → encrypt & store mnemonic

export async function registerBackground(params: {
  address: string;
  did: string;
  wallet?: SecpClient;
  mxMnemonicOverride?: string;
  callbacks: FlowCallbacks;
}): Promise<void> {
  const { address, did, wallet, mxMnemonicOverride, callbacks } = params;

  // Step 1: Create DID on-chain (must complete before Matrix room bot needs it)
  callbacks.onStatusUpdate('Creating your digital identity...');
  const didExists = await checkIidDocumentExists(did);
  if (!didExists) {
    if (!wallet) {
      throw new Error('Wallet required for DID creation. Please register again.');
    }
    await createIidDocument(did, wallet as OfflineSigner);
    await delay(500);
    const didExistsNow = await checkIidDocumentExists(did);
    if (!didExistsNow) {
      throw new Error('Failed to create DID, please try again.');
    }
  }

  callbacks.onStatusUpdate('Generating Vault credentials...');
  const mxMnemonic = mxMnemonicOverride || utils.mnemonic.generateMnemonic(12);

  // Back up mnemonic so we can resume if the user refreshes
  secureSave(cons.secretKey.MNEMONIC_BACKUP, mxMnemonic);
  secureSave(cons.secretKey.BACKGROUND_TYPE, 'register');
  const homeServerUrl = process.env.NEXT_PUBLIC_MATRIX_HOMESERVER_URL as string;
  const mxUsername = generateUsernameFromAddress(address);
  const mxPassword = generatePasswordFromMnemonic(mxMnemonic);
  const mxPassphrase = generatePassphraseFromMnemonic(mxMnemonic);

  const isUsernameAvailable = await checkIsUsernameAvailable({
    homeServerUrl,
    username: mxUsername,
  });

  // Clear residual Matrix data
  await logoutMatrixClient({ baseUrl: homeServerUrl });

  callbacks.onStatusUpdate('Creating Vault account...');
  let account;
  if (isUsernameAvailable && wallet) {
    account = await mxRegisterWithSecp(address, mxPassword, wallet);
  }
  // Fall back to login if account already exists (e.g. resuming after refresh)
  if (!account?.accessToken) {
    account = await mxLogin({ homeServerUrl, username: mxUsername, password: mxPassword });
  }
  if (!account?.accessToken) {
    throw new Error('Failed to register Data Vault account, please try again later.');
  }

  // Setup Matrix client
  const mxClient = await createMatrixClient();
  const matrixApiClient = createMatrixApiClient({
    homeServerUrl: cleanUrlString(homeServerUrl),
    accessToken: account.accessToken as string,
  });

  // Sync Yoma SSO profile to Matrix (display name + avatar)
  await syncMatrixProfileFromSSO(mxClient);

  // Setup cross-signing
  callbacks.onStatusUpdate('Setting up Vault encryption...');
  let hasCrossSigning = hasCrossSigningAccountData(mxClient);
  if (!hasCrossSigning) {
    hasCrossSigning = await setupCrossSigning(mxClient, {
      securityPhrase: mxPassphrase,
      password: mxPassword,
      forceReset: true,
    });
    if (!hasCrossSigning) {
      throw new Error('Failed to setup cross signing, please try again.');
    }
  }

  // Create/join room
  callbacks.onStatusUpdate('Creating secure Vault room...');
  const mxRoomAlias = generateUserRoomAliasFromAddress(address, account.baseUrl);
  const queryIdResponse = await matrixApiClient.room.v1beta1.queryId(mxRoomAlias).catch(() => undefined);
  let roomId: string = queryIdResponse?.room_id ?? '';
  if (!roomId) {
    const response = await fetch(cleanUrlString(`${process.env.NEXT_PUBLIC_MATRIX_ROOM_BOT_URL}/room/source`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        did,
        userMatrixId: account.userId,
      }),
    });
    if (!response.ok) {
      throw new Error('Failed to create matrix room.');
    }
    const data = await response.json();
    roomId = data.roomId;
    if (!roomId) {
      throw new Error('Failed to create user matrix room.');
    }
  }

  // Ensure room is joined
  let joinedMembers = await matrixApiClient.room.v1beta1.listJoinedMembers(roomId).catch(() => undefined);
  let joined = !!joinedMembers?.joined?.[account.userId];
  if (!joined) {
    const joinResponse = await matrixApiClient.room.v1beta1.join(roomId);
    if (!joinResponse.room_id) {
      throw new Error('Failed to join matrix room.');
    }
    joinedMembers = await matrixApiClient.room.v1beta1.listJoinedMembers(roomId);
    joined = !!joinedMembers?.joined?.[account.userId];
    if (!joined) {
      throw new Error('Failed to join matrix room.');
    }
  }

  // Request PIN from user
  callbacks.onStatusUpdate('PIN needed to secure your Data Vault...');
  const pin = await callbacks.requestPin();

  // Encrypt and store mnemonic
  callbacks.onStatusUpdate('Securing Data Vault...');
  const encryptedMnemonic = encrypt(mxMnemonic, pin);
  const storeResponse = await fetch(
    cleanUrlString(`${homeServerUrl}/_matrix/client/r0/rooms/${roomId}/state/ixo.room.state.secure/encrypted_mnemonic`),
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${account.accessToken as string}`,
      },
      body: JSON.stringify({
        encrypted_mnemonic: encryptedMnemonic,
      }),
    },
  );
  if (!storeResponse.ok) {
    throw new Error('Failed to store encrypted mnemonic in matrix room.');
  }
  await storeResponse.json();

  // Clear backup — register background completed successfully
  secureReset(cons.secretKey.MNEMONIC_BACKUP);
  secureReset(cons.secretKey.BACKGROUND_TYPE);
}
