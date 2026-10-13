import md5 from 'md5';
import { sha256 } from '@cosmjs/crypto';
import { AuthDict, ClientEvent, createClient, IndexedDBStore, MatrixClient, SyncState } from 'matrix-js-sdk';
import type { SyncStateData } from 'matrix-js-sdk';
import { CryptoApi } from 'matrix-js-sdk/lib/crypto-api';
import { encrypt as eciesEncrypt } from 'eciesjs';

import { secureReset, secureSave } from './storage';
import cons, { cryptoDbPrefixForDevice, LEGACY_CRYPTO_DB_PREFIX } from '@constants/matrix';
import { isAuthenticated, secret } from './secrets';
import { cacheSecretStorageKey, clearSecretStorageKeys, getSecretStorageKey } from './secretStorageKeys';
import { cleanUrlString } from '@utils/url';
import { delay } from './timestamp';
import { clearSessionLock } from './sessionLock';

const WELL_KNOWN_URI = '/.well-known/matrix/client';

// =================================================================================================
// AUTH
// =================================================================================================
interface AuthResponse {
  accessToken: string;
  deviceId: string;
  userId: string;
  baseUrl: string;
}
export const mxLogin = async (
  { homeServerUrl, username, password }: { homeServerUrl: string; username: string; password: string },
  localMatrix = false,
) => {
  let mxHomeServerUrl = homeServerUrl;
  let mxUsername = username;
  const mxIdMatch = mxUsername.match(/^@(.+):(.+\..+)$/);
  if (mxIdMatch) {
    mxUsername = mxIdMatch[1] as string;
    mxHomeServerUrl = mxIdMatch[2] as string;
    mxHomeServerUrl = localMatrix ? mxHomeServerUrl : await getBaseUrl(mxHomeServerUrl);
  }

  try {
    const client = createTemporaryClient(mxHomeServerUrl);
    const response = await client.loginRequest({
      type: 'm.login.password',
      identifier: {
        type: 'm.id.user',
        user: normalizeUsername(mxUsername),
      },
      password,
      initial_device_display_name: cons.DEVICE_DISPLAY_NAME,
    });
    const data: AuthResponse = {
      accessToken: response.access_token,
      deviceId: response.device_id,
      userId: response.user_id,
      baseUrl: localMatrix ? mxHomeServerUrl : response?.well_known?.['m.homeserver']?.base_url || client.baseUrl,
    };
    updateLocalStore(data.accessToken, data.deviceId, data.userId, data.baseUrl);
    return data;
  } catch (error) {
    let msg = (error as any).message;
    if (msg === 'Unknown message') {
      msg = 'Please check your credentials';
    }
    console.error(`mxLogin::`, msg);
    throw new Error(msg);
  }
};

// =================================================================================================
// NEW API-BASED REGISTRATION
// =================================================================================================

interface PublicKeyResponse {
  publicKey: string;
  fingerprint: string;
  algorithm: string;
  usage: string;
}

interface UserCreationChallenge {
  timestamp: string;
  address: string;
  service: string;
  type: string;
}

interface UserCreationRequest {
  address: string;
  encryptedPassword: string;
  publicKeyFingerprint: string;
  authnResult?: any;
  secpResult?: {
    signature: string;
    challenge: string;
  };
}

interface UserCreationResponse {
  success: boolean;
  matrixUserId: string;
  address: string;
  message: string;
}

/**
 * Fetch the public key for password encryption from the user creation API
 * @returns Public key information for encryption
 */
export async function getPublicKeyForEncryption(): Promise<PublicKeyResponse> {
  const response = await fetch('/api/matrix/public-key', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch public key for encryption');
  }

  return await response.json();
}

/**
 * Create a structured challenge for user creation
 * @param address The user's address (without did:ixo: prefix)
 * @returns The challenge object and its base64 representation
 */
export function createUserCreationChallenge(address: string): {
  challenge: UserCreationChallenge;
  challengeBase64: string;
} {
  const challenge: UserCreationChallenge = {
    timestamp: new Date().toISOString(),
    address: address,
    service: 'matrix',
    type: 'create-account',
  };

  const challengeBase64 = Buffer.from(JSON.stringify(challenge)).toString('base64');

  return { challenge, challengeBase64 };
}

/**
 * Encrypt password using ECIES with the provided public key
 * @param password The password to encrypt
 * @param publicKey The public key in hex format
 * @returns The encrypted password in hex format
 */
export function encryptPasswordWithECIES(password: string, publicKey: string): string {
  const publicKeyBytes = new Uint8Array(Buffer.from(publicKey, 'hex'));
  const passwordBytes = new Uint8Array(Buffer.from(password, 'utf8'));
  const encryptedPassword = eciesEncrypt(publicKeyBytes, passwordBytes);
  return Array.from(encryptedPassword, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Create user account using WebAuthn/Passkey authentication
 * @param address The user's address
 * @param password The matrix password
 * @param authnResult The WebAuthn assertion result
 * @returns The user creation response
 */
export async function createUserAccountWithPasskey(
  address: string,
  password: string,
  authnResult: any,
): Promise<UserCreationResponse> {
  const publicKeyInfo = await getPublicKeyForEncryption();
  const encryptedPassword = encryptPasswordWithECIES(password, publicKeyInfo.publicKey);

  const request: UserCreationRequest = {
    address,
    encryptedPassword,
    publicKeyFingerprint: publicKeyInfo.fingerprint,
    authnResult,
  };

  const response = await fetch('/api/matrix/create-user', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to create user account');
  }

  return await response.json();
}

/**
 * Create user account using secp256k1 signature authentication
 * @param address The user's address
 * @param password The matrix password
 * @param signature The secp256k1 signature (base64)
 * @param challenge The challenge that was signed (base64)
 * @returns The user creation response
 */
export async function createUserAccountWithSecp(
  address: string,
  password: string,
  signature: string,
  challenge: string,
): Promise<UserCreationResponse> {
  const publicKeyInfo = await getPublicKeyForEncryption();
  const encryptedPassword = encryptPasswordWithECIES(password, publicKeyInfo.publicKey);

  const request: UserCreationRequest = {
    address,
    encryptedPassword,
    publicKeyFingerprint: publicKeyInfo.fingerprint,
    secpResult: {
      signature,
      challenge,
    },
  };

  const response = await fetch('/api/matrix/create-user', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to create user account');
  }

  return await response.json();
}

// =================================================================================================
// UPDATED REGISTRATION FUNCTIONS
// =================================================================================================

/**
 * Register matrix account using the new API with WebAuthn/Passkey authentication
 * @param address The user's address
 * @param password The matrix password
 * @param authnResult The WebAuthn assertion result
 * @returns AuthResponse with access token and user details
 */
export async function mxRegisterWithPasskey(
  address: string,
  password: string,
  authnResult: any,
): Promise<AuthResponse> {
  try {
    const userCreationResult = await createUserAccountWithPasskey(address, password, authnResult);

    if (!userCreationResult.success) {
      throw new Error('Failed to create matrix account via API');
    }

    // Now login to get the access token
    const homeServerUrl = process.env.NEXT_PUBLIC_MATRIX_HOMESERVER_URL as string;
    const username = generateUsernameFromAddress(address);

    const loginResult = await mxLogin({
      homeServerUrl,
      username,
      password,
    });

    return loginResult;
  } catch (error) {
    console.error('mxRegisterWithPasskey error:', error);
    throw error;
  }
}

/**
 * Register matrix account using the new API with secp256k1 signature authentication
 * @param address The user's address
 * @param password The matrix password
 * @param wallet The secp wallet for signing
 * @returns AuthResponse with access token and user details
 */
export async function mxRegisterWithSecp(
  address: string,
  password: string,
  wallet: { sign: (message: string) => Promise<Uint8Array> },
): Promise<AuthResponse> {
  try {
    // Create challenge and sign it
    const { challengeBase64 } = createUserCreationChallenge(address);
    const signatureBytes = await wallet.sign(challengeBase64);
    const signature = Buffer.from(signatureBytes).toString('base64');

    const userCreationResult = await createUserAccountWithSecp(address, password, signature, challengeBase64);

    if (!userCreationResult.success) {
      throw new Error('Failed to create matrix account via API');
    }

    // Now login to get the access token
    const homeServerUrl = process.env.NEXT_PUBLIC_MATRIX_HOMESERVER_URL as string;
    const username = generateUsernameFromAddress(address);

    const loginResult = await mxLogin({
      homeServerUrl,
      username,
      password,
    });

    return loginResult;
  } catch (error) {
    console.error('mxRegisterWithSecp error:', error);
    throw error;
  }
}

// =================================================================================================
// UPDATED LEGACY REGISTRATION (DEPRECATED)
// =================================================================================================

// Keep the old functions for backward compatibility but mark as deprecated
async function getRegisterFlow(homeServerUrl: string) {
  try {
    const client = createTemporaryClient(homeServerUrl);
    // @ts-ignore
    const [registerResponse] = await Promise.allSettled([client.register()]);
    const registerFlow = registerResponse.status === 'rejected' ? registerResponse?.reason?.data : undefined;
    if (registerFlow === undefined) {
      throw new Error('Failed to setup home server config.');
    }
    return registerFlow;
  } catch (error) {
    if ((error as any).data) {
      return (error as any).data;
    }
    throw new Error('Failed to get matrix register flow.');
  }
}

async function _register({
  homeServerUrl,
  username,
  password,
  auth,
}: {
  homeServerUrl: string;
  username: string;
  password: string;
  auth: AuthDict;
}) {
  const client = createTemporaryClient(homeServerUrl);
  let payload: AuthResponse | undefined;

  try {
    const response = await client.registerRequest({
      username,
      password,
      auth,
      initial_device_display_name: cons.DEVICE_DISPLAY_NAME,
    });
    if (response.access_token) {
      payload = {
        accessToken: response.access_token,
        baseUrl: homeServerUrl,
        deviceId: response.device_id ?? '',
        userId: response.user_id,
      };
    }
  } catch (error) {
    console.error(`_register:: ${(error as Error).message}`);
    const data = (error as any)?.data;
    if (data?.access_token) {
      payload = {
        accessToken: data.access_token,
        baseUrl: homeServerUrl,
        deviceId: data.device_id,
        userId: data.user_id,
      };
    }
  }
  if (payload?.accessToken) {
    updateLocalStore(payload.accessToken, payload.deviceId, payload.userId, payload.baseUrl);
  }
  return payload;
}

export async function loginOrRegisterMatrixAccount({
  homeServerUrl,
  username,
  password,
  wallet,
}: {
  homeServerUrl: string;
  username: string;
  password: string;
  wallet?: { sign: (message: string) => Promise<Uint8Array>; baseAccount: { address: string } };
}) {
  clearLocalStore();
  let isUsernameAvailable = await checkIsUsernameAvailable({ homeServerUrl, username });
  let res: AuthResponse | undefined;
  if (isUsernameAvailable && wallet) {
    // Use new API-based registration with secp256k1 authentication
    res = await mxRegisterWithSecp(wallet.baseAccount.address, password, wallet);
    if (!res?.accessToken) {
      throw new Error('Failed to register matrix account');
    }
  }
  if (!isAuthenticated()) {
    res = await mxLogin({
      homeServerUrl,
      username,
      password,
    });
    if (!res?.accessToken) {
      throw new Error('Failed to login to matrix account');
    }
  }
  return res;
}

export async function checkIsUsernameAvailable({
  homeServerUrl,
  username,
}: {
  homeServerUrl: string;
  username: string;
}) {
  const client = createTemporaryClient(homeServerUrl);
  try {
    const isUsernameAvailable = await client.isUsernameAvailable(username);
    return !!isUsernameAvailable;
  } catch (error) {
    return false;
  }
}

// =================================================================================================
// STORE
// =================================================================================================
function updateLocalStore(accessToken: string, deviceId: string, userId: string, baseUrl: string) {
  secureSave(cons.secretKey.ACCESS_TOKEN, accessToken);
  secureSave(cons.secretKey.DEVICE_ID, deviceId);
  secureSave(cons.secretKey.USER_ID, userId);
  secureSave(cons.secretKey.BASE_URL, baseUrl);
  // Every device gets its own rust crypto store (see cryptoDbPrefixForDevice).
  if (deviceId) secureSave(cons.secretKey.CRYPTO_DB_PREFIX, cryptoDbPrefixForDevice(deviceId));
  else secureReset(cons.secretKey.CRYPTO_DB_PREFIX);
}

export function clearLocalStore() {
  secureReset(cons.secretKey.ACCESS_TOKEN);
  secureReset(cons.secretKey.DEVICE_ID);
  secureReset(cons.secretKey.USER_ID);
  secureReset(cons.secretKey.BASE_URL);
  secureReset(cons.secretKey.MNEMONIC_BACKUP);
  secureReset(cons.secretKey.ENCRYPTED_MNEMONIC_BACKUP);
  secureReset(cons.secretKey.BACKGROUND_TYPE);
  secureReset(cons.secretKey.CRYPTO_DB_PREFIX);

  // Sweep any stray matrix-js-sdk localStorage entries
  if (typeof window !== 'undefined' && window.localStorage) {
    const toRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (!key) continue;
      if (key.startsWith('mx_') || key.startsWith('matrix-js-sdk')) toRemove.push(key);
    }
    toRemove.forEach((key) => window.localStorage.removeItem(key));
  }
}

/** The two IndexedDB databases the rust crypto store opens for a prefix. */
function cryptoDbNames(prefix: string): [string, string] {
  return [`${prefix}::matrix-sdk-crypto`, `${prefix}::matrix-sdk-crypto-meta`];
}

/**
 * Best-effort delete of one IndexedDB database. Resolves on success, error or `blocked` — a
 * blocked delete is never awaited: WebKit abandons it once the page goes away, Chromium completes
 * it later (and queues opens of the same name behind it).
 */
function deleteIndexedDB(name: string): Promise<void> {
  return new Promise<void>((resolve) => {
    try {
      const req = indexedDB.deleteDatabase(name);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
      req.onblocked = () => {
        console.warn(`IndexedDB delete of "${name}" is blocked by an open connection (another tab?)`);
        resolve();
      };
    } catch {
      resolve();
    }
  });
}

/**
 * Rust crypto store names only: `matrix-js-sdk::matrix-sdk-crypto[-meta]` (legacy) and
 * `matrix-js-sdk-<deviceId>::matrix-sdk-crypto[-meta]`. The SDK names the sync store
 * `matrix-js-sdk:matrix-sync-store` (a single colon): it must never match, or the sweep would
 * delete the sync store `startup()` has just opened.
 */
const RUST_CRYPTO_DB_NAME = /^matrix-js-sdk(-[^:]+)?::matrix-sdk-crypto(-meta)?$/;

/**
 * Fire-and-forget: delete every rust crypto store that does not belong to `currentPrefix`
 * (stores of earlier devices, or the legacy shared store once a per-device one is in use).
 * Never touches the current prefix's databases. Needs `indexedDB.databases()`.
 */
function sweepStaleCryptoDatabases(currentPrefix: string) {
  if (typeof indexedDB === 'undefined') return;
  const anyIndexedDB = indexedDB as any;
  if (typeof anyIndexedDB.databases !== 'function') return;
  const keep = new Set<string>(cryptoDbNames(currentPrefix));
  Promise.resolve()
    .then(() => anyIndexedDB.databases() as Promise<Array<{ name?: string }>>)
    .then((dbs) => {
      for (const db of dbs ?? []) {
        const name = db?.name;
        if (name && RUST_CRYPTO_DB_NAME.test(name) && !keep.has(name)) {
          console.info(`Deleting stale Data Store crypto database "${name}"`);
          void deleteIndexedDB(name);
        }
      }
    })
    .catch((err) => console.warn('Stale crypto database sweep failed:', err));
}

async function deleteMatrixIndexedDBs(extraCryptoPrefixes: Array<string | undefined> = []) {
  if (typeof indexedDB === 'undefined') return;

  // Known names for browsers without indexedDB.databases(): the sync store (the SDK prefixes its
  // name with `matrix-js-sdk:`), the legacy shared crypto store and the per-device crypto store(s).
  const names = new Set<string>([
    'matrix-js-sdk:matrix-sync-store',
    'matrix-sync-store',
    ...cryptoDbNames(LEGACY_CRYPTO_DB_PREFIX),
  ]);
  for (const prefix of [secret.cryptoDbPrefix, ...extraCryptoPrefixes]) {
    if (prefix) cryptoDbNames(prefix).forEach((name) => names.add(name));
  }

  // Enumerate all databases when the browser supports it (Chrome/Edge/Safari 15+).
  try {
    const anyIndexedDB = indexedDB as any;
    if (typeof anyIndexedDB.databases === 'function') {
      const dbs: Array<{ name?: string }> = await anyIndexedDB.databases();
      for (const db of dbs) {
        if (db?.name && (db.name.startsWith('matrix-') || db.name.startsWith('matrix-js-sdk'))) {
          names.add(db.name);
        }
      }
    }
  } catch {
    // best-effort — fall back to the known names
  }

  await Promise.all(Array.from(names).map((name) => deleteIndexedDB(name)));
}

// =================================================================================================
// CLIENT
// =================================================================================================
/**
 * Every client `createMatrixClient` created in this tab, with its sync store. A client that failed
 * to start stays reachable here so it can always be stopped: a running client (or an
 * initialised OlmMachine) keeps the crypto store open and blocks deleting it at sign-out.
 */
interface ManagedClient {
  client: MatrixClient;
  store: IndexedDBStore;
  syncListener?: (state: SyncState, prevState: SyncState | null, data?: SyncStateData) => void;
  /** Rejects a start that is still waiting for the first sync. */
  abortStart?: (err: Error) => void;
  stopped: boolean;
}
const managedClients = new Set<ManagedClient>();

/** The Matrix access token was rejected (M_UNKNOWN_TOKEN): the device was signed out server-side. */
export class MatrixSessionInvalidError extends Error {
  errcode = 'M_UNKNOWN_TOKEN';
  constructor(message: string) {
    super(message);
    this.name = 'MatrixSessionInvalidError';
    // Keep `instanceof` working when the class is down-levelled to ES5.
    Object.setPrototypeOf(this, MatrixSessionInvalidError.prototype);
  }
}

export function isMatrixSessionInvalidError(err: unknown): err is MatrixSessionInvalidError {
  return (
    err instanceof MatrixSessionInvalidError || (err as { name?: string } | null)?.name === 'MatrixSessionInvalidError'
  );
}

/**
 * The rust crypto store on disk is bound to a different (user, device) than the client:
 * "the account in the store doesn't match the account in the constructor".
 */
export function isCryptoStoreMismatchError(err: unknown): boolean {
  const message = (err as { message?: unknown } | null)?.message;
  return typeof message === 'string' && /account in the store doesn.t match/i.test(message);
}

/**
 * Stop one managed client and close its stores. Idempotent, and meant to be called again by a
 * start that was disposed midway: an `initRustCrypto()` or `startup()` that completes after the
 * first call opens handles that only a second stop/close releases.
 */
async function disposeManagedClient(entry: ManagedClient) {
  managedClients.delete(entry);
  entry.stopped = true;
  if (entry.syncListener) {
    entry.client.removeListener(ClientEvent.Sync, entry.syncListener);
    entry.syncListener = undefined;
  }
  if (entry.abortStart) {
    entry.abortStart(new Error('Data Store client was stopped while starting'));
    entry.abortStart = undefined;
  }
  try {
    // Also stops the rust crypto backend, which closes the OlmMachine and its crypto store.
    entry.client.stopClient();
  } catch (err) {
    console.warn('Matrix stopClient error:', err);
  }
  try {
    // destroy() only closes the sync store's IndexedDB connection; deleteAllData() would wipe it.
    await entry.store.destroy();
  } catch (err) {
    console.warn('Matrix sync store close error:', err);
  }
}

/** Stop a client created by `createMatrixClient` and close its stores (no server call). */
export async function stopMatrixClient(client: MatrixClient) {
  const entry = Array.from(managedClients).find((e) => e.client === client);
  if (entry) {
    await disposeManagedClient(entry);
    return;
  }
  try {
    client.stopClient();
  } catch (err) {
    console.warn('Matrix stopClient error:', err);
  }
}

/** Stop every client this tab created (running or failed) and close their stores. */
export async function stopAllMatrixClients() {
  await Promise.all(Array.from(managedClients).map((entry) => disposeManagedClient(entry)));
}

/**
 * Creates a temporary matrix client, used for matrix login or registration to get access tokens
 * @param homeServerUrl - the home server url to instantiate the matrix client
 * @returns matrix client
 */
export function createTemporaryClient(homeServerUrl: string) {
  if (!homeServerUrl) {
    throw new Error('Data Store server address is missing.');
  }
  return createClient({
    baseUrl: cleanUrlString(homeServerUrl),
  });
}

export async function createMatrixClient(): Promise<MatrixClient> {
  return createMatrixClientOnce(false);
}

async function createMatrixClientOnce(isSelfHealRetry: boolean): Promise<MatrixClient> {
  const homeServerUrl = secret.baseUrl;
  const accessToken = secret.accessToken;
  const userId = secret.userId;
  const deviceId = secret.deviceId;

  if (!homeServerUrl || !accessToken || !userId || !deviceId) {
    throw new Error('Data Store session is missing. Please sign in again.');
  }

  // Sessions saved before per-device store names have no prefix and keep the legacy shared store.
  const cryptoDatabasePrefix: string = secret.cryptoDbPrefix ?? LEGACY_CRYPTO_DB_PREFIX;
  // Garbage-collect crypto stores of earlier devices before opening anything (fire-and-forget).
  sweepStaleCryptoDatabases(cryptoDatabasePrefix);

  const indexedDBStore = new IndexedDBStore({
    indexedDB: global.indexedDB,
    dbName: 'matrix-sync-store',
  });
  // const legacyCryptoStore = new IndexedDBCryptoStore()

  const mxClient = createClient({
    baseUrl: cleanUrlString(homeServerUrl),
    accessToken,
    userId,
    store: indexedDBStore,
    // cryptoStore: legacyCryptoStore,
    deviceId,
    timelineSupport: true,
    cryptoCallbacks: {
      getSecretStorageKey: getSecretStorageKey,
      cacheSecretStorageKey: cacheSecretStorageKey,
    },
    verificationMethods: ['m.sas.v1'],
  });
  const entry: ManagedClient = { client: mxClient, store: indexedDBStore, stopped: false };
  managedClients.add(entry);
  // stopAllMatrixClients() may run while this function awaits (sign-out, lock lost).
  const throwIfStopped = () => {
    if (entry.stopped) throw new Error('Data Store client was stopped while starting');
  };

  try {
    await indexedDBStore.startup();
    throwIfStopped();
    try {
      await mxClient.initRustCrypto({ cryptoDatabasePrefix });
    } catch (err) {
      if (!isSelfHealRetry && isCryptoStoreMismatchError(err)) {
        const devicePrefix = cryptoDbPrefixForDevice(deviceId);
        if (devicePrefix !== cryptoDatabasePrefix) {
          // The store under this name belongs to another device (e.g. a sign-out could not delete
          // it). Move this device to its own store name and start again. The failed init leaks a
          // handle on the old store until the page goes away, but the retry opens a different
          // database, so no reload is needed.
          console.warn(
            `Data Store crypto store "${cryptoDatabasePrefix}" belongs to another device; ` +
              `switching device ${deviceId} to "${devicePrefix}" and retrying once.`,
            err,
          );
          await disposeManagedClient(entry);
          secureSave(cons.secretKey.CRYPTO_DB_PREFIX, devicePrefix);
          return await createMatrixClientOnce(true);
        }
      }
      throw err;
    }
    throwIfStopped();
    if (cryptoDatabasePrefix !== LEGACY_CRYPTO_DB_PREFIX) {
      // This device has its own store: the legacy shared store is dead weight (fire-and-forget,
      // never awaited — a leaked handle in this tab can keep the delete blocked).
      cryptoDbNames(LEGACY_CRYPTO_DB_PREFIX).forEach((name) => void deleteIndexedDB(name));
    }
    // `setGlobalErrorOnUnknownDevices` was removed in matrix-js-sdk 41: rust crypto never
    // blocks sends on unknown devices, so there is nothing to switch off.
    mxClient.setMaxListeners(20);
    // const filter = new Filter(userId);
    // filter.setDefinition({
    //   room: {
    //     state: {
    //       lazy_load_members: true,
    //       types: [],
    //     },
    //     timeline: {
    //       types: [],
    //     },
    //   },
    //   // Disable unnecessary features
    //   presence: {
    //     types: [], // No presence updates needed
    //   },
    //   account_data: {
    //     types: ['m.cross_signing.master'], // No account data needed
    //   },
    // });
    const prepared = new Promise<void>((resolve, reject) => {
      entry.abortStart = reject;
      entry.syncListener = (state, _prevState, data) => {
        switch (state) {
          case SyncState.Prepared:
            console.info(`[PREPARED] state: user ${userId}`);
            resolve();
            break;
          case SyncState.Error: {
            const syncError = data?.error as (Error & { errcode?: string }) | undefined;
            const errcode = syncError?.errcode;
            const detail = [errcode, syncError?.message].filter(Boolean).join(': ');
            const message = `Data Store could not start${detail ? ` (${detail})` : ''}`;
            reject(errcode === 'M_UNKNOWN_TOKEN' ? new MatrixSessionInvalidError(message) : new Error(message));
            break;
          }
          case SyncState.Stopped:
            console.info('[STOPPED] state');
            // No-op once PREPARED resolved; rejects a start that was stopped midway.
            reject(new Error('Data Store client stopped while starting'));
            break;
          case SyncState.Reconnecting:
            console.info('[RECONNECTING] state');
            break;
          case SyncState.Catchup:
            console.info('[CATCHUP] state');
            break;
          default:
            break;
        }
      };
      mxClient.on(ClientEvent.Sync, entry.syncListener);
    });
    // Avoid an unhandled rejection if startClient() throws before `prepared` is awaited.
    prepared.catch(() => undefined);
    await mxClient.startClient({
      lazyLoadMembers: true,
      // initialSyncLimit: 1,
      includeArchivedRooms: false,
      // pollTimeout: 2 * 60 * 1000, // poll every 2 minutes
      // filter: filter,
    });
    throwIfStopped();
    await prepared;
    entry.abortStart = undefined;
    throwIfStopped();
  } catch (err) {
    // Never leave a half-started client behind: it would keep the stores open.
    await disposeManagedClient(entry);
    throw err;
  }
  return mxClient;
}

/** Race a promise against a timeout. Resolves with `fallback` if timeout fires first. */
function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise<T>((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve(fallback);
    }, ms);
    promise.then(
      (val) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(val);
      },
      () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(fallback);
      },
    );
  });
}

/**
 * Wipe this browser's Data Store session without any server call: stop every client this tab
 * created, drop secret-storage keys, delete the Matrix IndexedDB databases (bounded wait) and
 * clear the saved tokens. Run before every fresh Matrix login so it never opens leftovers.
 */
export async function resetLocalMatrixSession() {
  const cryptoDbPrefix = secret.cryptoDbPrefix;
  await stopAllMatrixClients();
  clearSecretStorageKeys();
  await withTimeout(deleteMatrixIndexedDBs([cryptoDbPrefix]), 3000, undefined);
  clearLocalStore();
}

export async function logoutMatrixClient({ mxClient, baseUrl }: { mxClient?: MatrixClient; baseUrl?: string }) {
  // Capture the session first: the local store is cleared before any slow step below.
  const homeServerUrl = secret.baseUrl ?? baseUrl;
  const accessToken = secret.accessToken;
  const userId = secret.userId;
  const deviceId = secret.deviceId;
  const cryptoDatabasePrefix: string = secret.cryptoDbPrefix ?? LEGACY_CRYPTO_DB_PREFIX;

  // Stop every client (running or failed) so nothing in this tab holds the stores open.
  if (mxClient) await stopMatrixClient(mxClient);
  await stopAllMatrixClients();

  // Drop all in-memory secret-storage material (derived keys + security phrase).
  clearSecretStorageKeys();

  // Clear the tokens now, so they never survive the auth provider's safety timeout.
  clearLocalStore();
  // Release the cross-tab lock and tell any other tab still running the client to stop.
  clearSessionLock();

  // Server-side logout on a bare client — network call, can hang if the homeserver is slow.
  let bareClient: MatrixClient | null = null;
  if (homeServerUrl && accessToken) {
    bareClient = createClient({
      baseUrl: cleanUrlString(homeServerUrl),
      accessToken,
      userId,
      deviceId,
    });
    const client = bareClient;
    await withTimeout(
      client.logout().catch((err) => console.warn('Matrix logout error:', err)),
      4000,
      undefined,
    );
  }

  // Local store deletion — IndexedDB deletes stall while another tab holds a database open.
  if (bareClient) {
    const client = bareClient;
    await withTimeout(
      client.clearStores({ cryptoDatabasePrefix }).catch((err) => console.warn('Matrix clearStores error:', err)),
      3000,
      undefined,
    );
  }
  await withTimeout(deleteMatrixIndexedDBs([cryptoDatabasePrefix]), 3000, undefined);
}

// =================================================================================================
// CROSS SIGNING
// =================================================================================================
/**
 * Check if the user has cross-signing account data.
 * @param {MatrixClient} mxClient - The matrix client to check.
 * @returns {boolean} True if the user has cross-signing account data, otherwise false.
 */
export function hasCrossSigningAccountData(mxClient: MatrixClient): boolean {
  const masterKeyData = mxClient.getAccountData('m.cross_signing.master');
  return !!masterKeyData;
}

/**
 * Setup cross signing and secret storage for the current user
 * @param {MatrixClient} mxClient - The matrix client to setup cross signing for
 * @param {string} securityPhrase - the security phrase to use for secret storage
 * @param {string} password - the password for the matrix account
 * @param {boolean} forceReset - if to force reset the cross signing keys (NB, only do if you know what you are doing!!!)
 * @param {boolean} skipBootstrapSS - if to skip bootstrapping secret storage
 * @returns {boolean} True if the cross signing was setup successfully, otherwise false.
 */
export async function setupCrossSigning(
  mxClient: MatrixClient,
  {
    securityPhrase,
    password,
    forceReset = false,
    skipBootstrapSecureStorage = false,
  }: { securityPhrase: string; password: string; forceReset?: boolean; skipBootstrapSecureStorage?: boolean },
): Promise<boolean> {
  if (forceReset) {
    clearSecretStorageKeys();
  }

  const mxCrypto = mxClient.getCrypto() as CryptoApi;
  if (!mxCrypto) {
    throw new Error('Failed to setup matrix cross signing - failed to get matrix crypto api');
  }
  if (!skipBootstrapSecureStorage) {
    const recoveryKey = await mxCrypto.createRecoveryKeyFromPassphrase(securityPhrase);
    // Note: do not clearSecretStorageKeys() here — callers may have primed the cache
    // with the existing default key derived from `securityPhrase` so the SDK's
    // `getSecretStorageKey` callback can return it during bootstrap. The forceReset
    // branch above already clears when starting fresh.
    await mxCrypto.bootstrapSecretStorage({
      createSecretStorageKey: async () => recoveryKey!,
      setupNewSecretStorage: forceReset,
    });
  }
  const userId = mxClient.getUserId()!;
  await mxCrypto.bootstrapCrossSigning({
    authUploadDeviceSigningKeys: async function (makeRequest) {
      await makeRequest(getAuthId({ userId, password }));
    },
    setupNewCrossSigning: forceReset,
  });
  await mxCrypto.resetKeyBackup();

  await delay(300);

  return !!mxClient.getAccountData('m.cross_signing.master');
}

// =================================================================================================
// GENERAL
// =================================================================================================
/**
 * Generates a username from an address, used for matrix login, generated an account did
 * @param {string} address - the address to generate the username from
 * @returns {string} username
 */
export function generateUsernameFromAddress(address: string): string {
  if (!address) {
    throw new Error('Address is required to generate matrix username');
  }
  return 'did-ixo-' + address;
}

/**
 * Generates a password from a mnemonic, used for matrix login, generated using the first 24 bytes of the base64 encoded md5 hash of the mnemonic
 * @param {string} mnemonic - the mnemonic to generate the password from
 * @returns {string} password
 */
export function generatePasswordFromMnemonic(mnemonic: string): string {
  const base64 = Buffer.from(md5(mnemonic.replace(/ /g, ''))).toString('base64');
  return base64.slice(0, 24);
}

/**
 * Generates a recovery phrase from a mnemonic, used for matrix recovery, generated using the first 32 bytes of the base64 encoded sha256 hash of the mnemonic
 * @param {string} mnemonic - the mnemonic to generate the recovery phrase from
 * @returns {string} recoveryPhrase
 */
export function generateRecoveryPhraseFromMnemonic(mnemonic: string): string {
  const hash = sha256(new TextEncoder().encode(mnemonic.replace(/ /g, '')));
  const base64 = Buffer.from(hash).toString('base64');
  return base64.slice(0, 32);
}

/**
 * Extracts the home server URL from a user ID.
 * @param {string} userId - The user ID to extract the homeserver URL from.
 * @returns {string} The homeserver URL.
 */
export function extractHomeServerUrlFromUserId(userId: string): string {
  const parts = userId.split(':');
  if (parts.length < 2) {
    throw new Error('Invalid userId');
  }
  return parts.slice(1).join(':');
}

/**
 * Generates a recovery phrase from a mnemonic, used for matrix recovery, generated using the first 32 bytes of the base64 encoded sha256 hash of the mnemonic
 * @param {string} mnemonic - the mnemonic to generate the recovery phrase from
 * @returns {string} passphrase
 */
export function generatePassphraseFromMnemonic(mnemonic: string): string {
  const hash = sha256(new TextEncoder().encode(mnemonic.replace(/ /g, '')));
  const base64 = Buffer.from(hash).toString('base64');
  return base64.slice(0, 32);
}

/**
 * Cleans a home server URL by removing protocol and trailing slashes
 * @param {string} homeServer - the homeserver URL to clean
 * @returns {string} cleaned homeserver URL
 */
export function cleanMatrixHomeServerUrl(homeServer: string): string {
  return homeServer
    .replace(/^(https?:\/\/)/, '')
    .replace(/^matrix\./, '')
    .replace(/\/$/, '');
}

/**
 * Generates a room name from an account address, used for matrix user room where user can manage their own data
 * @param {string} address - the address of the user
 * @param {string} postpend - the postpend of the room name (for testing)
 * @returns {string} roomName
 */
export function generateUserRoomNameFromAddress(address: string, postpend = ''): string {
  return 'did-ixo-' + address + postpend;
}

/**
 * Generates a room alias from an account address, used for matrix user room where user can manage their own data
 * @param {string} address - the address of the user
 * @param {string} postpend - the postpend of the room alias (for testing)
 * @returns {string} roomAlias
 */
export function generateUserRoomAliasFromAddress(address: string, homeServerUrl: string): string {
  return '#' + generateUserRoomNameFromAddress(address) + ':' + cleanMatrixHomeServerUrl(homeServerUrl);
}

/**
 * Get the base URL for a given servername.
 * @param servername The servername to get the base URL for.
 * @returns The base URL for the servername.
 */
export async function getBaseUrl(servername: string): Promise<string> {
  let protocol = 'https://';
  if (/^https?:\/\//.test(servername)) {
    protocol = '';
  }
  const serverDiscoveryUrl = `${protocol}${servername}${WELL_KNOWN_URI}`;
  try {
    const response = await fetch(cleanUrlString(serverDiscoveryUrl), { method: 'GET' });
    const result = await response.json();
    const baseUrl = result?.['m.homeserver']?.base_url;
    if (baseUrl === undefined) {
      throw new Error();
    }
    return baseUrl;
  } catch (e) {
    return `${protocol}${servername}`;
  }
}

/**
 * Normalize a username by removing leading '@' and trimming whitespace.
 * @param {string} rawUsername - The raw username to normalize.
 * @returns {string} The normalized username.
 */
export function normalizeUsername(rawUsername: string): string {
  const noLeadingAt = rawUsername.indexOf('@') === 0 ? rawUsername.substring(1) : rawUsername;
  return noLeadingAt.trim();
}

/**
 * Generates the authentication identifier for matrix login
 * @param {string} password - the password for the matrix account
 * @returns {object} authId - the authentication identifier
 */
export function getAuthId({ userId, password }: { userId: string; password: string }): {
  type: string;
  password: string;
  identifier: { type: string; user: string };
} {
  return {
    type: 'm.login.password',
    password,
    identifier: {
      type: 'm.id.user',
      user: userId,
    },
  };
}

// =================================================================================================
// OPENID TOKEN
// =================================================================================================
let openIdCache: { token: string; expiresAt: number } | null = null;

/**
 * Fetches a Matrix OpenID token for the current user, caching it until
 * 10 seconds before expiry to avoid using a token that's about to expire.
 * @returns {Promise<string>} The OpenID access token
 */
export async function getMatrixOpenIdToken(): Promise<string> {
  if (openIdCache && Date.now() < openIdCache.expiresAt) {
    return openIdCache.token;
  }
  const baseUrl = secret.baseUrl;
  const accessToken = secret.accessToken;
  const userId = secret.userId;
  if (!baseUrl || !accessToken || !userId) {
    throw new Error('Matrix credentials not available');
  }
  const url = cleanUrlString(`${baseUrl}/_matrix/client/v3/user/${encodeURIComponent(userId)}/openid/request_token`);
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: '{}',
  });
  if (!res.ok) throw new Error(`Failed to fetch OpenID token: ${res.statusText}`);
  const data = await res.json();
  openIdCache = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000 - 10_000,
  };
  return openIdCache.token;
}

export function invalidateMatrixOpenIdToken(): void {
  openIdCache = null;
}

function isUnauthorizedBotError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { name?: string; errcode?: string; message?: string };
  if (e.name !== 'MatrixBotError') return false;
  const code = e.errcode?.toUpperCase();
  if (code === 'M_UNAUTHORIZED' || code === 'M_UNKNOWN_TOKEN') return true;
  return typeof e.message === 'string' && /unauthori[sz]ed/i.test(e.message);
}

/**
 * Calls a bot SDK method with the current Matrix OpenID token. If the call
 * fails with an Unauthorized error, invalidates the cached token, fetches a
 * fresh one, and retries exactly once. All other errors propagate immediately.
 */
export async function withMatrixOpenIdRetry<T>(call: (openIdToken: string) => Promise<T>): Promise<T> {
  const token = await getMatrixOpenIdToken();
  try {
    return await call(token);
  } catch (err) {
    if (!isUnauthorizedBotError(err)) throw err;
    invalidateMatrixOpenIdToken();
    const fresh = await getMatrixOpenIdToken();
    return await call(fresh);
  }
}

/**
 * Same as withMatrixOpenIdRetry but for raw fetch() calls against bot endpoints
 * that don't go through the SDK. Retries once if the response status is 401.
 */
export async function fetchWithMatrixOpenIdRetry(call: (openIdToken: string) => Promise<Response>): Promise<Response> {
  const token = await getMatrixOpenIdToken();
  const res = await call(token);
  if (res.status !== 401) return res;
  invalidateMatrixOpenIdToken();
  const fresh = await getMatrixOpenIdToken();
  return await call(fresh);
}
