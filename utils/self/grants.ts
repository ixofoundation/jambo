import type { Capability } from '@ixo/ucan';

import {
  IDENTITY_LEVEL1_VCT,
  SELF_ISSUER_DID,
  SELF_LINK_CAPABILITY,
  SELF_LINK_DELEGATION_TTL_SECONDS,
  SELF_OFFER_CAPABILITY,
  SELF_OFFER_CONSENT_TTL_SECONDS,
  SELF_SERVICE_DID,
} from '@constants/self';
import { mintDelegation } from '@utils/ucanDelegation';
import { serverNowSeconds } from './serverTime';

/**
 * The two delegations a Self identity check needs, signed in the browser with
 * the person's Ed25519 key (docs/self-kyc-plan.md 4.2). Jambo's server cannot
 * make either: Self checks both signatures against the person's DID document.
 *
 * Both expiries are counted from the server's time, not the device's: Jambo's
 * route refuses a delegation that is expired or lives too long by its own
 * clock (`clock_skew`), and a phone's clock can be minutes off.
 */

/**
 * person -> Jambo's service account: lets the service ask Self for a link, or
 * read one's status, for this person. Short-lived and minted fresh for every
 * request, so each call proves the caller holds the person's key.
 */
export async function mintSelfLinkDelegation(userDid: string): Promise<string> {
  if (!SELF_SERVICE_DID) throw new Error('The identity check is not configured');
  return mintDelegation({
    userDid,
    audience: SELF_SERVICE_DID,
    capabilities: [{ ...SELF_LINK_CAPABILITY }],
    ttlSeconds: SELF_LINK_DELEGATION_TTL_SECONDS,
    nowSeconds: await serverNowSeconds(),
  });
}

/**
 * person -> Self's issuer: the offer consent. With it the Auth Hub saves the
 * `IdentityLevel1` credential without asking. Self accepts exactly this one
 * capability with exactly this caveat, and nothing else.
 */
export async function mintSelfOfferConsent(userDid: string): Promise<string> {
  const capability: Capability = { ...SELF_OFFER_CAPABILITY, nb: { vct: [IDENTITY_LEVEL1_VCT] } };
  return mintDelegation({
    userDid,
    audience: SELF_ISSUER_DID,
    capabilities: [capability],
    ttlSeconds: SELF_OFFER_CONSENT_TTL_SECONDS,
    nowSeconds: await serverNowSeconds(),
  });
}
