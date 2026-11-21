/**
 * Shared KYC types: the one "is this person verified" state, the Auth Hub
 * credential views, and the Self link API. See docs/self-kyc-plan.md.
 */

/** Which credential makes the person verified. */
export type KycSource = 'kycamllevel1' | 'identitylevel1';

/**
 * - `checking`: not known yet (Matrix syncing, Hub call in flight)
 * - `legacy`: holds the old `kycamllevel1` credential in Matrix
 * - `self`: holds a verified `IdentityLevel1` credential in the Hub wallet
 * - `pending`: a Self check is open, under review, or being saved
 * - `none`: not verified
 * - `unavailable`: could not be checked (Hub or Matrix unreachable)
 */
export type KycStatus = 'checking' | 'legacy' | 'self' | 'pending' | 'none' | 'unavailable';

export type KycState = {
  status: KycStatus;
  source: KycSource | null;
  /** True for `legacy` and `self`. */
  verified: boolean;
  refresh: () => Promise<void>;
};

/** One credential from the Hub's `GET /api/credentials/overview`. */
export type HubCredentialSummary = {
  id: string;
  /** The credential type (vct). */
  type: string;
  issuerDid: string;
  /** The Hub checked the signature and issuer. */
  verified: boolean;
  /** Unix seconds; null when the credential has no expiry. */
  expiresAt: number | null;
  /** null when the status list could not be read. */
  revoked: boolean | null;
};

/** The disclosed claims of one credential, by claim name. */
export type HubCredentialClaims = Record<string, unknown>;

/** Self's link states (Self's own `GET /identity/v1/links/:linkId`). */
export type SelfLinkState = 'sent' | 'opened' | 'in_progress' | 'passed' | 'failed' | 'expired' | 'cancelled';

export type SelfLinkStatus = {
  linkId: string;
  status: SelfLinkState;
  /** A person is reviewing the check (up to 48 hours). */
  review?: boolean;
  /** Approved; the Hub has not saved the credential yet. */
  saving?: boolean;
  failure?: 'error' | 'too_many_attempts';
  expiresAt?: string;
  /** Starts the person has left in the current window, when Self reports it. */
  startsLeft?: number;
  /** Self refused to start the check on this link (the link itself stays open). */
  limit?: { code: 'daily_limit'; resetsAt?: string };
};

/** Why a link could not be made, in Jambo's terms. */
export type SelfLinkErrorCode =
  | 'not_configured'
  | 'daily_limit'
  | 'rate_limited'
  | 'offer_consent_invalid'
  | 'unauthorized'
  /** The device clock is too far off for a signed request to be accepted. */
  | 'clock_skew'
  | 'unavailable'
  | 'bad_request'
  | 'unknown';

export type SelfLinkCreated = {
  linkId: string;
  /** Bearer secret: never log, persist or send to analytics. */
  url: string;
  expiresAt: string;
  startsLeft?: number;
};

/** The answer of `POST /api/self/links`. */
export type SelfLinkCreateResult =
  | ({ outcome: 'created' } & SelfLinkCreated)
  | { outcome: 'already_verified' }
  /** A check is already running for this person. */
  | { outcome: 'link_active'; linkId?: string }
  | { outcome: 'error'; code: SelfLinkErrorCode; message: string; retryAfterSeconds?: number; resetsAt?: string };

/** The answer of `POST /api/self/links/:linkId` (a POST so the delegation travels in the body). */
export type SelfLinkStatusResult =
  | ({ outcome: 'status' } & SelfLinkStatus)
  | { outcome: 'error'; code: SelfLinkErrorCode | 'not_found'; message: string };

/** The open Self check Jambo remembers on this device (never the link URL). */
export type PendingSelfLink = {
  linkId: string;
  /** When Jambo started it, unix ms. */
  startedAt: number;
};
