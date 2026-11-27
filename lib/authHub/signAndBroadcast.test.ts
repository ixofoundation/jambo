import { cosmos } from '@ixo/impactxclient-sdk';
import Long from 'long';
import { describe, expect, it, vi } from 'vitest';

import { estimateFee, simulateGas, type TxSimulator } from './signAndBroadcast';

const SEQUENCE = 42;
const signer = {
  getAccounts: async () => [{ address: 'ixo1user', algo: 'secp256k1' as const, pubkey: new Uint8Array() }],
};

/** A TxBody with a message and the smart-account extension, as the signer encodes it. */
const txBodyBytes = cosmos.tx.v1beta1.TxBody.encode(
  cosmos.tx.v1beta1.TxBody.fromPartial({
    messages: [{ typeUrl: '/cosmos.bank.v1beta1.MsgSend', value: new Uint8Array([1, 2, 3]) }],
    memo: 'Airtime swap',
    nonCriticalExtensionOptions: [{ typeUrl: '/ixo.smartaccount.v1beta1.TxExtension', value: new Uint8Array([8, 7]) }],
  }),
).finish();

function simulator(gasUsed: number | Error) {
  const simulate = vi.fn(async (_request: { txBytes: Uint8Array }) => {
    if (gasUsed instanceof Error) throw gasUsed;
    return { gasInfo: { gasWanted: Long.fromNumber(0), gasUsed: Long.fromNumber(gasUsed) } } as any;
  });
  const client: TxSimulator = { cosmos: { tx: { v1beta1: { simulate } } } };
  return { client, simulate };
}

describe('simulateGas', () => {
  it('simulates the exact TxBody with the signer pubkey, the sequence and an empty signature', async () => {
    const { client, simulate } = simulator(123_456);

    await expect(simulateGas(client, signer, txBodyBytes, SEQUENCE)).resolves.toBe(123_456);

    const { txBytes } = simulate.mock.calls[0][0];
    const tx = cosmos.tx.v1beta1.Tx.decode(txBytes);
    // The body goes through untouched: the TxExtension is what the chain's ante handler keys on.
    expect(cosmos.tx.v1beta1.TxBody.encode(tx.body!).finish()).toEqual(txBodyBytes);
    expect(tx.body!.nonCriticalExtensionOptions.map((o) => o.typeUrl)).toEqual([
      '/ixo.smartaccount.v1beta1.TxExtension',
    ]);
    // One signer, one (empty) signature: the authenticators skip verification under simulation.
    expect(tx.authInfo!.signerInfos).toHaveLength(1);
    expect(tx.signatures.map((sig) => sig.length)).toEqual([0]);
    const [signerInfo] = tx.authInfo!.signerInfos;
    expect(Long.fromValue(signerInfo.sequence).toNumber()).toBe(SEQUENCE);
    // The session signer's pubkey is empty on purpose (the chain verifies via the authenticator).
    expect(signerInfo.publicKey?.typeUrl).toBe('/cosmos.crypto.secp256k1.PubKey');
    expect(cosmos.crypto.secp256k1.PubKey.decode(signerInfo.publicKey!.value).key.length).toBe(0);
    expect(signerInfo.modeInfo?.single?.mode).toBe(cosmos.tx.signing.v1beta1.SignMode.SIGN_MODE_DIRECT);
    // No fee in the request: the limit is what the simulation is for.
    expect(tx.authInfo!.fee?.amount).toEqual([]);
  });

  it('refuses an answer without gas info', async () => {
    const simulate = vi.fn(async () => ({} as any));
    const client: TxSimulator = { cosmos: { tx: { v1beta1: { simulate } } } };
    await expect(simulateGas(client, signer, txBodyBytes, SEQUENCE)).rejects.toThrow(/no gas info/);
  });
});

describe('estimateFee', () => {
  it('uses the simulated gas with headroom', async () => {
    const { client } = simulator(200_000);
    await expect(estimateFee(client, signer, txBodyBytes, SEQUENCE, 1, 600_000)).resolves.toEqual({
      amount: [{ denom: 'uixo', amount: '10500' }],
      gas: '300000',
    });
  });

  it("falls back to the caller's limit when the simulation fails", async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { client } = simulator(new Error('rpc down'));
    await expect(estimateFee(client, signer, txBodyBytes, SEQUENCE, 1, 600_000)).resolves.toEqual({
      amount: [{ denom: 'uixo', amount: '21000' }],
      gas: '600000',
    });
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });

  it('falls back to the per-message estimate without a query client or a limit', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(estimateFee(null, signer, txBodyBytes, SEQUENCE, 2)).resolves.toEqual({
      amount: [{ denom: 'uixo', amount: '29750' }],
      gas: '850000',
    });
    warn.mockRestore();
  });
});
