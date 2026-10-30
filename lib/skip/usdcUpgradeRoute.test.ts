import { describe, expect, it, vi } from 'vitest';
import { toBase64, toBech32 } from '@cosmjs/encoding';

// Keep the real SDK out of the run: the MsgTransfer encoder is a pass-through here.
vi.mock('@ixo/impactxclient-sdk', () => ({
  ibc: { applications: { transfer: { v1: { MsgTransfer: { fromPartial: (v: unknown) => v } } } } },
}));

import { INJECTIVE_USDC_DENOM, NOBLE_USDC_DENOM } from '@constants/usdc';
import {
  UPGRADE_NOT_AVAILABLE,
  UPGRADE_START_FAILED,
  UsdcUpgradeError,
  parseUpgradeRoute,
  upgradeAddressList,
  validateUpgradeTxs,
} from './usdcUpgradeRoute';
// Live, read-only Skip /v2/fungible/msgs answers (30 Oct 2026), dummy addresses per role.
import OSMOSIS from './__fixtures__/skip-upgrade-osmosis-5usdc.json';
import TERRA from './__fixtures__/skip-upgrade-terra-1usdc.json';

const bytes = (n: number) => new Uint8Array(20).fill(n);
const USER = toBech32('ixo', bytes(1));
const OTHER = toBech32('ixo', bytes(2));
const REFUND: Record<string, string> = {
  'noble-1': toBech32('noble', bytes(9)),
  'osmosis-1': toBech32('osmo', bytes(9)),
  'phoenix-1': toBech32('terra', bytes(9)),
  'injective-1': toBech32('inj', bytes(9)),
  '1776': '0x0909090909090909090909090909090909090909',
};

// The live answer of 30 Oct 2026 (5 USDC), trimmed.
const ROUTE = {
  source_asset_denom: NOBLE_USDC_DENOM,
  source_asset_chain_id: 'ixo-5',
  dest_asset_denom: INJECTIVE_USDC_DENOM,
  dest_asset_chain_id: 'ixo-5',
  amount_in: '5000000',
  amount_out: '5000000',
  operations: [{ transfer: {} }],
  txs_required: 1,
  required_chain_addresses: ['ixo-5', 'noble-1', 'osmosis-1', 'injective-1', 'ixo-5'],
  estimated_route_duration_seconds: 120,
};

function expectAbort(fn: () => unknown, reason: string) {
  try {
    fn();
  } catch (err) {
    expect(err).toBeInstanceOf(UsdcUpgradeError);
    expect((err as UsdcUpgradeError).reason).toBe(reason);
    // Customer copy only — never Skip/chain words.
    expect([UPGRADE_START_FAILED, UPGRADE_NOT_AVAILABLE]).toContain((err as Error).message);
    expect((err as Error).message).not.toMatch(/skip|noble|injective|ibc|chain/i);
    return;
  }
  throw new Error('expected an abort');
}

const expect5 = { sourceDenom: NOBLE_USDC_DENOM, amountMicro: '5000000' };

describe('parseUpgradeRoute', () => {
  it('accepts the one-tx 1:1 route', () => {
    const r = parseUpgradeRoute(ROUTE, expect5);
    expect(r.requiredChainAddresses).toEqual(ROUTE.required_chain_addresses);
    expect(r.estimatedDurationSeconds).toBe(120);
  });

  it('accepts a route returning slightly more (terra-astroport, 1 → 1.000061)', () => {
    expect(() =>
      parseUpgradeRoute(
        { ...ROUTE, amount_in: '1000000', amount_out: '1000061' },
        { ...expect5, amountMicro: '1000000' },
      ),
    ).not.toThrow();
  });

  it('refuses a multi-tx route', () =>
    expectAbort(() => parseUpgradeRoute({ ...ROUTE, txs_required: 2 }, expect5), 'unexpected_route'));
  it('refuses the wrong denoms', () => {
    expectAbort(() => parseUpgradeRoute({ ...ROUTE, dest_asset_denom: NOBLE_USDC_DENOM }, expect5), 'unexpected_route');
    expectAbort(() => parseUpgradeRoute({ ...ROUTE, source_asset_denom: 'uixo' }, expect5), 'unexpected_route');
  });
  it('refuses a quote for another amount', () =>
    expectAbort(() => parseUpgradeRoute({ ...ROUTE, amount_in: '4000000' }, expect5), 'unexpected_route'));
  it('refuses a quote losing more than 0.5%', () => {
    expectAbort(() => parseUpgradeRoute({ ...ROUTE, amount_out: '4974999' }, expect5), 'quote_too_low');
    expect(() => parseUpgradeRoute({ ...ROUTE, amount_out: '4975000' }, expect5)).not.toThrow();
  });
});

describe('upgradeAddressList', () => {
  it('ixo-5 (both ends) → the user; every hop → the worker refund wallet', () => {
    expect(upgradeAddressList(ROUTE.required_chain_addresses, USER, REFUND)).toEqual([
      USER,
      REFUND['noble-1'],
      REFUND['osmosis-1'],
      REFUND['injective-1'],
      USER,
    ]);
  });

  it('the Terra variant works too', () => {
    expect(upgradeAddressList(['ixo-5', 'noble-1', 'phoenix-1', 'injective-1', 'ixo-5'], USER, REFUND)[2]).toBe(
      REFUND['phoenix-1'],
    );
  });

  it('a chain missing from the worker map aborts (fail closed)', () => {
    expectAbort(() => upgradeAddressList(ROUTE.required_chain_addresses, USER, {}), 'missing_address');
    expectAbort(() => upgradeAddressList(['ixo-5', 'cosmoshub-4', 'ixo-5'], USER, REFUND), 'missing_address');
  });

  it('a wrong-prefix hop address aborts', () => {
    expectAbort(
      () => upgradeAddressList(ROUTE.required_chain_addresses, USER, { ...REFUND, 'osmosis-1': REFUND['noble-1'] }),
      'missing_address',
    );
  });

  it('no valid user address aborts', () =>
    expectAbort(() => upgradeAddressList(['ixo-5'], '', REFUND), 'missing_address'));
});

type Fixture = typeof OSMOSIS;
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

/** The fixture's msgs answer, with its MsgTransfer (parsed; `memo` parsed too) edited by `edit`. */
function tampered(fx: Fixture, edit: (msg: any, memo: any) => void, wrap?: (json: any) => void) {
  const json: any = clone(fx.msgs);
  const m = json.txs[0].cosmos_tx.msgs[0];
  const msg = JSON.parse(m.msg);
  const original = msg.memo;
  const memo = JSON.parse(original);
  edit(msg, memo);
  // Re-serialise the edited memo unless the edit replaced the memo string itself.
  if (msg.memo === original) msg.memo = JSON.stringify(memo);
  m.msg = JSON.stringify(msg);
  wrap?.(json);
  return json;
}

/** The nested post-swap transfer of the upgrade memo (both venues share the shape). */
const ibcInfo = (memo: any) => memo.forward.next.wasm.msg.swap_and_action.post_swap_action.ibc_transfer.ibc_info;

const expectFor = (fx: Fixture) => ({
  userAddress: fx.user,
  denom: NOBLE_USDC_DENOM,
  amountMicro: fx.route.amount_in,
  skipChainAddresses: fx.chain_addresses as Record<string, string>,
  nowMs: fx.requestedAtMs,
});

describe('validateUpgradeTxs (live answers)', () => {
  it.each([
    ['osmosis', OSMOSIS],
    ['terra', TERRA as unknown as Fixture],
  ])('accepts the %s route and returns its one MsgTransfer', (_, fx) => {
    const m = validateUpgradeTxs(fx.msgs, expectFor(fx));
    expect(m.typeUrl).toBe('/ibc.applications.transfer.v1.MsgTransfer');
    expect(m.value.sender).toBe(fx.user);
    expect(m.value.token).toEqual({ denom: NOBLE_USDC_DENOM, amount: fx.route.amount_in });
  });

  const reject = (edit: (msg: any, memo: any) => void, wrap?: (json: any) => void) =>
    expectAbort(() => validateUpgradeTxs(tampered(OSMOSIS, edit, wrap), expectFor(OSMOSIS)), 'unexpected_msgs');

  it('wrong sender → abort', () => reject((msg) => (msg.sender = OTHER)));
  it('wrong amount → abort', () => reject((msg) => (msg.token.amount = '4999999')));
  it('wrong denom → abort', () => reject((msg) => (msg.token.denom = INJECTIVE_USDC_DENOM)));
  it('another channel → abort', () => reject((msg) => (msg.source_channel = 'channel-31')));
  it('another port → abort', () => reject((msg) => (msg.source_port = 'wasm.x')));
  it('first hop not our noble-1 address → abort', () => reject((msg) => (msg.receiver = toBech32('noble', bytes(7)))));
  it('timeout already passed → abort', () => reject((msg) => (msg.timeout_timestamp = 1)));
  it('timeout more than 2 h ahead → abort', () =>
    reject((msg) => (msg.timeout_timestamp = (OSMOSIS.requestedAtMs + 3 * 3600 * 1000) * 1e6)));
  it('final hop to someone else → abort', () =>
    reject((_, memo) => {
      ibcInfo(memo).memo = ibcInfo(memo).memo.replace(OSMOSIS.user, OTHER);
    }));
  it('recover_address the user controls → abort', () =>
    reject((_, memo) => (ibcInfo(memo).recover_address = toBech32('osmo', bytes(1)))));
  it('recover_address = the user’s own ixo address → abort (not our recovery wallet)', () =>
    reject((_, memo) => (ibcInfo(memo).recover_address = OSMOSIS.user)));
  it('a stranger contract → abort', () =>
    reject((_, memo) => (memo.forward.next.wasm.contract = toBech32('osmo', new Uint8Array(32).fill(3)))));
  it('an affiliate fee taker → abort', () =>
    reject((_, memo) => {
      memo.forward.next.wasm.msg.swap_and_action.affiliates = [
        { address: toBech32('osmo', bytes(8)), basis_points_fee: '100' },
      ];
    }));
  it('an EVM / CCTP recipient anywhere → abort', () =>
    reject((_, memo) => (memo.forward.next.mint_recipient = toBase64(new Uint8Array(32).fill(0xab)))));
  it('swap minimum below 99% → abort', () =>
    reject((_, memo) => (memo.forward.next.wasm.msg.swap_and_action.min_asset.native.amount = '4900000')));
  it('swap minimum in another token → abort', () =>
    reject((_, memo) => (memo.forward.next.wasm.msg.swap_and_action.min_asset.native.denom = 'uosmo')));
  it('nested memo that is not JSON → abort', () => reject((_, memo) => (ibcInfo(memo).memo = '{not json')));
  it('empty memo → abort', () => reject((msg) => (msg.memo = '')));
  it('more than one tx → abort', () =>
    reject(
      () => undefined,
      (json) => json.txs.push(json.txs[0]),
    ));
  it('more than one message → abort', () =>
    reject(
      () => undefined,
      (json) => json.txs[0].cosmos_tx.msgs.push(json.txs[0].cosmos_tx.msgs[0]),
    ));
  it('a tx on another chain → abort', () =>
    reject(
      () => undefined,
      (json) => (json.txs[0].cosmos_tx.chain_id = 'noble-1'),
    ));
  it('another message type → abort', () =>
    reject(
      () => undefined,
      (json) => (json.txs[0].cosmos_tx.msgs[0].msg_type_url = '/cosmos.bank.v1beta1.MsgSend'),
    ));
  it('no txs at all → abort', () =>
    expectAbort(() => validateUpgradeTxs({ txs: [] }, expectFor(OSMOSIS)), 'unexpected_msgs'));
  it('pool contracts inside the swap are not checked (they never receive funds)', () => {
    const json = tampered(TERRA as unknown as Fixture, (_, memo) => {
      memo.forward.next.wasm.msg.swap_and_action.user_swap.swap_exact_asset_in.operations[0].pool = toBech32(
        'terra',
        new Uint8Array(32).fill(6),
      );
    });
    expect(() => validateUpgradeTxs(json, expectFor(TERRA as unknown as Fixture))).not.toThrow();
  });
});
