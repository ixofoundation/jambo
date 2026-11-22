import { APPROVE_PAYMENT_IDENTITY_KEYS, isApprovePaymentCollection } from '@constants/approvePayment';

/**
 * Persist migration v5: removes personal data from the saved claim drafts.
 *
 * - A draft of the old KYC form (`surveyMode === 'kyc'`) holds the person's
 *   name, ID number and address. That form is gone, so the draft can never be
 *   opened or cleared again: delete it.
 * - Approve-payment drafts saved before `stripPrefilledIdentity` existed still
 *   carry the identity fields: drop those fields from the approve-payment
 *   drafts (the form fills them in again from the credential when it opens).
 *   Drafts are keyed by collection id, so that is what tells them apart; the
 *   draft of any other form is left as it is, whatever its fields are called.
 *
 * Pure, and tolerant of missing or odd shapes: anything it does not recognise
 * is returned untouched.
 */
export function removePersistedIdentityDrafts(
  state: any,
  isApprovePayment: (collectionId: string) => boolean = isApprovePaymentCollection,
): any {
  const drafts = state?.claimDrafts?.byCollectionId;
  if (!drafts || typeof drafts !== 'object' || Array.isArray(drafts)) return state;

  const byCollectionId: Record<string, any> = {};
  for (const collectionId of Object.keys(drafts)) {
    const draft = drafts[collectionId];
    if (draft?.surveyMode === 'kyc') continue;
    const data = draft?.surveyData;
    if (!isApprovePayment(collectionId) || !data || typeof data !== 'object' || Array.isArray(data)) {
      byCollectionId[collectionId] = draft;
      continue;
    }
    const surveyData = { ...data };
    for (const key of APPROVE_PAYMENT_IDENTITY_KEYS) delete surveyData[key];
    byCollectionId[collectionId] = { ...draft, surveyData };
  }
  return { ...state, claimDrafts: { ...state.claimDrafts, byCollectionId } };
}
