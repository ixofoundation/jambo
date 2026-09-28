import { useCallback, useEffect, useRef, useState } from 'react';
import type { Model } from 'survey-core';
import type { createMatrixClaimBotClient } from '@ixo/matrixclient-sdk';
import { toast } from 'react-toastify';

import { findApprovePaymentProfile } from '@constants/approvePayment';
import { useAuth } from '@hooks/useAuth';
import { useBackgroundSetup } from '@hooks/useBackgroundSetup';
import { buildApprovePaymentPrefill, fetchSourceClaimData, loadKycPii } from '@utils/approvePayment';
import { fetchClaimsByCollectionId } from '@utils/claims';

type ClaimBotClient = ReturnType<typeof createMatrixClaimBotClient>;

export interface UseApprovePaymentPrefillArgs {
  collectionId: string;
  /** Only `claim` mode is an approve-payment candidate. */
  surveyMode: string;
  getClaimBotClient: () => ClaimBotClient | null | undefined;
}

export interface ApprovePaymentPrefillState {
  /** True when `collectionId` is a configured approve-payment collection. */
  active: boolean;
  /** True while the source claim + KYC data are still being resolved. The survey
   *  should stay gated (not rendered) while this is set. */
  prefetching: boolean;
  /** User-facing error when the source claim / KYC data could not be resolved. */
  error: string | null;
  /** The field prefill dict for the survey's initial data. Empty until prefetch
   *  resolves — always safe to spread. */
  buildPrefill: () => Record<string, any>;
  /** Apply the resolved prefill to a built survey model. No-op until prefetch has
   *  resolved, and runs at most once per hook lifetime so it never clobbers user
   *  edits. Call it from an effect keyed on the survey instance. */
  applyToSurvey: (survey: Model | undefined) => void;
}

/**
 * Approve-payment prefill: when the given collection is an approve-payment
 * collection (see `constants/approvePayment.ts`), resolve
 *
 *  1. the user's most recently approved claim across the profile's source
 *     collections (the "base" claim — business / bank details), and
 *  2. the user's saved KYC PII blob from their matrix room (personal details),
 *
 * then map both into the payment form's fields. `buildPrefill()` is for seeding
 * `model.data` when the survey model is constructed; `applyToSurvey()` applies
 * the prefill to an already-built model once, covering the case where the
 * template loads before the prefetch resolves. In both paths the prefill wins
 * over a saved draft for the fields it covers (fresh records beat stale ones);
 * the user's own answers are in fields the prefill never sets.
 *
 * Errors surface via `error` (and a toast); the caller decides how to render them.
 */
export function useApprovePaymentPrefill({
  collectionId,
  surveyMode,
  getClaimBotClient,
}: UseApprovePaymentPrefillArgs): ApprovePaymentPrefillState {
  const { address, did, matrixRoomId } = useAuth();
  const { awaitCompletion, getMatrixClient } = useBackgroundSetup();

  // The profile pairs this payment collection with its own base collections.
  const profile = surveyMode === 'claim' ? findApprovePaymentProfile(collectionId) : null;
  const active = !!profile;

  const [prefetching, setPrefetching] = useState(active);
  const [error, setError] = useState<string | null>(null);
  // Stashed in refs so the (memoised) survey-model initialiser can read them
  // without them being memo dependencies.
  const sourceClaimDataRef = useRef<Record<string, any> | null>(null);
  const piiDataRef = useRef<{ eventId: string; pii: Record<string, any> } | null>(null);
  const appliedRef = useRef(false);

  const buildPrefill = useCallback(
    () => (active ? buildApprovePaymentPrefill(sourceClaimDataRef.current, piiDataRef.current?.pii ?? null) : {}),
    [active],
  );

  // Resolve everything the prefill needs, strictly in sequence, and only drop the
  // gate once BOTH the source claim data and the KYC PII are in hand. (Running the
  // two loads concurrently and clearing the gate on the first one to finish lets
  // the form render — and the apply-once guard trip — with half the fields.)
  useEffect(() => {
    // Reset per profile so a collection change while mounted never reuses stale
    // data or a stale applied flag.
    sourceClaimDataRef.current = null;
    piiDataRef.current = null;
    appliedRef.current = false;
    setError(null);
    if (!profile) {
      setPrefetching(false);
      return;
    }
    const sourceCollectionIds = profile.sourceCollectionIds;
    let cancelled = false;
    setPrefetching(true);
    (async () => {
      try {
        if (sourceCollectionIds.length === 0) {
          throw new Error(
            `Source collections not configured for collection ${profile.collectionId} (NEXT_PUBLIC_APPROVE_PAYMENT_PROFILES).`,
          );
        }
        if (!address) throw new Error('Wallet address not available');
        if (!did) throw new Error('User DID not available');

        // 1) The user's claims in each source collection, in parallel. Only approved
        //    claims (evaluationByClaimId.status === 1) are eligible — pending /
        //    rejected / disputed are filtered out.
        const claimsPerCollection = await Promise.all(
          sourceCollectionIds.map(async (cid) => {
            const all: any[] = (await fetchClaimsByCollectionId(cid, address)) || [];
            return all.filter((c) => c?.evaluationByClaimId?.status === 1);
          }),
        );
        if (cancelled) return;

        // 2) Auto-select the most recently approved one (most recent `evaluationDate`).
        const allApproved = claimsPerCollection.flat();
        if (allApproved.length === 0) {
          throw new Error(
            'You do not have any approved claims in the source collections. Please submit one and wait for approval first.',
          );
        }
        const evalTs = (c: any) => {
          const raw = c?.evaluationByClaimId?.evaluationDate ?? c?.submissionDate;
          if (!raw) return 0;
          const t = new Date(raw).getTime();
          return Number.isFinite(t) ? t : 0;
        };
        allApproved.sort((a, b) => evalTs(b) - evalTs(a));
        const pick = allApproved[0];

        // 3) That claim's data — scoped to the collection it actually came from.
        const client = getClaimBotClient();
        if (!client) throw new Error('Claim service unavailable');
        const sourceClaimData = await fetchSourceClaimData({
          client,
          collectionId: pick.collectionId,
          claimId: pick.claimId,
          did,
        });
        if (cancelled) return;

        // 4) The KYC PII blob — the raw deed-offer payload saved alongside the
        //    verifiable credential; it carries the personal fields for this form.
        await awaitCompletion();
        const mxClient = getMatrixClient();
        if (!mxClient) throw new Error('Matrix client not ready');
        if (!matrixRoomId) throw new Error('User matrix room not available');
        const pii = await loadKycPii(mxClient, matrixRoomId);
        if (cancelled) return;
        if (!pii) {
          throw new Error('Your credential data is not in your Data Store. Please complete and save your KYC first.');
        }

        sourceClaimDataRef.current = sourceClaimData;
        piiDataRef.current = pii;
        setPrefetching(false);
      } catch (err: any) {
        if (cancelled) return;
        const msg = err?.message || 'Could not prepare this claim form';
        setError(msg);
        toast.error(msg);
        // Drop the gate so the error view can render instead of spinning forever.
        setPrefetching(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  // Apply the prefill once both the survey and the prefetched data are ready. The
  // survey memo can't depend on refs, so its in-memo prefill misses when the
  // template loads before the prefetch resolves — this catches that case. Runs at
  // most once to avoid clobbering subsequent user edits. The prefill overwrites
  // any draft values for the fields it covers, matching the seeding path: these
  // fields reflect the user's current records, and the user's own answers live in
  // fields the prefill never touches.
  const applyToSurvey = useCallback(
    (survey: Model | undefined) => {
      if (!active || !survey || prefetching || appliedRef.current) return;
      const prefill = buildPrefill();
      if (Object.keys(prefill).length === 0) return;
      Object.entries(prefill).forEach(([key, value]) => {
        try {
          survey.setValue(key, value);
        } catch {
          // Colon-named keys can trip setValue on some survey-core versions — fall
          // back to mutating data directly.
          try {
            survey.data = { ...survey.data, [key]: value };
          } catch {
            // ignore
          }
        }
      });
      appliedRef.current = true;
    },
    [active, prefetching, buildPrefill],
  );

  return { active, prefetching, error, buildPrefill, applyToSurvey };
}
