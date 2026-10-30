import { fromBech32, toHex } from '@cosmjs/encoding';

import { IXO_CHAIN_ID, OFFRAMP_DESTINATION, RECOVERY_CHAIN_IDS } from '@constants/yellowcard';

/**
 * The address to give Skip for each chain a route lists in
 * `required_chain_addresses`. Pure (unit-tested in chainAddresses.test.ts).
 *
 *  - `ixo-5`          → the user's ixo address (the signer);
 *  - `8453` (Base)    → the YellowCard deposit address (known only after the sell
 *                       is created, so it is filled in last);
 *  - `1776`, `injective-1` → the YellowCard worker's REFUND wallet, from
 *                       `GET /offramp/config` `skip_chain_addresses` — the recovery
 *                       address for the Injective leg. Never derived from the
 *                       user's key;
 *  - anything else    → throw ("Aborting for safety"): never guess an address.
 */

const EVM_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

export class UnroutableChainError extends Error {
  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, UnroutableChainError.prototype);
    this.name = 'UnroutableChainError';
  }
}

function isRecoveryChain(chainId: string): boolean {
  return (RECOVERY_CHAIN_IDS as readonly string[]).includes(chainId);
}

/** Whether `chainId` needs the worker's recovery addresses (so the config fetch can be skipped otherwise). */
export function routeNeedsRecoveryAddresses(requiredChainAddresses: readonly string[]): boolean {
  return requiredChainAddresses.some(isRecoveryChain);
}

function validRecoveryAddress(chainId: string, addr: string | undefined): string {
  if (!addr) {
    throw new UnroutableChainError(
      `Skip route requires a recovery address for chain "${chainId}" but the withdrawal service did not provide one. Aborting for safety.`,
    );
  }
  if (chainId === '1776' && !EVM_ADDRESS_RE.test(addr)) {
    throw new UnroutableChainError(`Recovery address for chain 1776 is not an EVM address. Aborting for safety.`);
  }
  if (chainId === 'injective-1') {
    let prefix = '';
    try {
      prefix = fromBech32(addr).prefix;
    } catch {
      /* fall through */
    }
    if (prefix !== 'inj') {
      throw new UnroutableChainError(`Recovery address for injective-1 is not an inj1… address. Aborting for safety.`);
    }
  }
  return addr;
}

/**
 * Every address the route needs EXCEPT Base's (the deposit address), resolved
 * before the YellowCard sell is created so an unroutable route never leaves an
 * orphaned sell. Throws `UnroutableChainError` on any chain it cannot fill.
 */
export function resolvePreSellChainAddresses(params: {
  requiredChainAddresses: readonly string[];
  ixoAddress: string;
  /** `GET /offramp/config` `skip_chain_addresses`; only needed when the route asks for a recovery chain. */
  recoveryAddresses?: Readonly<Record<string, string>>;
}): Record<string, string> {
  const out: Record<string, string> = {};
  const recovery = params.recoveryAddresses ?? {};
  for (const chainId of params.requiredChainAddresses) {
    if (chainId === OFFRAMP_DESTINATION.skipChainId) continue; // filled with the deposit address later
    if (chainId === IXO_CHAIN_ID) {
      if (!params.ixoAddress) throw new UnroutableChainError('Wallet address not available');
      out[chainId] = params.ixoAddress;
      continue;
    }
    if (isRecoveryChain(chainId)) {
      out[chainId] = validRecoveryAddress(chainId, recovery[chainId]);
      continue;
    }
    throw new UnroutableChainError(
      `Skip route unexpectedly requires an address for chain "${chainId}" (expected only ${IXO_CHAIN_ID}, ${RECOVERY_CHAIN_IDS.join(
        ', ',
      )} and ${OFFRAMP_DESTINATION.skipChainId}). Aborting for safety.`,
    );
  }
  // When the route lists both recovery chains they must be the same wallet (inj1… = bech32 of the 0x bytes).
  const evm = out['1776'];
  const inj = out['injective-1'];
  if (evm && inj) {
    const same = toHex(fromBech32(inj).data) === evm.slice(2).toLowerCase();
    if (!same) {
      throw new UnroutableChainError('Recovery addresses for 1776 and injective-1 differ. Aborting for safety.');
    }
  }
  return out;
}

/** The full `chain_ids_to_addresses` map once the deposit address is known. */
export function completeChainAddresses(params: {
  requiredChainAddresses: readonly string[];
  preSell: Readonly<Record<string, string>>;
  destinationAddress: string;
}): Record<string, string> {
  const out: Record<string, string> = {};
  for (const chainId of params.requiredChainAddresses) {
    if (chainId === OFFRAMP_DESTINATION.skipChainId) {
      if (!params.destinationAddress) throw new UnroutableChainError('No deposit address for this withdrawal.');
      out[chainId] = params.destinationAddress;
      continue;
    }
    const addr = params.preSell[chainId];
    if (!addr) {
      throw new UnroutableChainError(`No address resolved for chain "${chainId}". Aborting for safety.`);
    }
    out[chainId] = addr;
  }
  return out;
}
