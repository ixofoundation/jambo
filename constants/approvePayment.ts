export const APPROVE_PAYMENT_COLLECTION = (process.env.NEXT_PUBLIC_APPROVE_PAYMENT_COLLECTION || '').trim();

// Comma-separated list of source collection IDs. Multiple are supported so a new
// "duplicate" collection can be spun up when an earlier one closes (quota / end
// date) without losing user claims that already live in the old collection.
export const APPROVE_PAYMENT_SOURCE_COLLECTIONS = (process.env.NEXT_PUBLIC_APPROVE_PAYMENT_SOURCE_COLLECTIONS || '')
  .split(',')
  .map((s) => s.trim())
  .filter((s) => !!s);

/** Credential index `credentialKey` (matrix state-event state key) for the KYC level-1 credential. */
export const KYC_AML_LEVEL1_CREDENTIAL_KEY = 'kycamllevel1';

export function isApprovePaymentCollection(collectionId: string | null | undefined): boolean {
  if (!APPROVE_PAYMENT_COLLECTION) return false;
  return !!collectionId && collectionId === APPROVE_PAYMENT_COLLECTION;
}
