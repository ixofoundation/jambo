import { createDelegation, serializeDelegation, type Signer } from '@ixo/ucan';

import { RESOURCE_PREFIX, SWAP_ABILITY } from './types';

/**
 * The swap token: the UCAN each call to a swap route carries (the worker's
 * README, "The swap token"). Issued directly by the account's own DID, for ONE
 * request: its facts carry a random `nonce` and the `method` and `path` of the
 * request it is sent with. A token is accepted once, so one is signed per call
 * and never reused. No proofs (no delegation).
 */

/** Well under the service's 5-minute limit, with room for a slow connection and a slightly wrong clock. */
export const SWAP_TOKEN_TTL_SECONDS = 120;

export type SwapMethod = 'GET' | 'POST';

/** `did:ixo:` and a lowercase bech32 `ixo1...` account address: the only issuer the service accepts. */
const ACCOUNT_ADDRESS = /^ixo1[02-9ac-hj-np-z]{38,58}$/;
/** A swap id is a UUID; anything that would need escaping in a URL path is refused. */
const SWAP_ID = /^[A-Za-z0-9_-]{1,100}$/;

export function isAccountAddress(address: string): boolean {
  return ACCOUNT_ADDRESS.test(address);
}

/** The DID a swap token is issued by: `did:ixo:<address>`. */
export function accountDid(address: string): `did:ixo:${string}` {
  if (!isAccountAddress(address)) throw new Error('Not an ixo account address');
  return `did:ixo:${address}`;
}

function checkedId(swapId: string): string {
  if (!SWAP_ID.test(swapId)) throw new Error('Not a swap id');
  return swapId;
}

/** The three swap paths, exactly as sent: no host, no query string, no trailing slash. */
export const swapPaths = {
  request: (): string => '/api/swaps',
  redeem: (swapId: string): string => `/api/swaps/${checkedId(swapId)}/redeem`,
  read: (swapId: string): string => `/api/swaps/${checkedId(swapId)}`,
};

function randomNonce(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export interface SwapTokenArgs {
  /** The account's Ed25519 signer, as `did:ixo:<address>`. */
  signer: Signer;
  /** The account's own ixo address: the resource the token is for. */
  address: string;
  /** `serviceDid` from `GET /api`. */
  audience: string;
  method: SwapMethod;
  /** The path of the request this token is sent with (`swapPaths`). */
  path: string;
  /** Unix seconds the lifetime is counted from. Defaults to this device's clock. */
  nowSeconds?: number;
  /** 16 to 128 characters. Defaults to a random UUID. */
  nonce?: string;
}

/** Signs and serializes one swap token (a base64 CAR, sent as `Authorization: Bearer <token>`). */
export async function createSwapToken({
  signer,
  address,
  audience,
  method,
  path,
  nowSeconds,
  nonce,
}: SwapTokenArgs): Promise<string> {
  if (signer.did() !== accountDid(address)) {
    throw new Error('The signer is not this account: a swap token is signed by the account itself');
  }
  if (!audience.startsWith('did:')) throw new Error('The service DID is not a DID');
  if (method !== 'GET' && method !== 'POST') throw new Error('A swap token is for a GET or a POST');
  if (!path.startsWith('/api/swaps') || path.includes('?') || path.includes('#') || path.endsWith('/')) {
    throw new Error('A swap token names one swap path, without query string or trailing slash');
  }
  const delegation = await createDelegation({
    issuer: signer,
    audience,
    capabilities: [{ can: SWAP_ABILITY, with: `${RESOURCE_PREFIX}${address}` as `${string}:${string}` }],
    expiration: (nowSeconds ?? Math.floor(Date.now() / 1000)) + SWAP_TOKEN_TTL_SECONDS,
    facts: [{ nonce: nonce ?? randomNonce(), method, path }],
  });
  return serializeDelegation(delegation);
}
