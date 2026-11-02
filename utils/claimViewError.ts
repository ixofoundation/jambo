export type ClaimViewFallback = 'not-stored' | 'no-access' | 'unavailable';

const NO_ACCESS_CODES = new Set(['IXO_FORBIDDEN', 'IXO_UNAUTHORIZED', 'M_FORBIDDEN', 'M_UNAUTHORIZED']);
const NOT_STORED_CODES = new Set(['IXO_CLAIM_NOT_FOUND', 'IXO_ROOM_NOT_FOUND', 'IXO_COLLECTION_NOT_FOUND', 'M_NOT_FOUND']);

/**
 * Why a claim's submission can't be shown. Only a real "not found" means the claim
 * was recorded on-chain with no form; a refusal or an outage must not read like that.
 */
export function claimViewFallback(error: unknown): ClaimViewFallback {
  const { errcode, message } = (error ?? {}) as { errcode?: string; message?: string };
  const code = errcode?.toUpperCase();

  if (code && NO_ACCESS_CODES.has(code)) return 'no-access';
  if (code && NOT_STORED_CODES.has(code)) return 'not-stored';
  if (message === 'Claim form not found') return 'not-stored';
  return 'unavailable';
}

export const CLAIM_VIEW_MESSAGES: Record<ClaimViewFallback, { title?: string; body: string }> = {
  'not-stored': { body: 'This claim was recorded directly on-chain — there’s no form submission to display.' },
  'no-access': {
    title: 'You don’t have access to this claim',
    body: 'Only the person who submitted it and its evaluators can see the details. If you think you should have access, ask the collection’s admin.',
  },
  unavailable: {
    title: 'We couldn’t load this claim',
    body: 'Something went wrong on our side. Please try again in a moment.',
  },
};
