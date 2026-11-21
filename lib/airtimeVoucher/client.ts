import { AirtimeVoucherError, retryAfterSeconds, type AirtimeErrorCode } from './errors';
import { swapPaths, type SwapMethod } from './swapToken';
import type { ServiceInfo, SwapDetail, SwapResponse } from './types';

/**
 * Client for the airtime-voucher-worker's account-holder routes (its README,
 * "Redemption"):
 *
 *   GET  /api                      public: service DID, limits, test mode
 *   POST /api/swaps {amount, kyc?} 201: the swap, the burn to sign, holdings
 *   POST /api/swaps/{id}/redeem    200 with the PIN, or 202 (repeat the call)
 *   GET  /api/swaps/{id}           the caller's own swap, with the PIN once issued
 *
 * Every swap call signs its own token for that exact method and path
 * (`signToken`), also when a call is repeated. Nothing this client handles is
 * logged: an answer may carry a PIN.
 */

/** Signs one swap token for one request. `audience` is the service's DID from `GET /api`. */
export type SignSwapToken = (request: { audience: string; method: SwapMethod; path: string }) => Promise<string>;

export interface AirtimeVoucherClientOptions {
  /** The worker's origin, without a path. */
  baseUrl: string;
  signToken: SignSwapToken;
  /** Defaults to the global `fetch`. */
  fetch?: typeof fetch;
  /** Injected in tests. */
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  /** A 429 `rate_limited` is waited out and the call repeated this many times, when the wait is short enough. */
  rateLimitRetries?: number;
  /** The longest `Retry-After` this client waits out by itself; a longer one is thrown to the caller. */
  maxRateLimitWaitMs?: number;
}

/** `issued`: 200, `detail.pin` is set. Otherwise 202: repeat the call later; `detail.message` says why. */
export interface RedeemResult {
  issued: boolean;
  detail: SwapDetail;
}

export interface AirtimeVoucherClient {
  getServiceInfo(): Promise<ServiceInfo>;
  /** `kyc`: the user's identity credential, sent only where the service asks for one. */
  requestSwap(amount: number, kyc?: string): Promise<SwapResponse>;
  redeemSwap(swapId: string, txHash: string): Promise<RedeemResult>;
  getSwap(swapId: string): Promise<SwapDetail>;
}

/** Time limits per call. Redeem buys the PIN while the request is open, so it gets the longest. */
export const TIMEOUTS_MS = { info: 15_000, request: 30_000, redeem: 45_000, read: 20_000 } as const;

const DEFAULT_RATE_LIMIT_WAIT_SEC = 5;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSwap(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.reference === 'string' &&
    typeof value.address === 'string' &&
    typeof value.amount === 'number' &&
    typeof value.status === 'string' &&
    typeof value.expiresAt === 'string'
  );
}

function isSwapDetail(value: unknown): value is SwapDetail {
  if (!isRecord(value) || !isSwap(value.swap)) return false;
  const { pin } = value;
  return pin === null || (isRecord(pin) && typeof pin.pin === 'string' && Array.isArray(pin.steps));
}

function isSwapResponse(value: unknown): value is SwapResponse {
  return (
    isRecord(value) &&
    isSwap(value.swap) &&
    isRecord(value.burn) &&
    typeof value.burn.typeUrl === 'string' &&
    isRecord(value.burn.value) &&
    Array.isArray(value.holdings)
  );
}

function isServiceInfo(value: unknown): value is ServiceInfo {
  return (
    isRecord(value) &&
    typeof value.serviceDid === 'string' &&
    value.serviceDid.startsWith('did:') &&
    typeof value.test === 'boolean' &&
    typeof value.minSwapZar === 'number' &&
    typeof value.maxSwapZar === 'number'
  );
}

function badResponse(status: number, what: string): AirtimeVoucherError {
  return new AirtimeVoucherError({
    code: 'bad_response',
    status,
    message: `The airtime service's answer to ${what} could not be read`,
  });
}

export function createAirtimeVoucherClient(options: AirtimeVoucherClientOptions): AirtimeVoucherClient {
  const baseUrl = options.baseUrl.trim().replace(/\/+$/, '');
  const doFetch = options.fetch ?? ((input: RequestInfo | URL, init?: RequestInit) => fetch(input, init));
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const now = options.now ?? (() => Date.now());
  const rateLimitRetries = options.rateLimitRetries ?? 1;
  const maxRateLimitWaitMs = options.maxRateLimitWaitMs ?? 10_000;

  let info: Promise<ServiceInfo> | null = null;

  /** One request, limited in time. Returns the status, the parsed body (null when not JSON) and `Retry-After`. */
  async function send(
    method: SwapMethod,
    path: string,
    timeoutMs: number,
    token?: string,
    body?: unknown,
  ): Promise<{ status: number; json: unknown; retryAfter: string | null }> {
    if (!baseUrl) {
      throw new AirtimeVoucherError({
        code: 'not_configured',
        status: 0,
        message: 'The airtime service is not set up',
      });
    }
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller?.abort();
        reject(
          new AirtimeVoucherError({
            code: 'timeout',
            status: 0,
            message: `The airtime service did not answer ${method} ${path} within ${timeoutMs / 1000}s`,
          }),
        );
      }, timeoutMs);
    });
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    try {
      const request = doFetch(`${baseUrl}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        // An answer may carry a PIN: never from, and never into, a cache.
        cache: 'no-store',
        signal: controller?.signal,
      }).then(async (res) => {
        const text = await res.text();
        let json: unknown = null;
        try {
          json = text ? JSON.parse(text) : null;
        } catch {
          json = null;
        }
        return { status: res.status, json, retryAfter: res.headers.get('Retry-After') };
      });
      return await Promise.race([request, timeout]);
    } catch (err) {
      if (err instanceof AirtimeVoucherError) throw err;
      // The cause is deliberately not attached: a fetch error can quote the request.
      throw new AirtimeVoucherError({
        code: 'network_error',
        status: 0,
        message: `The airtime service could not be reached (${method} ${path})`,
      });
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  function refusal(status: number, json: unknown, retryAfter: string | null, what: string): AirtimeVoucherError {
    if (!isRecord(json) || typeof json.error !== 'string') return badResponse(status, what);
    const details = isRecord(json.details) ? json.details : {};
    return new AirtimeVoucherError({
      code: json.error as AirtimeErrorCode,
      status,
      message: typeof json.message === 'string' ? json.message : json.error,
      details,
      retryAfterSec: retryAfterSeconds(retryAfter, details, now()),
    });
  }

  function getServiceInfo(): Promise<ServiceInfo> {
    if (!info) {
      const pending = send('GET', '/api', TIMEOUTS_MS.info).then(({ status, json, retryAfter }) => {
        if (status < 200 || status >= 300) throw refusal(status, json, retryAfter, 'GET /api');
        if (!isServiceInfo(json)) throw badResponse(status, 'GET /api');
        return json;
      });
      info = pending;
      // A failed read is not remembered: the next call asks again.
      pending.catch(() => {
        if (info === pending) info = null;
      });
    }
    return info;
  }

  /**
   * One swap call. A fresh token is signed for every attempt. A 429
   * `rate_limited` whose wait is short is waited out here; a longer one, and
   * every other refusal, is thrown as an `AirtimeVoucherError`.
   */
  async function call(
    method: SwapMethod,
    path: string,
    timeoutMs: number,
    body?: unknown,
  ): Promise<{ status: number; json: unknown }> {
    const what = `${method} ${path}`;
    for (let attempt = 0; ; attempt += 1) {
      const { serviceDid } = await getServiceInfo();
      const token = await options.signToken({ audience: serviceDid, method, path });
      const { status, json, retryAfter } = await send(method, path, timeoutMs, token, body);
      if (status >= 200 && status < 300) return { status, json };
      const err = refusal(status, json, retryAfter, what);
      if (err.code === 'rate_limited' && attempt < rateLimitRetries) {
        const waitMs = (err.retryAfterSec ?? DEFAULT_RATE_LIMIT_WAIT_SEC) * 1000;
        if (waitMs <= maxRateLimitWaitMs) {
          await sleep(waitMs);
          continue;
        }
      }
      throw err;
    }
  }

  return {
    getServiceInfo,

    async requestSwap(amount, kyc) {
      const path = swapPaths.request();
      // Left out, never sent empty: the service reads a blank as none.
      const body = kyc ? { amount, kyc } : { amount };
      const { status, json } = await call('POST', path, TIMEOUTS_MS.request, body);
      if (!isSwapResponse(json)) throw badResponse(status, `POST ${path}`);
      return json;
    },

    async redeemSwap(swapId, txHash) {
      const path = swapPaths.redeem(swapId);
      const { status, json } = await call('POST', path, TIMEOUTS_MS.redeem, { txHash });
      if (!isSwapDetail(json)) throw badResponse(status, `POST ${path}`);
      // 200 is the PIN; 202 (and any other 2xx without one) means "not issued yet: repeat the call".
      return { issued: status === 200 && json.pin !== null, detail: json };
    },

    async getSwap(swapId) {
      const path = swapPaths.read(swapId);
      const { status, json } = await call('GET', path, TIMEOUTS_MS.read);
      if (!isSwapDetail(json)) throw badResponse(status, `GET ${path}`);
      return json;
    },
  };
}
