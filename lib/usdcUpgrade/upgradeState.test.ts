import { describe, expect, it, vi } from 'vitest';

vi.mock('@ixo/impactxclient-sdk', () => ({
  ibc: { applications: { transfer: { v1: { MsgTransfer: { fromPartial: (v: unknown) => v } } } } },
}));

import { INJECTIVE_USDC_DENOM, NOBLE_USDC_DENOM } from '@constants/usdc';
import { SignBroadcastError } from 'lib/authHub/signAndBroadcast';
import { UsdcUpgradeError } from 'lib/skip/usdcUpgradeRoute';
import { RampApiError } from 'lib/yellowcard/offrampClient';
import {
  type KeyValueStore,
  type PendingUpgrade,
  type UpgradeView,
  attentionReleased,
  broadcastFailureStage,
  classifyRegisterError,
  clearPendingUpgrade,
  inFlightMicro,
  isSettledStatus,
  loadPendingUpgrade,
  nextPollDelayMs,
  parsePendingUpgrade,
  pendingUpgradeKey,
  resolveUpgradeStatus,
  savePendingUpgrade,
  upgradeCopy,
  upgradeErrorMessage,
  upgradeErrorRetryable,
  upgradeOffer,
} from './upgradeState';

const HASH = 'AB'.repeat(32);
const ADDR = 'ixo1user';
const M = (usdc: number) => BigInt(Math.round(usdc * 1e6));

function memStore(): KeyValueStore & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

const record: PendingUpgrade = {
  v: 2,
  address: ADDR,
  txHash: HASH,
  amountMicro: '50000000',
  startedAt: 1_700_000_000_000,
  stage: 'signed',
  registered: false,
  legacyAtStartMicro: '50000000',
  upgradedAtStartMicro: '10000000',
};

describe('upgradeOffer (upgrade-needed detection)', () => {
  const held = [{ denom: NOBLE_USDC_DENOM, micro: BigInt(50_000_000) }];

  it('the whole legacy balance, when the worker lists the denom', () => {
    expect(upgradeOffer(held, [NOBLE_USDC_DENOM])).toEqual({ denom: NOBLE_USDC_DENOM, micro: BigInt(50_000_000) });
  });

  it('nothing when the worker lists no legacy denom (testnet, old worker)', () => {
    expect(upgradeOffer(held, [])).toBeNull();
  });

  it('nothing for dust below 0.01 USDC; 0.01 USDC is offered', () => {
    expect(upgradeOffer([{ denom: NOBLE_USDC_DENOM, micro: BigInt(9_999) }], [NOBLE_USDC_DENOM])).toBeNull();
    expect(upgradeOffer([{ denom: NOBLE_USDC_DENOM, micro: BigInt(10_000) }], [NOBLE_USDC_DENOM])).toEqual({
      denom: NOBLE_USDC_DENOM,
      micro: BigInt(10_000),
    });
  });

  it('a needs-attention upgrade stops blocking a new one only after 24 h', () => {
    const base = { status: 'needs_attention', unconfirmed: false, startedAt: 0 };
    expect(attentionReleased({ ...base, now: 24 * 60 * 60 * 1000 - 1 })).toBe(false);
    expect(attentionReleased({ ...base, now: 24 * 60 * 60 * 1000 })).toBe(true);
    expect(attentionReleased({ ...base, status: 'in_progress', now: 48 * 60 * 60 * 1000 })).toBe(false);
    expect(attentionReleased({ ...base, unconfirmed: true, now: 48 * 60 * 60 * 1000 })).toBe(false);
  });

  it('nothing for a zero balance or unknown balances', () => {
    expect(upgradeOffer([{ denom: NOBLE_USDC_DENOM, micro: BigInt(0) }], [NOBLE_USDC_DENOM])).toBeNull();
    expect(upgradeOffer(null, [NOBLE_USDC_DENOM])).toBeNull();
  });

  it('never offers the withdrawable USDC itself', () => {
    expect(upgradeOffer([{ denom: INJECTIVE_USDC_DENOM, micro: BigInt(1) }], [NOBLE_USDC_DENOM])).toBeNull();
  });
});

describe('pending upgrade (resume after reload)', () => {
  it('round-trips through storage', () => {
    const store = memStore();
    savePendingUpgrade(store, record);
    expect(loadPendingUpgrade(store, ADDR)).toEqual(record);
    clearPendingUpgrade(store, ADDR);
    expect(loadPendingUpgrade(store, ADDR)).toBeNull();
  });

  it('never resumes another account’s upgrade', () => {
    const store = memStore();
    savePendingUpgrade(store, record);
    expect(loadPendingUpgrade(store, 'ixo1other')).toBeNull();
    // Even a record copied under the wrong key.
    expect(parsePendingUpgrade(JSON.stringify(record), 'ixo1other')).toBeNull();
  });

  it('drops a malformed record (and removes it)', () => {
    const store = memStore();
    store.setItem(pendingUpgradeKey(ADDR), '{"v":2,"address":"ixo1user","txHash":"nope"}');
    expect(loadPendingUpgrade(store, ADDR)).toBeNull();
    expect(store.map.size).toBe(0);
    expect(parsePendingUpgrade('not json', ADDR)).toBeNull();
    expect(parsePendingUpgrade(JSON.stringify({ ...record, amountMicro: '1e6' }), ADDR)).toBeNull();
    expect(parsePendingUpgrade(JSON.stringify({ ...record, stage: 'sent' }), ADDR)).toBeNull();
    expect(parsePendingUpgrade(JSON.stringify({ ...record, legacyAtStartMicro: undefined }), ADDR)).toBeNull();
    // A record from before the balances-at-start were stored (never shipped) is dropped.
    expect(parsePendingUpgrade(JSON.stringify({ ...record, v: 1 }), ADDR)).toBeNull();
  });

  it('a throwing or missing storage never throws', () => {
    const broken: KeyValueStore = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    };
    expect(loadPendingUpgrade(broken, ADDR)).toBeNull();
    expect(() => savePendingUpgrade(broken, record)).not.toThrow();
    expect(() => clearPendingUpgrade(broken, ADDR)).not.toThrow();
    expect(loadPendingUpgrade(null, ADDR)).toBeNull();
  });

  it('keeps the registered flag and normalises the hash', () => {
    const r = parsePendingUpgrade(JSON.stringify({ ...record, txHash: HASH.toLowerCase(), registered: true }), ADDR);
    expect(r?.txHash).toBe(HASH);
    expect(r?.registered).toBe(true);
  });
});

describe('resolveUpgradeStatus (status mapping)', () => {
  it('the worker is authoritative', () => {
    for (const s of ['in_progress', 'completed', 'returning', 'returned', 'needs_attention'] as const) {
      expect(resolveUpgradeStatus({ worker: s, skipState: 'STATE_COMPLETED_SUCCESS' })).toBe(s);
    }
  });

  it('worker unreachable: Skip success → completed, anything else stays in progress', () => {
    expect(resolveUpgradeStatus({ worker: null, skipState: 'STATE_COMPLETED_SUCCESS' })).toBe('completed');
    expect(resolveUpgradeStatus({ worker: null, skipState: 'STATE_COMPLETED_ERROR' })).toBe('in_progress');
    expect(resolveUpgradeStatus({ worker: null, skipState: 'STATE_ABANDONED' })).toBe('in_progress');
    expect(resolveUpgradeStatus({ worker: null, skipState: null })).toBe('in_progress');
  });

  it('settled', () => {
    expect(isSettledStatus('completed') && isSettledStatus('returned')).toBe(true);
    expect(isSettledStatus('needs_attention') || isSettledStatus('returning')).toBe(false);
  });

  it('polls every 15 s for 3 min, every 30 s until 10 min, then every minute', () => {
    expect(nextPollDelayMs(0)).toBe(15_000);
    expect(nextPollDelayMs(2 * 60_000 + 59_000)).toBe(15_000);
    expect(nextPollDelayMs(3 * 60_000)).toBe(30_000);
    expect(nextPollDelayMs(9 * 60_000)).toBe(30_000);
    expect(nextPollDelayMs(10 * 60_000)).toBe(60_000);
    expect(nextPollDelayMs(5 * 60 * 60_000)).toBe(60_000);
  });
});

describe('classifyRegisterError (POST /usdc-upgrade answers)', () => {
  const api = (status: number, code?: string, retryAfterSec?: number) =>
    new RampApiError('x', { status, code, retryAfterSec });

  it('503 tx_pending / verification_unavailable, 429, 5xx and network failures are retried', () => {
    expect(classifyRegisterError(api(503, 'tx_pending', 5))).toEqual({ kind: 'retry', retryAfterMs: 5000 });
    expect(classifyRegisterError(api(503, 'verification_unavailable'))).toEqual({
      kind: 'retry',
      retryAfterMs: undefined,
    });
    expect(classifyRegisterError(api(429, undefined, 60))).toEqual({ kind: 'retry', retryAfterMs: 60_000 });
    expect(classifyRegisterError(api(502))).toEqual({ kind: 'retry', retryAfterMs: undefined });
    expect(classifyRegisterError(new TypeError('Failed to fetch'))).toEqual({ kind: 'retry' });
  });

  it('422 tx_failed: the transfer failed on chain', () => {
    expect(classifyRegisterError(api(422, 'tx_failed'))).toEqual({ kind: 'tx_failed' });
  });

  it('every other 400 / 403 / 409 / 422 is permanent', () => {
    for (const [s, c] of [
      [422, 'not_an_upgrade'],
      [403, 'not_your_transaction'],
      [403, 'unsupported_account'],
      [409, 'conflict'],
      [400, 'upgrade_not_available'],
      [400, undefined],
    ] as const) {
      expect(classifyRegisterError(api(s, c))).toEqual({ kind: 'refused' });
    }
  });
});

describe('broadcastFailureStage', () => {
  it('follows the signer’s verdict', () => {
    expect(broadcastFailureStage(new SignBroadcastError('not_sent', null, new Error('x')))).toBe('not_sent');
    expect(broadcastFailureStage(new SignBroadcastError('failed_on_chain', HASH, new Error('x')))).toBe(
      'failed_on_chain',
    );
    expect(broadcastFailureStage(new SignBroadcastError('maybe_sent', HASH, new Error('x')))).toBe('maybe_sent');
  });

  it('a raw cosmjs inclusion time-out may still land; anything else did not go out', () => {
    const timeout = new Error(`Transaction with ID ${HASH} was submitted but was not yet found on the chain.`);
    expect(broadcastFailureStage(timeout)).toBe('maybe_sent');
    expect(broadcastFailureStage(new Error('Session expired — please sign in again'))).toBe('not_sent');
  });
});

describe('inFlightMicro (the one total never counts the upgrade twice)', () => {
  // 50 legacy + 10 upgraded at signing; the whole 50 is upgraded.
  const at = { amountMicro: M(50), legacyAtStartMicro: M(50), upgradedAtStartMicro: M(10) };
  const total = (legacyNow: bigint, upgradedNow: bigint) =>
    legacyNow + upgradedNow + inFlightMicro({ ...at, legacyNowMicro: legacyNow, upgradedNowMicro: upgradedNow });

  it('before broadcast (still legacy): nothing extra', () => {
    expect(inFlightMicro({ ...at, legacyNowMicro: M(50), upgradedNowMicro: M(10) })).toBe(M(0));
    expect(total(M(50), M(10))).toBe(M(60));
  });

  it('mid-flight (left the wallet, not landed): the whole amount', () => {
    expect(inFlightMicro({ ...at, legacyNowMicro: M(0), upgradedNowMicro: M(10) })).toBe(M(50));
    expect(total(M(0), M(10))).toBe(M(60));
  });

  it('landed before the worker says completed: nothing extra', () => {
    expect(inFlightMicro({ ...at, legacyNowMicro: M(0), upgradedNowMicro: M(60) })).toBe(M(0));
    expect(total(M(0), M(60))).toBe(M(60));
  });

  it('came back as legacy (returned): nothing extra', () => {
    expect(inFlightMicro({ ...at, legacyNowMicro: M(50), upgradedNowMicro: M(10) })).toBe(M(0));
    // Returned minus a 0.04 return fee: only the fee is "missing" — never double.
    expect(total(M(49.96), M(10))).toBe(M(60));
  });

  it('a withdrawal of the upgraded USDC meanwhile keeps the in-flight part only', () => {
    expect(inFlightMicro({ ...at, legacyNowMicro: M(0), upgradedNowMicro: M(0) })).toBe(M(50));
  });

  it('partly landed', () => {
    expect(inFlightMicro({ ...at, legacyNowMicro: M(0), upgradedNowMicro: M(40) })).toBe(M(20));
  });
});

describe('copy (one wording per state, shared with the portal)', () => {
  const FORBIDDEN = /noble|injective|ibc|skip|cctp|osmosis|terra|chain|denom|0x|ixo1|tx|hash/i;
  const ctx = { amount: '50 USDC', returned: '49.96 USDC', feeUsed: true, canRetry: true, readyNow: true };
  const views: UpgradeView[] = [
    { kind: 'offer' },
    { kind: 'confirm' },
    { kind: 'preparing' },
    { kind: 'in_progress', slow: false },
    { kind: 'in_progress', slow: true },
    { kind: 'returning' },
    { kind: 'completed' },
    { kind: 'returned', returnedMicro: M(49.96) },
    { kind: 'needs_attention' },
    { kind: 'unconfirmed' },
    {
      kind: 'failed',
      title: 'The upgrade didn’t start',
      message: upgradeErrorMessage(new Error('rpc error: code = Unknown desc = chain halted')),
      retry: true,
    },
  ];

  it('never uses technical words, in either variant', () => {
    for (const v of views) {
      for (const variant of ['notice', 'gate'] as const) {
        const c = upgradeCopy(v, variant, ctx);
        expect([c.title ?? '', ...c.lines, ...c.actions.map((a) => a.label)].join(' ')).not.toMatch(FORBIDDEN);
      }
    }
  });

  it('the withdraw step always has a way back', () => {
    for (const v of views) {
      if (v.kind === 'completed') continue; // carries on by itself
      // The explainer's "Not now" returns to the gate, which has "Back".
      const wayBack = v.kind === 'confirm' ? 'cancel' : 'back';
      expect(upgradeCopy(v, 'gate', ctx).actions.map((a) => a.action)).toContain(wayBack);
    }
  });

  it('"Withdraw what’s ready now" only once the upgrade is slow, with the team, back or unconfirmed', () => {
    const offered = (v: UpgradeView) => upgradeCopy(v, 'gate', ctx).actions.some((a) => a.action === 'ready_now');
    expect(offered({ kind: 'in_progress', slow: true })).toBe(true);
    expect(offered({ kind: 'needs_attention' })).toBe(true);
    expect(offered({ kind: 'returned', returnedMicro: null })).toBe(true);
    expect(offered({ kind: 'unconfirmed' })).toBe(true);
    expect(offered({ kind: 'in_progress', slow: false })).toBe(false);
    expect(offered({ kind: 'offer' })).toBe(false);
    expect(
      upgradeCopy({ kind: 'needs_attention' }, 'gate', { ...ctx, readyNow: false }).actions.map((a) => a.action),
    ).not.toContain('ready_now');
  });

  it('the exact wording', () => {
    expect(upgradeCopy({ kind: 'offer' }, 'notice', ctx).lines[0]).toBe(
      'Part of your USDC needs a quick upgrade to keep working after 12 January 2027. It takes about 2 minutes.',
    );
    const gate = upgradeCopy({ kind: 'offer' }, 'gate', ctx);
    expect(gate.title).toBe('One quick step before you withdraw');
    expect(gate.lines[0]).toBe(
      'Part of your USDC needs a quick upgrade before it can be withdrawn. It takes about 2 minutes, then your withdrawal carries on right where you left off.',
    );
    expect(gate.actions.map((a) => a.label)).toEqual(['Back', 'Upgrade now']);
    const confirm = upgradeCopy({ kind: 'confirm' }, 'notice', ctx);
    expect(confirm.lines).toEqual([
      'We’ll upgrade all 50 USDC in one step. It takes about 2 minutes and you only need to confirm once.',
      'The amount stays essentially the same, and your balance keeps showing it while it’s on its way back to your wallet.',
    ]);
    expect(confirm.actions.map((a) => a.label)).toEqual(['Not now', 'Start upgrade']);
    expect(upgradeCopy({ kind: 'in_progress', slow: true }, 'notice', ctx).lines[0]).toBe(
      'This is taking a little longer than usual. Your USDC is safe and we’re keeping an eye on it.',
    );
    expect(upgradeCopy({ kind: 'completed' }, 'notice', ctx).title).toBe('All set — your USDC is ready');
    expect(upgradeCopy({ kind: 'completed' }, 'gate', ctx).title).toBe('All set — continuing your withdrawal…');
    const att = upgradeCopy({ kind: 'needs_attention' }, 'notice', ctx);
    expect(att.title).toBe('Our team is on it');
    expect(att.lines[0]).toBe(
      'We couldn’t finish this automatically, so our team is bringing your USDC back to your wallet by hand. It’s safe, and you don’t need to do anything.',
    );
    expect(att.actions.map((a) => a.action)).toEqual(['dismiss', 'support']);
    expect(upgradeCopy({ kind: 'in_progress', slow: false }, 'notice', ctx).canLeave).toBe(true);
  });

  it('returned: says how much came back, the fee, and offers "Try again" only if legacy USDC remains', () => {
    const r = upgradeCopy({ kind: 'returned', returnedMicro: M(49.96) }, 'notice', ctx);
    expect(r.lines).toEqual([
      'We couldn’t finish the upgrade, so 49.96 USDC is back in your wallet.',
      'A small network fee was used to send it back.',
    ]);
    expect(r.actions.map((a) => a.action)).toEqual(['dismiss', 'retry']);
    const none = upgradeCopy({ kind: 'returned', returnedMicro: null }, 'notice', {
      amount: '50 USDC',
      canRetry: false,
    });
    expect(none.lines).toEqual(['We couldn’t finish the upgrade, so 50 USDC is back in your wallet.']);
    expect(none.actions.map((a) => a.action)).toEqual(['dismiss']);
  });

  it('error messages are customer copy', () => {
    expect(upgradeErrorMessage(new Error('insufficient fees; got: 0uixo required: 14875uixo'))).toMatch(/network fee/);
    expect(upgradeErrorMessage(new UsdcUpgradeError('missing_address', 'no recovery address for osmosis-1'))).toBe(
      'Upgrading isn’t available right now. Your USDC is safe in your wallet.',
    );
    expect(upgradeErrorRetryable(new UsdcUpgradeError('missing_address', 'x'))).toBe(false);
    expect(upgradeErrorMessage(new Error('rpc error'))).toBe(
      'We couldn’t start the upgrade just now. Your USDC is safe in your wallet — please try again in a few minutes.',
    );
    expect(upgradeErrorMessage(new Error('Session expired — please sign in again'))).toBe(
      'Please sign in again to upgrade your USDC. Your USDC is safe in your wallet.',
    );
    expect(upgradeErrorMessage(new Error('Session key not found — please sign in again'))).toMatch(/sign in again/);
  });
});
