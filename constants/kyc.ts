export const KYC_ENTITY_ID = (process.env.NEXT_PUBLIC_KYC_ENTITY_ID || '').trim();

// Client-side requests go through the Next.js API proxy (pages/api/kyc/[...path].ts)
// to avoid CORS + untrusted-cert issues when talking to the KYC server directly.
export const KYC_API_BASE = '/api/kyc';

export enum KycStatus {
  Verify = 'verify',
  Review = 'review',
  Clear = 'clear',
  Rejected = 'rejected',
  Attention = 'attention',
  Authorizing = 'authorizing',
  Authorized = 'authorized',
  Unauthorized = 'unauthorized',
  Issuing = 'issuing',
  Issued = 'issued',
  Error = 'error',
  Complete = 'complete',
  Unknown = 'unknown',
}

export function isTerminalSuccess(status?: string | null): boolean {
  return status === KycStatus.Issued || status === KycStatus.Complete;
}

export function isTerminalFailure(status?: string | null): boolean {
  return (
    status === KycStatus.Rejected ||
    status === KycStatus.Attention ||
    status === KycStatus.Unauthorized ||
    status === KycStatus.Error
  );
}
