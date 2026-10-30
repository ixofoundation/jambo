import { describe, expect, it, vi } from 'vitest';
import { toBech32 } from '@cosmjs/encoding';

// Keep the real SDK out of the run: the MsgTransfer encoder is a pass-through here.
vi.mock('@ixo/impactxclient-sdk', () => ({
  ibc: { applications: { transfer: { v1: { MsgTransfer: { fromPartial: (v: unknown) => v } } } } },
}));

import { INJECTIVE_USDC_DENOM, NOBLE_USDC_DENOM } from '@constants/usdc';
import { BridgeBuildError, validateBridgeTxs } from './skipBridge';
// Live, read-only Skip /v2/fungible/msgs_direct answer (30 Oct 2026, 20 USDC → Base), dummy addresses.
import FX from './__fixtures__/skip-offramp-20usdc.json';

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

function tampered(edit: (msg: any) => void, wrap?: (json: any) => void) {
  const json: any = clone(FX.msgs);
  const m = json.txs[0].cosmos_tx.msgs[0];
  const msg = JSON.parse(m.msg);
  edit(msg);
  m.msg = JSON.stringify(msg);
  wrap?.(json);
  return json;
}

const expected = {
  userAddress: FX.user,
  amountInMicro: FX.route.amount_in,
  quotedAmountOutMicro: FX.route.amount_out,
  nowMs: FX.requestedAtMs,
};

function expectAbort(json: any, exp = expected) {
  expect(() => validateBridgeTxs(json, exp)).toThrow(BridgeBuildError);
}

describe('validateBridgeTxs (live msgs_direct answer)', () => {
  it('accepts the live answer and returns its one MsgTransfer', () => {
    const m = validateBridgeTxs(FX.msgs, expected);
    expect(m.typeUrl).toBe('/ibc.applications.transfer.v1.MsgTransfer');
    expect(m.value.sender).toBe(FX.user);
    expect(m.value.token).toEqual({ denom: INJECTIVE_USDC_DENOM, amount: FX.route.amount_in });
  });

  it('wrong sender → abort', () =>
    expectAbort(tampered((m) => (m.sender = toBech32('ixo', new Uint8Array(20).fill(9))))));
  it('legacy USDC → abort', () => expectAbort(tampered((m) => (m.token.denom = NOBLE_USDC_DENOM))));
  it('more than asked → abort', () => expectAbort(tampered((m) => (m.token.amount = '20000001'))));
  it('another channel → abort', () => expectAbort(tampered((m) => (m.source_channel = 'channel-26'))));
  it('a memo → abort (the off-ramp has none)', () =>
    expectAbort(tampered((m) => (m.memo = JSON.stringify({ forward: { receiver: 'noble1x' } })))));
  it('a receiver that is not an inj1 account → abort', () =>
    expectAbort(tampered((m) => (m.receiver = toBech32('noble', new Uint8Array(20).fill(9))))));
  it('a 32-byte inj1 contract receiver → abort', () =>
    expectAbort(tampered((m) => (m.receiver = toBech32('inj', new Uint8Array(32).fill(9))))));
  it('timeout passed → abort', () => expectAbort(tampered((m) => (m.timeout_timestamp = 1))));
  it('two transactions → abort', () =>
    expectAbort(
      tampered(
        () => undefined,
        (j) => j.txs.push(j.txs[0]),
      ),
    ));
  it('two messages → abort', () =>
    expectAbort(
      tampered(
        () => undefined,
        (j) => j.txs[0].cosmos_tx.msgs.push(j.txs[0].cosmos_tx.msgs[0]),
      ),
    ));
  it('delivers clearly less than the quote that sized the sell → abort', () =>
    expectAbort(FX.msgs, { ...expected, quotedAmountOutMicro: String(BigInt(FX.route.amount_out) + BigInt(200_000)) }));
  it('a tiny difference from the quote is fine', () =>
    expect(() =>
      validateBridgeTxs(FX.msgs, {
        ...expected,
        quotedAmountOutMicro: String(BigInt(FX.route.amount_out) + BigInt(10)),
      }),
    ).not.toThrow());
});
