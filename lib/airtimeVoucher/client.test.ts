import { describe, expect, it } from 'vitest';

import { createAirtimeVoucherClient } from './client';
import { AirtimeVoucherError, parseRetryAfter, retryAfterSeconds } from './errors';
import { NOW, PIN, SERVICE_DID, SWAP_ID, TX_HASH, detailOf, responseOf } from './testFixtures';

const BASE = 'https://airtime.example.org';

const INFO = {
  name: 'airtime-voucher-worker',
  version: '1.0.0',
  network: 'devnet',
  serviceDid: SERVICE_DID,
  authHubUrl: 'https://hub.example.org',
  test: true,
  minSwapZar: 10,
  maxSwapZar: 999,
  chain: { chainId: 'devnet-1', rpcUrl: 'https://rpc.example.org' },
  docs: '/api/docs',
};

interface Call {
  method: string;
  path: string;
  authorization: string | null;
  body: unknown;
}

type Answer = { status: number; body?: unknown; headers?: Record<string, string> } | Error;

/** A fake `fetch`: answers `GET /api` itself, and the swap routes from a queue, in order. */
function harness(answers: Answer[], options: { infoStatus?: number } = {}) {
  const calls: Call[] = [];
  const signed: { audience: string; method: string; path: string }[] = [];
  const slept: number[] = [];
  const queue = [...answers];
  const fetchFake = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const headers = (init?.headers ?? {}) as Record<string, string>;
    const call: Call = {
      method: init?.method ?? 'GET',
      path: url.pathname + url.search,
      authorization: headers.Authorization ?? null,
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
    };
    calls.push(call);
    if (url.pathname === '/api') {
      return new Response(JSON.stringify(INFO), { status: options.infoStatus ?? 200 });
    }
    const answer = queue.shift();
    if (!answer) throw new Error('no answer queued');
    if (answer instanceof Error) throw answer;
    return new Response(answer.body === undefined ? '' : JSON.stringify(answer.body), {
      status: answer.status,
      headers: answer.headers,
    });
  }) as typeof fetch;
  const client = createAirtimeVoucherClient({
    baseUrl: `${BASE}/`,
    fetch: fetchFake,
    now: () => NOW,
    sleep: async (ms) => void slept.push(ms),
    signToken: async (request) => {
      signed.push(request);
      return `token-${signed.length}`;
    },
  });
  const swapCalls = () => calls.filter((c) => c.path !== '/api');
  return { client, calls, swapCalls, signed, slept };
}

const refusal = (
  status: number,
  error: string,
  details?: Record<string, unknown>,
  headers?: Record<string, string>,
) => ({
  status,
  body: { error, message: `service text for ${error}`, status, ...(details ? { details } : {}) },
  headers,
});

async function caught(promise: Promise<unknown>): Promise<AirtimeVoucherError> {
  try {
    await promise;
  } catch (err) {
    expect(err).toBeInstanceOf(AirtimeVoucherError);
    return err as AirtimeVoucherError;
  }
  throw new Error('expected a refusal');
}

describe('service info', () => {
  it('reads GET /api without a token, once', async () => {
    const h = harness([]);
    const [a, b] = await Promise.all([h.client.getServiceInfo(), h.client.getServiceInfo()]);
    expect(a.serviceDid).toBe(SERVICE_DID);
    expect(a.minSwapZar).toBe(10);
    expect(a.maxSwapZar).toBe(999);
    expect(a.test).toBe(true);
    expect(b).toBe(a);
    expect(h.calls).toEqual([{ method: 'GET', path: '/api', authorization: null, body: undefined }]);
    expect(h.signed).toEqual([]);
  });

  it('does not remember a failed read', async () => {
    const h = harness([], { infoStatus: 500 });
    const err = await caught(h.client.getServiceInfo());
    expect(err.code).toBe('bad_response');
    await caught(h.client.getServiceInfo());
    expect(h.calls).toHaveLength(2);
  });
});

describe('each call signs its own token for that exact method and path', () => {
  it('asks for a swap', async () => {
    const h = harness([{ status: 201, body: responseOf() }]);
    const res = await h.client.requestSwap(20);
    expect(res.swap.id).toBe(SWAP_ID);
    expect(res.burn.value.authorizationId).toBe(res.swap.reference);
    expect(h.signed).toEqual([{ audience: SERVICE_DID, method: 'POST', path: '/api/swaps' }]);
    expect(h.swapCalls()).toEqual([
      { method: 'POST', path: '/api/swaps', authorization: 'Bearer token-1', body: { amount: 20 } },
    ]);
  });

  it('sends the identity credential with the request when it has one, and no field when it has none', async () => {
    const h = harness([
      { status: 201, body: responseOf() },
      { status: 201, body: responseOf() },
    ]);
    await h.client.requestSwap(20, 'eyJ.credential~disclosure~');
    await h.client.requestSwap(20, '');
    expect(h.swapCalls().map((call) => call.body)).toEqual([
      { amount: 20, kyc: 'eyJ.credential~disclosure~' },
      { amount: 20 },
    ]);
  });

  it('redeems and reads with a new token each', async () => {
    const h = harness([
      { status: 200, body: detailOf({ status: 'fulfilled' }, PIN) },
      { status: 200, body: detailOf({ status: 'fulfilled' }, PIN) },
    ]);
    const redeemed = await h.client.redeemSwap(SWAP_ID, TX_HASH);
    const read = await h.client.getSwap(SWAP_ID);
    expect(redeemed.issued).toBe(true);
    expect(redeemed.detail.pin?.pin).toBe(PIN.pin);
    expect(read.pin?.ussd).toBe(PIN.ussd);
    expect(h.signed).toEqual([
      { audience: SERVICE_DID, method: 'POST', path: `/api/swaps/${SWAP_ID}/redeem` },
      { audience: SERVICE_DID, method: 'GET', path: `/api/swaps/${SWAP_ID}` },
    ]);
    expect(h.swapCalls()).toEqual([
      {
        method: 'POST',
        path: `/api/swaps/${SWAP_ID}/redeem`,
        authorization: 'Bearer token-1',
        body: { txHash: TX_HASH },
      },
      { method: 'GET', path: `/api/swaps/${SWAP_ID}`, authorization: 'Bearer token-2', body: undefined },
    ]);
  });
});

describe('202: not issued yet', () => {
  it('answers the swap unchanged while the burn is not visible', async () => {
    const h = harness([{ status: 202, body: detailOf({}, null, 'The transaction is not in a block yet.') }]);
    const res = await h.client.redeemSwap(SWAP_ID, TX_HASH);
    expect(res.issued).toBe(false);
    expect(res.detail.pin).toBeNull();
    expect(res.detail.swap.status).toBe('awaiting_burn');
    expect(res.detail.message).toBe('The transaction is not in a block yet.');
  });

  it('answers the owed swap with the service’s own message', async () => {
    const h = harness([{ status: 202, body: detailOf({ status: 'redeeming' }, null, 'The PIN is being issued.') }]);
    const res = await h.client.redeemSwap(SWAP_ID, TX_HASH);
    expect(res.issued).toBe(false);
    expect(res.detail.swap.status).toBe('redeeming');
    expect(res.detail.message).toBe('The PIN is being issued.');
  });
});

describe('every refusal is a typed error with the service’s code, status and details', () => {
  const cases: [number, string, Record<string, unknown> | undefined][] = [
    [409, 'swap_in_progress', { swapId: SWAP_ID }],
    [422, 'insufficient_vouchers', { held: 5, amount: 20 }],
    [409, 'insufficient_airtime_balance', undefined],
    [503, 'swap_reserve_full', undefined],
    [503, 'swaps_paused', undefined],
    [422, 'swap_burn_invalid', { check: 'amount', flagged: true }],
    [422, 'swap_burn_invalid', { check: 'no_burn' }],
    [422, 'swap_burn_failed', { code: 5 }],
    [409, 'swap_flagged', undefined],
    [409, 'swap_already_redeemed', undefined],
    [503, 'pin_unavailable', undefined],
    [503, 'chain_unavailable', undefined],
    [503, 'provider_unavailable', undefined],
    [400, 'validation_error', undefined],
    [404, 'not_found', undefined],
    [401, 'invalid_signature', undefined],
    [401, 'unauthorized', undefined],
    [401, 'expired', undefined],
    [409, 'replay', undefined],
    [409, 'token_not_active', undefined],
    [500, 'config_error', undefined],
  ];
  for (const [status, code, details] of cases) {
    it(`${status} ${code}`, async () => {
      const h = harness([refusal(status, code, details)]);
      const err = await caught(h.client.redeemSwap(SWAP_ID, TX_HASH));
      expect(err.code).toBe(code);
      expect(err.status).toBe(status);
      expect(err.details).toEqual(details ?? {});
      expect(err.message).toBe(`service text for ${code}`);
      expect(h.swapCalls()).toHaveLength(1);
    });
  }

  it('swap_cooldown carries the wait from details.retryAfter', async () => {
    const until = new Date(NOW + 120_000).toISOString();
    const h = harness([refusal(429, 'swap_cooldown', { retryAfter: until })]);
    const err = await caught(h.client.requestSwap(20));
    expect(err.code).toBe('swap_cooldown');
    expect(err.details.retryAfter).toBe(until);
    expect(err.retryAfterSec).toBe(120);
    // A cooldown is not waited out by the client: the user is told.
    expect(h.slept).toEqual([]);
    expect(h.swapCalls()).toHaveLength(1);
  });

  it('prefers details.retryAfterSeconds over details.retryAfter, and Retry-After over both', async () => {
    const until = new Date(NOW + 120_000).toISOString();
    expect(retryAfterSeconds(null, { retryAfter: until, retryAfterSeconds: 119 }, NOW)).toBe(119);
    expect(retryAfterSeconds('30', { retryAfter: until, retryAfterSeconds: 119 }, NOW)).toBe(30);
    expect(retryAfterSeconds(null, {}, NOW)).toBeNull();
    expect(parseRetryAfter(new Date(NOW + 9_500).toUTCString(), NOW)).toBe(9);
    expect(parseRetryAfter('soon', NOW)).toBeNull();
  });

  it('an answer that is not the service’s JSON is bad_response', async () => {
    const h = harness([{ status: 502, body: '<html>Bad gateway</html>' }]);
    const err = await caught(h.client.getSwap(SWAP_ID));
    expect(err.code).toBe('bad_response');
    expect(err.status).toBe(502);
  });

  it('a 2xx without the expected shape is bad_response', async () => {
    const h = harness([{ status: 201, body: { swap: { id: SWAP_ID } } }]);
    const err = await caught(h.client.requestSwap(20));
    expect(err.code).toBe('bad_response');
  });

  it('a request that never got an answer is network_error, and says nothing of the request', async () => {
    const h = harness([new TypeError(`fetch failed: Bearer token-1 {"txHash":"${TX_HASH}"}`)]);
    const err = await caught(h.client.redeemSwap(SWAP_ID, TX_HASH));
    expect(err.code).toBe('network_error');
    expect(err.status).toBe(0);
    expect(err.message).not.toContain('token-1');
    expect(err.message).not.toContain(TX_HASH);
  });

  it('an unset service URL is not_configured, and nothing is sent or signed', async () => {
    const signed: unknown[] = [];
    const client = createAirtimeVoucherClient({
      baseUrl: '',
      fetch: (async () => {
        throw new Error('must not be called');
      }) as typeof fetch,
      signToken: async (request) => {
        signed.push(request);
        return 'token';
      },
    });
    const err = await caught(client.requestSwap(20));
    expect(err.code).toBe('not_configured');
    expect(signed).toEqual([]);
  });
});

describe('429 rate_limited', () => {
  it('waits what Retry-After says and repeats the call with a NEW token', async () => {
    const h = harness([
      refusal(429, 'rate_limited', { retryAfterSeconds: 60 }, { 'Retry-After': '7' }),
      { status: 202, body: detailOf() },
    ]);
    const res = await h.client.redeemSwap(SWAP_ID, TX_HASH);
    expect(res.issued).toBe(false);
    expect(h.slept).toEqual([7000]);
    expect(h.swapCalls().map((c) => c.authorization)).toEqual(['Bearer token-1', 'Bearer token-2']);
    expect(h.signed).toHaveLength(2);
  });

  it('falls back to details.retryAfterSeconds when the header is not readable', async () => {
    const h = harness([refusal(429, 'rate_limited', { retryAfterSeconds: 3 }), { status: 200, body: detailOf() }]);
    await h.client.getSwap(SWAP_ID);
    expect(h.slept).toEqual([3000]);
  });

  it('throws a wait that is too long to sit through, with the seconds to wait', async () => {
    const h = harness([refusal(429, 'rate_limited', undefined, { 'Retry-After': '60' })]);
    const err = await caught(h.client.requestSwap(20));
    expect(err.code).toBe('rate_limited');
    expect(err.status).toBe(429);
    expect(err.retryAfterSec).toBe(60);
    expect(h.slept).toEqual([]);
    expect(h.swapCalls()).toHaveLength(1);
  });

  it('gives up after one repeat', async () => {
    const h = harness([
      refusal(429, 'rate_limited', undefined, { 'Retry-After': '1' }),
      refusal(429, 'rate_limited', undefined, { 'Retry-After': '1' }),
    ]);
    const err = await caught(h.client.getSwap(SWAP_ID));
    expect(err.code).toBe('rate_limited');
    expect(h.slept).toEqual([1000]);
    expect(h.swapCalls()).toHaveLength(2);
  });
});

describe('time limit', () => {
  it('a call that does not answer in time is a timeout', async () => {
    const client = createAirtimeVoucherClient({
      baseUrl: BASE,
      fetch: ((_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        })) as typeof fetch,
      signToken: async () => 'token',
    });
    const { vi } = await import('vitest');
    vi.useFakeTimers();
    try {
      const pending = caught(client.getServiceInfo());
      await vi.advanceTimersByTimeAsync(15_000);
      const err = await pending;
      expect(err.code).toBe('timeout');
    } finally {
      vi.useRealTimers();
    }
  });
});
