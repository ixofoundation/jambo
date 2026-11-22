import type { ServiceErrorCode } from './types';

/**
 * Codes this client adds to the service's own: the request never got a usable
 * answer. Whether it reached the service is then unknown.
 */
export type LocalErrorCode = 'network_error' | 'timeout' | 'bad_response' | 'not_configured';

export type AirtimeErrorCode = ServiceErrorCode | LocalErrorCode;

/**
 * A refusal of the airtime voucher service, or a request that got no usable
 * answer. `message` is the service's own sentence (for logs and support; the
 * screens use `./messages`). Never carries a token, a PIN or a request body.
 */
export class AirtimeVoucherError extends Error {
  /** The service's stable `error` code, or a local one. An unknown code from a newer service is kept as it came. */
  readonly code: AirtimeErrorCode;
  /** HTTP status; 0 when there was no answer. */
  readonly status: number;
  readonly details: Record<string, unknown>;
  /** Seconds to wait before trying again, when the answer said so (`Retry-After`, else `details`). */
  readonly retryAfterSec: number | null;

  constructor(args: {
    code: AirtimeErrorCode;
    status: number;
    message: string;
    details?: Record<string, unknown>;
    retryAfterSec?: number | null;
  }) {
    super(args.message);
    Object.setPrototypeOf(this, AirtimeVoucherError.prototype);
    this.name = 'AirtimeVoucherError';
    this.code = args.code;
    this.status = args.status;
    this.details = args.details ?? {};
    this.retryAfterSec = args.retryAfterSec ?? null;
  }
}

export function isAirtimeVoucherError(err: unknown): err is AirtimeVoucherError {
  return err instanceof AirtimeVoucherError;
}

/** True when the request may or may not have reached the service, or the service may recover by itself. */
export function isTransient(err: unknown): boolean {
  if (!isAirtimeVoucherError(err)) return false;
  return (
    err.code === 'network_error' ||
    err.code === 'timeout' ||
    err.code === 'bad_response' ||
    err.code === 'chain_unavailable' ||
    err.code === 'provider_unavailable' ||
    err.code === 'rate_limited' ||
    err.code === 'internal_error'
  );
}

/** `Retry-After`: whole seconds, or an HTTP date. Null when absent or unreadable. */
export function parseRetryAfter(header: string | null | undefined, nowMs: number): number | null {
  if (!header) return null;
  const value = header.trim();
  if (/^\d+$/.test(value)) return Number(value);
  const at = Date.parse(value);
  if (!Number.isFinite(at)) return null;
  return Math.max(0, Math.ceil((at - nowMs) / 1000));
}

/**
 * How long an answer asks to wait, in seconds: the `Retry-After` header, else
 * `details.retryAfterSeconds`, else the time left until `details.retryAfter`
 * (`swap_cooldown`). The header is only readable cross-origin because the
 * worker lists it in `Access-Control-Expose-Headers`; the body copies are the
 * fallback.
 */
export function retryAfterSeconds(
  header: string | null | undefined,
  details: Record<string, unknown> | undefined,
  nowMs: number,
): number | null {
  const fromHeader = parseRetryAfter(header, nowMs);
  if (fromHeader !== null) return fromHeader;
  const seconds = details?.retryAfterSeconds;
  if (typeof seconds === 'number' && Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds);
  const until = details?.retryAfter;
  if (typeof until === 'string') {
    const at = Date.parse(until);
    if (Number.isFinite(at)) return Math.max(0, Math.ceil((at - nowMs) / 1000));
  }
  return null;
}
