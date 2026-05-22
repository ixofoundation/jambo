export const KYC_ENTITY_ID = (process.env.NEXT_PUBLIC_KYC_ENTITY_ID || '').trim();

// Client-side requests go through the Next.js API proxy (pages/api/kyc/[...path].ts)
// to avoid CORS + untrusted-cert issues when talking to the KYC server directly.
export const KYC_API_BASE = '/api/kyc';

// Mirrors `KYC_AML_EVALUATION_STATUS` in ixo-kyc-server (`src/types/kyc.ts`).
// Keep these values in sync — the server treats them as the source of truth.
export enum KycStatus {
  Verify = 'verify', // user must do liveness check + doc scanning
  Review = 'review', // submitted; reviewed by Complycube/ixo
  Clear = 'clear', // passed review
  Rejected = 'rejected', // failed review — manual review required
  Attention = 'attention', // issue with review — manual review required
  Issuing = 'issuing', // awaiting credential issuance
  Issued = 'issued', // credential issued — client still needs to save to matrix
  Error = 'error', // failed at unknown stage — manual review needed
  Complete = 'complete', // credential issued AND backed up to matrix
  Unknown = 'unknown', // unknown — re-query Complycube to recover
}

// Final, no-further-progression success. Issued is NOT terminal here — the client still has
// to call save() to advance the server-side status to Complete.
export function isTerminalSuccess(status?: string | null): boolean {
  return status === KycStatus.Complete;
}

// Credential has been issued by the server and is waiting for the client to save it locally.
export function isReadyToSave(status?: string | null): boolean {
  return status === KycStatus.Issued;
}

export function isTerminalFailure(status?: string | null): boolean {
  return status === KycStatus.Rejected || status === KycStatus.Attention || status === KycStatus.Error;
}
