import { describe, expect, it } from 'vitest';

import { BurnRefusedError } from './burn';
import { AirtimeVoucherError, type AirtimeErrorCode } from './errors';
import { formatWait, refusalCopy, type RefusalAction, type RefusalStage } from './messages';
import { SWAP_ID } from './testFixtures';

const err = (code: AirtimeErrorCode, details?: Record<string, unknown>, retryAfterSec?: number) =>
  new AirtimeVoucherError({ code, status: 400, message: `developer text for ${code}`, details, retryAfterSec });

const copyOf = (
  code: AirtimeErrorCode,
  stage: RefusalStage = 'request',
  details?: Record<string, unknown>,
  retryAfterSec?: number,
) => refusalCopy(err(code, details, retryAfterSec), { stage, minZar: 10, maxZar: 999 });

describe('what the user is told for each refusal', () => {
  it('another swap is open: offers to open it', () => {
    const copy = copyOf('swap_in_progress', 'request', { swapId: SWAP_ID });
    expect(copy.action).toBe('resume');
    expect(copy.swapId).toBe(SWAP_ID);
  });

  it('not enough vouchers: says how many there are', () => {
    const copy = copyOf('insufficient_vouchers', 'request', { held: 5, amount: 20 });
    expect(copy.action).toBe('amount');
    expect(copy.held).toBe(5);
    expect(copy.body).toContain('R5');
    expect(copyOf('insufficient_vouchers', 'request', { held: 0 }).body).toMatch(/no airtime vouchers/);
    expect(copyOf('insufficient_vouchers').held).toBeUndefined();
  });

  it('cooldown: says how long to wait', () => {
    const copy = copyOf('swap_cooldown', 'request', {}, 120);
    expect(copy.action).toBe('wait');
    expect(copy.waitSec).toBe(120);
    expect(copy.body).toContain('about 2 minutes');
  });

  it('rate limit: wait before a swap, check again after a burn', () => {
    expect(copyOf('rate_limited', 'request', {}, 45)).toMatchObject({ action: 'wait', waitSec: 45 });
    expect(copyOf('rate_limited', 'request', {}, 45).body).toContain('45 seconds');
    expect(copyOf('rate_limited', 'redeem', {}, 45).action).toBe('check');
  });

  it('flagged: an operator will look at it, with the reference to quote', () => {
    for (const copy of [
      copyOf('swap_flagged', 'redeem'),
      copyOf('swap_burn_invalid', 'redeem', { check: 'amount', flagged: true }),
    ]) {
      expect(copy.action).toBe('support');
      expect(copy.body).toMatch(/has been told/);
      expect(copy.body).toMatch(/reference/);
    }
  });

  it('a burn the service could not match is never offered again', () => {
    const copy = copyOf('swap_burn_invalid', 'redeem', { check: 'no_burn' });
    expect(copy.action).toBe('support');
    expect(copy.body).toMatch(/do not try again/i);
  });

  it('a failed burn used nothing and may be tried again', () => {
    const copy = copyOf('swap_burn_failed', 'redeem');
    expect(copy.action).toBe('burn_again');
    expect(copy.body).toMatch(/still in your wallet/);
  });

  const expected: [AirtimeErrorCode, RefusalStage, RefusalAction][] = [
    ['insufficient_airtime_balance', 'request', 'amount'],
    ['swap_reserve_full', 'request', 'retry'],
    ['swaps_paused', 'request', 'none'],
    ['token_not_active', 'request', 'none'],
    ['validation_error', 'request', 'amount'],
    ['chain_unavailable', 'request', 'retry'],
    ['provider_unavailable', 'request', 'retry'],
    ['chain_unavailable', 'redeem', 'check'],
    ['provider_unavailable', 'redeem', 'check'],
    ['pin_unavailable', 'read', 'check'],
    ['swap_already_redeemed', 'redeem', 'check'],
    ['network_error', 'request', 'retry'],
    ['timeout', 'redeem', 'check'],
    ['not_found', 'read', 'support'],
    ['invalid_signature', 'request', 'retry'],
    ['unauthorized', 'redeem', 'check'],
    ['expired', 'request', 'retry'],
    ['replay', 'request', 'retry'],
    ['config_error', 'request', 'none'],
    ['config_error', 'redeem', 'check'],
  ];
  for (const [code, stage, action] of expected) {
    it(`${code} at ${stage}: ${action}`, () => {
      const copy = copyOf(code, stage);
      expect(copy.action).toBe(action);
      expect(copy.code).toBe(code);
      expect(copy.title.length).toBeGreaterThan(3);
      // Never the service's developer text, and no chain words.
      expect(copy.body).not.toContain('developer text');
      expect(`${copy.title} ${copy.body}`).not.toMatch(/UCAN|token|blockchain|MsgTransferCredit|txHash/i);
    });
  }

  it('before a burn it says nothing was taken; after one it says the swap is saved', () => {
    expect(copyOf('chain_unavailable', 'request').body).toMatch(/Nothing was taken/);
    expect(copyOf('chain_unavailable', 'redeem').body).toMatch(/saved/);
    expect(copyOf('validation_error').body).toContain('R10 to R999');
  });

  it('identity not verified: sends the user to verify, and says nothing was taken', () => {
    const required = copyOf('kyc_required');
    expect(required.action).toBe('verify');
    expect(required.reverify).toBeUndefined();
    expect(required.body).toMatch(/Nothing was taken/);
  });

  it('identity verification expired or not accepted: sends the user to verify again', () => {
    for (const code of ['kyc_expired', 'kyc_revoked', 'kyc_invalid'] as const) {
      const copy = copyOf(code);
      expect(copy.action).toBe('verify');
      expect(copy.reverify).toBe(true);
      expect(copy.body).toMatch(/Nothing was taken/);
    }
  });

  it('identity could not be checked: nothing was decided, try again', () => {
    const copy = copyOf('credential_check_unavailable');
    expect(copy.action).toBe('retry');
    expect(copy.body).toMatch(/Nothing was taken/);
  });

  it('a burn refused on this device was never signed', () => {
    const copy = refusalCopy(new BurnRefusedError('amount', 'x'), { stage: 'burn' });
    expect(copy.code).toBe('local_amount');
    expect(copy.body).toMatch(/nothing was signed/);
    expect(refusalCopy(new BurnRefusedError('expiry', 'x'), { stage: 'burn' }).action).toBe('amount');
  });

  it('an error it does not know is still plain', () => {
    expect(refusalCopy(new Error('boom'), { stage: 'request' }).action).toBe('retry');
    expect(refusalCopy(new Error('boom'), { stage: 'redeem' }).action).toBe('check');
    expect(refusalCopy(err('brand_new_code' as AirtimeErrorCode), { stage: 'request' }).action).toBe('none');
  });

  it('formats waits', () => {
    expect(formatWait(1)).toBe('1 second');
    expect(formatWait(58.2)).toBe('59 seconds');
    expect(formatWait(60)).toBe('about 1 minute');
    expect(formatWait(61)).toBe('about 2 minutes');
    expect(formatWait(3600)).toBe('about 1 hour');
  });
});
