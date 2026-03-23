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
}

// ─── BLOCKING: Register ─────────────────────────────────────────────────────
// Steps: generate mnemonic → create wallet → check feegrant (may prompt email) →
//        create passkey → verify on-chain → create DID

export async function passkeyRegisterBlocking(params: {
  wallet: SecpClient;
  callbacks: FlowCallbacks;
}): Promise<RegisterBlockingResult> {
  const { wallet, callbacks } = params;

  if (!wallet?.baseAccount?.address) {
    throw new Error('No wallet found');
  }
  const address = wallet.baseAccount.address;

  // Check feegrant
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

  // Register passkey
  callbacks.onStatusUpdate('Creating your passkey...');
  const { credentialId } = await registerPasskey({ wallet });
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
  wallet: SecpClient;
  callbacks: FlowCallbacks;
}): Promise<void> {
  const { address, did, wallet, callbacks } = params;

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

  callbacks.onStatusUpdate('Generating Vault credentials...');
  const mxMnemonic = utils.mnemonic.generateMnemonic(12);
  const homeServerUrl = process.env.NEXT_PUBLIC_MATRIX_HOMESERVER_URL as string;
  const mxUsername = generateUsernameFromAddress(address);
  const mxPassword = generatePasswordFromMnemonic(mxMnemonic);
  const mxPassphrase = generatePassphraseFromMnemonic(mxMnemonic);

  const isUsernameAvailable = await checkIsUsernameAvailable({
    homeServerUrl,
    username: mxUsername,
  });
  if (!isUsernameAvailable) {
    throw new Error('Matrix account already exists, please try again.');
  }

  // Clear residual Matrix data
  await logoutMatrixClient({ baseUrl: homeServerUrl });

  callbacks.onStatusUpdate('Creating Vault account...');
  const account = await mxRegisterWithSecp(address, mxPassword, wallet);
  if (!account?.accessToken) {
    throw new Error('Failed to register Data Vault account, please try again later.');
  }

  // Setup Matrix client
  const mxClient = await createMatrixClient();
  const matrixApiClient = createMatrixApiClient({
    homeServerUrl,
    accessToken: account.accessToken as string,
  });

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
}
