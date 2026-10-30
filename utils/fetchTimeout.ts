/**
 * Time limits for the requests made BEFORE anything is signed (Skip quotes and
 * messages, the worker's config, balance reads): a stalled request must end in
 * a clear "try again" state, never a spinner without a way out.
 *
 * Not used for the off-ramp create call: the worker's decision rail may hold
 * that request open for up to a minute by design.
 */

/** The default limit for one pre-sign request. */
export const PRE_SIGN_TIMEOUT_MS = 15_000;

export class RequestTimeoutError extends Error {
  readonly url: string;
  readonly timeoutMs: number;

  constructor(url: string, timeoutMs: number) {
    super(`Request timed out after ${timeoutMs / 1000}s: ${url}`);
    Object.setPrototypeOf(this, RequestTimeoutError.prototype);
    this.name = 'RequestTimeoutError';
    this.url = url;
    this.timeoutMs = timeoutMs;
  }
}

/** `fetch` that gives up after `timeoutMs` with a `RequestTimeoutError`. */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs: number = PRE_SIGN_TIMEOUT_MS,
): Promise<Response> {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller?.abort();
      reject(new RequestTimeoutError(url, timeoutMs));
    }, timeoutMs);
  });
  try {
    return await Promise.race([fetch(url, { ...init, signal: controller?.signal ?? init.signal }), timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Any promise, limited to `timeoutMs` (for SDK calls that take no AbortSignal, e.g. RPC queries). */
export async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new RequestTimeoutError(label, timeoutMs)), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
