import { parseDelegation, signerFromMnemonic, type SupportedDID } from '@ixo/ucan';
import { describe, expect, it } from 'vitest';

import { SWAP_TOKEN_TTL_SECONDS, accountDid, createSwapToken, isAccountAddress, swapPaths } from './swapToken';
import { ADDRESS, SERVICE_DID, SWAP_ID } from './testFixtures';

// A throwaway key: the standard BIP-39 test vector.
const MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

async function signerOf(did: string) {
  return (await signerFromMnemonic(MNEMONIC, did as SupportedDID)).signer;
}

describe('the swap token', () => {
  it('is issued by the account itself, to the service, for its own resource and one request', async () => {
    const signer = await signerOf(`did:ixo:${ADDRESS}`);
    const path = swapPaths.redeem(SWAP_ID);
    const token = await createSwapToken({
      signer,
      address: ADDRESS,
      audience: SERVICE_DID,
      method: 'POST',
      path,
      nowSeconds: 1_795_000_000,
    });

    const parsed = await parseDelegation(token);
    expect(parsed.issuer.did()).toBe(`did:ixo:${ADDRESS}`);
    expect(parsed.audience.did()).toBe(SERVICE_DID);
    expect(parsed.capabilities).toEqual([{ can: 'airtime-voucher/swap', with: `ixo:airtime-voucher:${ADDRESS}` }]);
    expect(parsed.expiration).toBe(1_795_000_000 + SWAP_TOKEN_TTL_SECONDS);
    expect(SWAP_TOKEN_TTL_SECONDS).toBeLessThan(300);
    // No delegation: the token stands on the account's own signature.
    expect(parsed.proofs).toEqual([]);

    expect(parsed.facts).toHaveLength(1);
    const fact = parsed.facts[0] as Record<string, unknown>;
    expect(fact.method).toBe('POST');
    expect(fact.path).toBe(`/api/swaps/${SWAP_ID}/redeem`);
    expect(typeof fact.nonce).toBe('string');
    expect((fact.nonce as string).length).toBeGreaterThanOrEqual(16);
    expect((fact.nonce as string).length).toBeLessThanOrEqual(128);
  });

  it('never makes the same token twice: every call has its own nonce', async () => {
    const signer = await signerOf(`did:ixo:${ADDRESS}`);
    const args = {
      signer,
      address: ADDRESS,
      audience: SERVICE_DID,
      method: 'GET' as const,
      path: swapPaths.read(SWAP_ID),
      nowSeconds: 1_795_000_000,
    };
    const [a, b] = await Promise.all([createSwapToken(args), createSwapToken(args)]);
    expect(a).not.toBe(b);
    const nonces = await Promise.all(
      [a, b].map(async (t) => ((await parseDelegation(t)).facts[0] as Record<string, unknown>).nonce),
    );
    expect(nonces[0]).not.toBe(nonces[1]);
  });

  it('names the three swap paths exactly, with no trailing slash or query', () => {
    expect(swapPaths.request()).toBe('/api/swaps');
    expect(swapPaths.redeem(SWAP_ID)).toBe(`/api/swaps/${SWAP_ID}/redeem`);
    expect(swapPaths.read(SWAP_ID)).toBe(`/api/swaps/${SWAP_ID}`);
    expect(() => swapPaths.read('../tokens')).toThrow();
    expect(() => swapPaths.redeem('a/b')).toThrow();
    expect(() => swapPaths.read('')).toThrow();
  });

  it('refuses to sign for another account, another DID form, or a path that is not one request', async () => {
    const signer = await signerOf(`did:ixo:${ADDRESS}`);
    const base = { signer, address: ADDRESS, audience: SERVICE_DID, method: 'POST' as const, path: '/api/swaps' };
    const other = 'ixo1zzzsyqcyq5rqwzqfpg9scrgwpugpzysn3w7apx';
    await expect(createSwapToken({ ...base, address: other })).rejects.toThrow(/account itself/);
    await expect(createSwapToken({ ...base, path: '/api/swaps/' })).rejects.toThrow();
    await expect(createSwapToken({ ...base, path: '/api/swaps?limit=1' })).rejects.toThrow();
    await expect(createSwapToken({ ...base, path: '/api/mints' })).rejects.toThrow();
    await expect(createSwapToken({ ...base, audience: 'airtime.example.org' })).rejects.toThrow();

    const entitySigner = await signerOf('did:ixo:entity:abc');
    await expect(createSwapToken({ ...base, signer: entitySigner })).rejects.toThrow();
  });

  it('only takes a lowercase ixo account address', () => {
    expect(isAccountAddress(ADDRESS)).toBe(true);
    expect(isAccountAddress(ADDRESS.toUpperCase())).toBe(false);
    expect(isAccountAddress('cosmos1qqqsyqcyq5rqwzqfpg9scrgwpugpzysn3w7apx')).toBe(false);
    expect(() => accountDid('entity:abc')).toThrow();
    expect(accountDid(ADDRESS)).toBe(`did:ixo:${ADDRESS}`);
  });
});
