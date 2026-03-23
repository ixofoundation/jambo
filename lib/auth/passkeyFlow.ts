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
import gqlQuery from '@utils/graphql';
import { BLOCKSYNC_URL } from '@constants/common';
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
import {
  saveMnemonicWithWebCrypto,
  encryptWithPin,
  readMnemonicFromVault,
  saveToVault,
  loadFromVault,
  clearAllVaultData,
} from '@utils/setupVault';
import { store } from '@store/index';
import { advanceStep, updateFlowData, startFlow, REGISTER_STEP_ORDER, LOGIN_STEP_ORDER } from '@store/slices/setupFlowSlice';

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

  // Track login flow
  store.dispatch(startFlow({ flowType: 'login', keyId }));
  store.dispatch(advanceStep('PASSKEY_ASSERTED'));

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
    throw new Error('No identity found for this address. Please register a new account.');
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

  // Fetch encrypted mnemonic from server
  let encryptedMnemonic: string | undefined;
  try {
    const loginResult = await loginPasskey({
      address,
      authnResult: parsedAssertion,
    });
    encryptedMnemonic = loginResult.encryptedMnemonic;
  } catch (err: any) {
    console.error('loginPasskey failed:', err);
    throw new Error(
      'Could not retrieve your Data Vault credentials. Your account setup may not have completed.',
      { cause: err },
    );
  }
  if (!encryptedMnemonic) {
    throw new Error('Could not retrieve your Data Vault credentials. Your account setup may not have completed. Please try registering again or contact support.');
  }

  // Cache encrypted mnemonic in vault for resume (already PIN-encrypted from registration)
  saveToVault('matrix', encryptedMnemonic);
  store.dispatch(updateFlowData({ address, did, credentialId: keyId, authenticatorId }));
  store.dispatch(advanceStep('ENCRYPTED_MNEMONIC_CACHED'));

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

  callbacks.onStatusUpdate('PIN needed to unlock Data Vault...');
  const pin = await callbacks.requestPin(encryptedMnemonic);

  store.dispatch(advanceStep('PIN_ENTERED'));

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
    throw new Error('Could not connect to Data Vault. Please check your connection and try again.');
  }

  store.dispatch(advanceStep('MATRIX_LOGGED_IN'));

  callbacks.onStatusUpdate('Setting up encryption...');
  const mxClient = await createMatrixClient();

  // Set Matrix display name from SSO if not already set
  try {
    const ssoState = store.getState().sso;
    const ssoDisplayName = ssoState.name || ssoState.email;
    if (ssoDisplayName) {
      const currentName = mxClient.getUser(mxClient.getUserId()!)?.displayName;
      if (!currentName) {
        await mxClient.setDisplayName(ssoDisplayName);
      }
    }
  } catch (err) {
    console.warn('Failed to update Matrix display name:', err);
  }

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

  // Cleanup vault — login flow complete
  await clearAllVaultData();
  store.dispatch(advanceStep('COMPLETE'));
}

// ─── Feegrant Helper ────────────────────────────────────────────────────────

export async function ensureFeegrant(address: string): Promise<void> {
  const hasFeegrant = await checkAddressFeegrant(address);
  if (!hasFeegrant) {
    await grantFeegrant(address);
  }
}

// ─── BLOCKING: Register ─────────────────────────────────────────────────────
// Steps: generate mnemonic → create wallet → save to vault (WebCrypto) →
//        check feegrant → create passkey → verify on-chain → compute DID

export async function passkeyRegisterBlocking(params: {
  wallet: SecpClient;
  callbacks: FlowCallbacks;
  pendingFeegrantPromise?: Promise<void> | null;
}): Promise<RegisterBlockingResult> {
  const { wallet, callbacks, pendingFeegrantPromise } = params;

  if (!wallet?.baseAccount?.address) {
    throw new Error('No wallet found');
  }
  const address = wallet.baseAccount.address;

  // Await pre-started feegrant if available, then verify on-chain
  callbacks.onStatusUpdate('Checking fee grant...');
  if (pendingFeegrantPromise) {
    try {
      await pendingFeegrantPromise;
    } catch {
      // Background attempt failed — will check and retry below
    }
  }
  const feegrant = await checkAddressFeegrant(address);
  if (!feegrant) {
    callbacks.onStatusUpdate('Requesting fee grant...');
    await grantFeegrant(address);
    const feegrantAfter = await checkAddressFeegrant(address);
    if (!feegrantAfter) {
      throw new Error('Failed to grant feegrant, please try again.');
    }
  }
  store.dispatch(advanceStep('FEEGRANT_GRANTED'));

  // Register passkey — use SSO name for better passkey identification
  callbacks.onStatusUpdate('Creating your passkey...');
  const ssoState = store.getState().sso;
  const ssoDisplayName = ssoState.name || ssoState.email || undefined;
  const { credentialId } = await registerPasskey({ wallet, displayName: ssoDisplayName });
  await delay(1000);

  // Verify on-chain
  callbacks.onStatusUpdate('Verifying passkey registration...');
  const authenticator = await fetchAddressAuthenticator(credentialId, address);
  if (!authenticator) {
    throw new Error('Failed to register passkey, please try again.');
  }

  // DID is deterministic — compute it but defer on-chain creation to background
  const did = utils.did.generateSecpDid(address);

  store.dispatch(updateFlowData({ address, did, credentialId, authenticatorId: authenticator?.id }));
  store.dispatch(advanceStep('PASSKEY_REGISTERED'));

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
//        encrypt & store mnemonic (using PIN from blocking phase)

export async function registerBackground(params: {
  address: string;
  did: string;
  wallet: SecpClient;
  pin: string;
  callbacks: FlowCallbacks;
}): Promise<void> {
  const { address, did, wallet, pin, callbacks } = params;

  // Step 1: Create DID on-chain (must complete before Matrix room bot needs it)
  callbacks.onStatusUpdate('Creating your digital identity...');
  const didExists = await checkIidDocumentExists(did);
  if (!didExists) {
    await createIidDocument(did, wallet as OfflineSigner);
    await delay(500);
    const didExistsNow = await checkIidDocumentExists(did);
    if (!didExistsNow) {
      throw new Error('Failed to create DID, please try again.');
    }
  }
  store.dispatch(advanceStep('DID_CREATED'));

  // Step 2: Generate Matrix mnemonic and save encrypted to vault
  callbacks.onStatusUpdate('Generating Vault credentials...');
  let mxMnemonic = utils.mnemonic.generateMnemonic(12);
  let pinEncrypted = await encryptWithPin(mxMnemonic, pin);
  saveToVault('matrix', pinEncrypted);
  store.dispatch(advanceStep('MATRIX_MNEMONIC_SAVED'));

  const homeServerUrl = process.env.NEXT_PUBLIC_MATRIX_HOMESERVER_URL as string;
  const mxUsername = generateUsernameFromAddress(address);
  let mxPassword = generatePasswordFromMnemonic(mxMnemonic);
  let mxPassphrase = generatePassphraseFromMnemonic(mxMnemonic);

  // Clear residual Matrix data
  await logoutMatrixClient({ baseUrl: homeServerUrl });

  const isUsernameAvailable = await checkIsUsernameAvailable({
    homeServerUrl,
    username: mxUsername,
  });

  let account;
  if (!isUsernameAvailable) {
    // Account exists from a prior interrupted attempt — try cascade recovery
    callbacks.onStatusUpdate('Reconnecting to existing Vault account...');

    // Step A: Try login with current mnemonic-derived password
    try {
      account = await mxLogin({ homeServerUrl, username: mxUsername, password: mxPassword });
      if (!account?.accessToken) throw new Error('No access token');
      // Verify the logged-in account matches the expected username
      const expectedUserId = `@${mxUsername}:${new URL(homeServerUrl).hostname}`;
      if (account.userId && account.userId !== expectedUserId) {
        throw new Error('Data Vault account mismatch.');
      }
    } catch (loginErr) {
      // Step B: Login failed — try to recover old mnemonic via secp API
      callbacks.onStatusUpdate('Recovering Vault credentials...');
      try {
        const timestamp = new Date().toISOString();
        const challenge = Buffer.from(timestamp).toString('base64');
        const signature = await wallet.sign(challenge);
        const response = await fetch('/api/auth/get-secret-secp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            address,
            secpResult: {
              challenge,
              signature: Buffer.from(signature).toString('base64'),
            },
          }),
        });
        if (!response.ok) throw new Error('Failed to fetch encrypted mnemonic');
        const { encryptedMnemonic } = await response.json();
        const recoveredMnemonic = decrypt(encryptedMnemonic, pin);
        if (!recoveredMnemonic) throw new Error('Could not decrypt recovered mnemonic');

        // Recovery succeeded — use the old mnemonic
        mxMnemonic = recoveredMnemonic;
        mxPassword = generatePasswordFromMnemonic(mxMnemonic);
        mxPassphrase = generatePassphraseFromMnemonic(mxMnemonic);
        pinEncrypted = await encryptWithPin(mxMnemonic, pin);
        saveToVault('matrix', pinEncrypted);

        // Login with the recovered (correct) password
        account = await mxLogin({ homeServerUrl, username: mxUsername, password: mxPassword });
        if (!account?.accessToken) throw new Error('Login with recovered credentials failed');
      } catch (recoveryErr) {
        // Step C: Everything failed — throw original registration error
        console.error('Matrix account recovery failed:', recoveryErr);
        throw new Error('Data Vault account already exists and could not be recovered. Please contact support.');
      }
    }
  } else {
    callbacks.onStatusUpdate('Creating Vault account...');
    account = await mxRegisterWithSecp(address, mxPassword, wallet);
    if (!account?.accessToken) {
      throw new Error('Failed to register Data Vault account, please try again later.');
    }
  }
  store.dispatch(advanceStep('MATRIX_ACCOUNT_CREATED'));

  // Setup Matrix client
  const mxClient = await createMatrixClient();
  const matrixApiClient = createMatrixApiClient({
    homeServerUrl: cleanUrlString(homeServerUrl),
    accessToken: account.accessToken as string,
  });

  // Set Matrix profile from SSO data (non-blocking)
  try {
    const ssoState = store.getState().sso;
    const ssoDisplayName = ssoState.name || ssoState.email;
    if (ssoDisplayName) {
      await mxClient.setDisplayName(ssoDisplayName);
    }
    if (ssoState.picture) {
      const imgResponse = await fetch(ssoState.picture);
      if (imgResponse.ok) {
        const blob = await imgResponse.blob();
        const uploaded = await mxClient.uploadContent(blob, { type: blob.type });
        const mxcUrl = typeof uploaded === 'string' ? uploaded : uploaded?.content_uri;
        if (mxcUrl) await mxClient.setAvatarUrl(mxcUrl);
      }
    }
  } catch (err) {
    console.warn('Failed to set Matrix profile from SSO:', err);
  }

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
  store.dispatch(advanceStep('CROSS_SIGNING_DONE'));

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
  store.dispatch(advanceStep('MATRIX_ROOM_CREATED'));

  // Encrypt and store mnemonic in Matrix room (using PIN from blocking phase)
  callbacks.onStatusUpdate('Securing Data Vault...');
  const encryptedMnemonic = encrypt(mxMnemonic, pin);
  const storeResponse = await fetch(
    cleanUrlString(
      `${homeServerUrl}/_matrix/client/r0/rooms/${roomId}/state/ixo.room.state.secure/encrypted_mnemonic`,
    ),
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
  store.dispatch(advanceStep('MNEMONIC_STORED_IN_ROOM'));

  // Cleanup — registration flow complete
  await clearAllVaultData();
  store.dispatch(advanceStep('COMPLETE'));
}

// ─── BACKGROUND: Resume Register (for interrupted flows) ─────────────────────
// Picks up from wherever the flow was interrupted, re-using the vault.

export async function resumeRegisterBackground(params: {
  address: string;
  did: string;
  pin: string;
  currentStep: string;
  callbacks: FlowCallbacks;
}): Promise<void> {
  const { address, did, pin, currentStep, callbacks } = params;

  // Load wallet mnemonic from vault
  const walletMnemonic = await readMnemonicFromVault('wallet', pin);
  if (!walletMnemonic) {
    throw new Error('Cannot resume — wallet mnemonic not found in vault');
  }
  const wallet = await getSecpClient(walletMnemonic);

  // Determine which steps to run based on currentStep
  const currentIdx = REGISTER_STEP_ORDER.indexOf(currentStep as any);
  const shouldRun = (step: string) => currentIdx < REGISTER_STEP_ORDER.indexOf(step as any);

  // Step: Feegrant (idempotent)
  if (shouldRun('FEEGRANT_GRANTED')) {
    callbacks.onStatusUpdate('Checking fee grant...');
    const feegrant = await checkAddressFeegrant(address);
    if (!feegrant) {
      callbacks.onStatusUpdate('Requesting fee grant...');
      await grantFeegrant(address);
      const feegrantAfter = await checkAddressFeegrant(address);
      if (!feegrantAfter) {
        throw new Error('Failed to grant feegrant, please try again.');
      }
    }
    store.dispatch(advanceStep('FEEGRANT_GRANTED'));
  }

  // Step: Passkey registration (idempotent — check if already on-chain)
  if (shouldRun('PASSKEY_REGISTERED')) {
    callbacks.onStatusUpdate('Checking passkey registration...');
    // If we have a credentialId in flow state, check if it's on-chain
    const flowState = store.getState().setupFlow;
    if (flowState.credentialId) {
      const authenticator = await fetchAddressAuthenticator(flowState.credentialId, address);
      if (authenticator) {
        store.dispatch(advanceStep('PASSKEY_REGISTERED'));
      } else {
        // Passkey not on-chain — need to re-register
        callbacks.onStatusUpdate('Creating your passkey...');
        const { credentialId } = await registerPasskey({ wallet });
        await delay(1000);
        const auth = await fetchAddressAuthenticator(credentialId, address);
        if (!auth) throw new Error('Failed to register passkey, please try again.');
        store.dispatch(updateFlowData({ credentialId, authenticatorId: auth.id }));
        store.dispatch(advanceStep('PASSKEY_REGISTERED'));
      }
    } else {
      callbacks.onStatusUpdate('Creating your passkey...');
      const { credentialId } = await registerPasskey({ wallet });
      await delay(1000);
      const auth = await fetchAddressAuthenticator(credentialId, address);
      if (!auth) throw new Error('Failed to register passkey, please try again.');
      store.dispatch(updateFlowData({ credentialId, authenticatorId: auth.id }));
      store.dispatch(advanceStep('PASSKEY_REGISTERED'));
    }
  }

  // PIN_COLLECTED is already done if we're in this function (we have the pin)
  if (shouldRun('PIN_COLLECTED')) {
    store.dispatch(advanceStep('PIN_COLLECTED'));
  }

  // From here, delegate to registerBackground which handles DID → Matrix → Store
  // registerBackground is idempotent (checks didExists, etc.) so safe to re-run from any point
  await registerBackground({ address, did, wallet, pin, callbacks });
}

// ─── BACKGROUND: Resume Login (for interrupted flows) ────────────────────────

export async function resumeLoginBackground(params: {
  address: string;
  currentStep: string;
  callbacks: FlowCallbacks;
}): Promise<void> {
  const { address, currentStep, callbacks } = params;

  const currentIdx = LOGIN_STEP_ORDER.indexOf(currentStep as any);

  if (currentIdx < LOGIN_STEP_ORDER.indexOf('ENCRYPTED_MNEMONIC_CACHED')) {
    // Need to re-do passkey assertion — can't resume from here
    throw new Error('PASSKEY_REDO_NEEDED');
  }

  // Load cached encrypted mnemonic from vault
  const encryptedMnemonic = loadFromVault('matrix');
  if (!encryptedMnemonic) {
    throw new Error('Encrypted mnemonic not found in vault — cannot resume login');
  }

  // From here, delegate to the standard login background
  await matrixLoginBackground({ address, encryptedMnemonic, callbacks });
}
