import { CHAIN_NETWORK_TYPE, DefaultChainNetwork } from '@constants/common';

/**
 * IXO Names worker (ixoworld/ixo-names-worker): one batched resolver for the
 * names, avatars, Matrix homeservers/user ids and account/entity rooms of IXO
 * identifiers. One deployment per network; the local chain has none.
 */
export const NAMES_WORKER_BY_NETWORK: Record<CHAIN_NETWORK_TYPE, string | null> = {
  [CHAIN_NETWORK_TYPE.MAINNET]: 'https://names.ixo.earth',
  [CHAIN_NETWORK_TYPE.TESTNET]: 'https://testnet.names.ixo.earth',
  [CHAIN_NETWORK_TYPE.DEVNET]: 'https://devnet.names.ixo.earth',
  [CHAIN_NETWORK_TYPE.LOCAL]: null,
};

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1']);

/** An override is used only when it is https://, or http:// to this machine (a local worker). */
export function isAcceptableNamesWorkerUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || (url.protocol === 'http:' && LOCAL_HOSTS.has(url.hostname));
  } catch {
    return false;
  }
}

/**
 * Names worker base URL: a valid `override` (trimmed), else the network's
 * deployment, else '' (names then fall back to the client's abbreviation and
 * nothing is requested). An invalid override is ignored with a warning.
 */
export function resolveNamesWorkerUrl(override: string | undefined, network: string): string {
  const fallback = NAMES_WORKER_BY_NETWORK[network as CHAIN_NETWORK_TYPE] ?? '';
  const value = override?.trim();
  if (!value) return fallback;
  if (isAcceptableNamesWorkerUrl(value)) return value;
  console.warn(
    `[names] ignoring NEXT_PUBLIC_NAMES_WORKER_URL=${JSON.stringify(value)}: must be https:// or http://localhost / http://127.0.0.1; using ${fallback || 'no worker'}`,
  );
  return fallback;
}

/** NEXT_PUBLIC_NAMES_WORKER_URL (e.g. a local `wrangler dev` worker on http://localhost:8799) or the network's deployment. */
export const NAMES_WORKER_URL = resolveNamesWorkerUrl(process.env.NEXT_PUBLIC_NAMES_WORKER_URL, DefaultChainNetwork);

/** Sent as `X-Client-Id`: the worker's per-service rate-limit bucket and log attribution. */
export const NAMES_CLIENT_ID = 'jambo';
