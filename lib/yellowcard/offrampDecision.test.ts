import { describe, expect, it, vi } from 'vitest';

vi.mock('@ixo/impactxclient-sdk', () => ({
  ibc: { applications: { transfer: { v1: { MsgTransfer: { fromPartial: (v: unknown) => v } } } } },
}));

import { SignBroadcastError } from 'lib/authHub/signAndBroadcast';
import { UnroutableChainError } from 'lib/skip/chainAddresses';
import { BridgeBuildError, BridgeQuoteError } from 'lib/skip/skipBridge';
import { RampApiError } from 'lib/yellowcard/offrampClient';
import { RequestTimeoutError } from '@utils/fetchTimeout';
import { OFFRAMP_NOT_THROUGH, offrampErrorMessage } from './offrampDecision';

const RAW = /skip|ibc\/|msgs_direct|raw log|code \d|transaction with id|aborting|worker|[0-9A-F]{64}|returned \d{3}/i;
const before = { fundsMayHaveMoved: false };
const after = { fundsMayHaveMoved: true };

describe('offrampErrorMessage — never a raw Skip / chain / wallet / worker string', () => {
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);

  const cases: Array<[string, unknown, { fundsMayHaveMoved: boolean }, RegExp]> = [
    [
      'unroutable chain',
      new UnroutableChainError('Skip route requires a recovery address for chain "noble-1"…'),
      before,
      /aren’t available for a moment/,
    ],
    [
      'msgs check failed',
      new BridgeBuildError('receiver inj1x is not an inj1 account'),
      after,
      /aren’t available for a moment/,
    ],
    ['quote failed', new BridgeQuoteError('route 400: no route'), before, /couldn’t get a price/],
    [
      'CheckTx insufficient funds',
      new SignBroadcastError(
        'not_sent',
        null,
        new Error(
          'Broadcasting transaction failed with code 5 (codespace: sdk). Log: insufficient funds: 120000ibc/77C1…',
        ),
      ),
      after,
      /doesn’t have enough USDC/,
    ],
    [
      'failed in its block',
      new SignBroadcastError('failed_on_chain', 'AB'.repeat(32), new Error('Error when broadcasting tx AB… Code: 11')),
      after,
      /didn’t go through/,
    ],
    [
      'inclusion time-out',
      new SignBroadcastError(
        'maybe_sent',
        'AB'.repeat(32),
        new Error(`Transaction with ID ${'AB'.repeat(32)} was submitted but was not yet found on the chain.`),
      ),
      after,
      /Check “Your withdrawals”/,
    ],
    [
      'session ended',
      new Error('Session key not found — please sign in again'),
      before,
      /sign in again — nothing was sent/,
    ],
    ['wallet address missing', new Error('Wallet address not available'), before, /Nothing was sent/],
    [
      'worker 502 with technical text',
      new RampApiError('rates lookup returned 503', { status: 502, serverMessage: 'rates lookup returned 503' }),
      before,
      /Nothing was sent/,
    ],
    [
      'worker after send',
      new RampApiError('x', { status: 500, serverMessage: 'YellowCard returned 500' }),
      after,
      /Check “Your withdrawals”/,
    ],
    [
      'time limit hit',
      new RequestTimeoutError('https://x/skip/v2/fungible/route', 15000),
      before,
      /Check your connection/,
    ],
    [
      'rate limited',
      new RampApiError('x', { status: 429, serverMessage: 'Too many withdrawals — try again in a minute' }),
      before,
      /try again in a minute/,
    ],
  ];

  it.each(cases)('%s', (_, err, opts, expected) => {
    const m = offrampErrorMessage(err, opts);
    expect(m).toMatch(expected);
    expect(m).not.toMatch(RAW);
  });

  it('nothing moved when the signer says so, even after the signature', () => {
    expect(offrampErrorMessage(new SignBroadcastError('failed_on_chain', null, new Error('x')), after)).toBe(
      OFFRAMP_NOT_THROUGH,
    );
  });

  it('identity-check sentences written for customers are kept', () => {
    const err = new RampApiError('x', {
      status: 403,
      code: 'kyc_required',
      serverMessage: 'Please verify your identity first.',
    });
    expect(offrampErrorMessage(err, before)).toBe('Please verify your identity first.');
  });

  it('usdc_upgrade_required uses the shared wording', () => {
    const err = new RampApiError('x', { status: 400, code: 'usdc_upgrade_required', serverMessage: 'whatever' });
    expect(offrampErrorMessage(err, before)).toBe(
      'Part of your USDC needs a quick upgrade before it can be withdrawn. Nothing was sent — your USDC is safe in your wallet.',
    );
  });
});
