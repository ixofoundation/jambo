/**
 * Approve-payment profiles.
 *
 * A profile pairs one "approve payment" claim collection with the base ("source")
 * collections whose approved claims may be used to prefill it. Several profiles can
 * be active at once (e.g. one per programme / entity), and each payment collection
 * only ever pulls from its OWN source collections — never from another profile's.
 *
 * Configured via NEXT_PUBLIC_APPROVE_PAYMENT_PROFILES as a JSON array:
 *
 *   [
 *     { "collection": "32653", "sources": ["3900", "31084"] },
 *     { "collection": "43965", "sources": ["43966"] }
 *   ]
 *
 * The legacy pair NEXT_PUBLIC_APPROVE_PAYMENT_COLLECTION +
 * NEXT_PUBLIC_APPROVE_PAYMENT_SOURCE_COLLECTIONS (CSV) is still honoured and is
 * appended as an extra profile, so existing deployments keep working unchanged.
 */
export interface ApprovePaymentProfile {
  /** The approve-payment claim collection ID this profile applies to. */
  collectionId: string;
  /** Base collections whose approved claims may be used as the prefill source.
   *  Multiple are supported so a replacement "duplicate" collection can be added
   *  when an earlier one closes (quota / end date) without losing user claims
   *  already submitted to the old collection. */
  sourceCollectionIds: string[];
}

/** Credential index `credentialKey` (matrix state-event state key) for the KYC level-1 credential. */
export const KYC_AML_LEVEL1_CREDENTIAL_KEY = 'kycamllevel1';

const trimList = (v: unknown): string[] =>
  (Array.isArray(v) ? v : typeof v === 'string' ? v.split(',') : [])
    .map((s) => String(s ?? '').trim())
    .filter((s) => !!s);

function parseProfilesJson(raw: string): ApprovePaymentProfile[] {
  if (!raw.trim()) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.error('NEXT_PUBLIC_APPROVE_PAYMENT_PROFILES is not valid JSON; ignoring it.');
    return [];
  }
  if (!Array.isArray(parsed)) {
    console.error('NEXT_PUBLIC_APPROVE_PAYMENT_PROFILES must be a JSON array; ignoring it.');
    return [];
  }
  const out: ApprovePaymentProfile[] = [];
  for (const entry of parsed) {
    const collectionId = String((entry as any)?.collection ?? '').trim();
    const sourceCollectionIds = trimList((entry as any)?.sources);
    if (!collectionId) continue;
    out.push({ collectionId, sourceCollectionIds });
  }
  return out;
}

/** Legacy single-profile env vars — kept so existing deployments need no config change. */
export const APPROVE_PAYMENT_COLLECTION = (process.env.NEXT_PUBLIC_APPROVE_PAYMENT_COLLECTION || '').trim();
export const APPROVE_PAYMENT_SOURCE_COLLECTIONS = trimList(process.env.NEXT_PUBLIC_APPROVE_PAYMENT_SOURCE_COLLECTIONS);

function buildProfiles(): ApprovePaymentProfile[] {
  const profiles = parseProfilesJson(process.env.NEXT_PUBLIC_APPROVE_PAYMENT_PROFILES || '');
  if (APPROVE_PAYMENT_COLLECTION && !profiles.some((p) => p.collectionId === APPROVE_PAYMENT_COLLECTION)) {
    profiles.push({
      collectionId: APPROVE_PAYMENT_COLLECTION,
      sourceCollectionIds: APPROVE_PAYMENT_SOURCE_COLLECTIONS,
    });
  }
  return profiles;
}

export const APPROVE_PAYMENT_PROFILES: ApprovePaymentProfile[] = buildProfiles();

/** The profile whose payment collection matches `collectionId`, or null when it's
 *  not an approve-payment collection. First match wins if misconfigured with dupes. */
export function findApprovePaymentProfile(collectionId: string | null | undefined): ApprovePaymentProfile | null {
  if (!collectionId) return null;
  return APPROVE_PAYMENT_PROFILES.find((p) => p.collectionId === collectionId) ?? null;
}

export function isApprovePaymentCollection(collectionId: string | null | undefined): boolean {
  return !!findApprovePaymentProfile(collectionId);
}
