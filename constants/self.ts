import { CHAIN_NETWORK_TYPE, DefaultChainNetwork } from '@constants/common';

/**
 * Self identity check (ixo-self) config. See docs/self-kyc-plan.md.
 *
 * Self issues the `IdentityLevel1` credential into the person's Auth Hub
 * wallet. Jambo asks Self for a single-use link through its own server route
 * (pages/api/self), signed by the Jambo service account.
 */
type SelfNetworkConfig = {
  /** Self API origin; every route sits under `/identity`. */
  apiUrl: string;
  /** Self web app origin: the only origin a link may point at. */
  webUrl: string;
  /** Self's `did:web`: the audience of the invocation Jambo's server signs. */
  serviceDid: string;
  /** The DID that signs `IdentityLevel1` credentials on this network. */
  issuerDid: string;
};

const SELF_BY_NETWORK: Partial<Record<CHAIN_NETWORK_TYPE, SelfNetworkConfig>> = {
  [CHAIN_NETWORK_TYPE.MAINNET]: {
    apiUrl: 'https://api.self.ixo.earth',
    webUrl: 'https://self.ixo.earth',
    serviceDid: 'did:web:api.self.ixo.earth',
    issuerDid: 'did:ixo:entity:3ea2744791e5b8ce1ddd7d96c9fd27e7',
  },
  [CHAIN_NETWORK_TYPE.TESTNET]: {
    apiUrl: 'https://api.test.self.ixo.earth',
    webUrl: 'https://test.self.ixo.earth',
    serviceDid: 'did:web:api.test.self.ixo.earth',
    issuerDid: 'did:ixo:entity:f45746b09949bda3808d02439e212dcb',
  },
  [CHAIN_NETWORK_TYPE.DEVNET]: {
    apiUrl: 'https://api.dev.self.ixo.earth',
    webUrl: 'https://dev.self.ixo.earth',
    serviceDid: 'did:web:api.dev.self.ixo.earth',
    issuerDid: 'did:ixo:entity:80f392610e8a128b4f4b1ed828dbeb7f',
  },
};

const network = (SELF_BY_NETWORK[DefaultChainNetwork] ?? SELF_BY_NETWORK[CHAIN_NETWORK_TYPE.DEVNET]) as SelfNetworkConfig;

export const SELF_API_URL = network.apiUrl;
export const SELF_WEB_URL = network.webUrl;
export const SELF_AUDIENCE_DID = network.serviceDid;
export const SELF_ISSUER_DID = network.issuerDid;

/** The credential type Self issues. */
export const IDENTITY_LEVEL1_VCT = 'https://credentials.ixo.world/types/IdentityLevel1';

/**
 * Jambo's service account (`did:ixo:ixo1…`): the audience of the person's
 * `identity/link` delegation. Blank = the Self check cannot be started (see
 * docs/self-service-account-setup.md).
 */
export const SELF_SERVICE_DID = (process.env.NEXT_PUBLIC_SELF_SERVICE_DID || '').trim();
export const SELF_KYC_ENABLED = SELF_SERVICE_DID.length > 0;

/** person -> Jambo service: lets the service ask Self for a link. */
export const SELF_LINK_CAPABILITY = { can: 'identity/link', with: 'ixo:identity' } as const;
/** person -> Self issuer: lets the Hub save the credential without asking. */
export const SELF_OFFER_CAPABILITY = { can: 'credentials/offer', with: 'ixo:credentials' } as const;
/** person -> Auth Hub, on `ixo:auth-hub:user:<address>`: read their own credentials. */
export const HUB_CREDENTIALS_ABILITY = 'auth/user/credentials';

/**
 * Lifetime of the `identity/link` delegation. A fresh one is minted for every
 * request, so each call proves the caller holds the person's key. Jambo's
 * route keeps no record of the ones it has seen: one can be replayed to it
 * until it expires. Hardening (not done): a single-use store keyed on the
 * delegation's CID, e.g. by moving the routes into ixo-yoma-jambo-worker.
 */
export const SELF_LINK_DELEGATION_TTL_SECONDS = 5 * 60;
/**
 * Lifetime of the offer consent. It must still be valid when the credential
 * is offered, and a manual review can take up to 48 hours. Self's maximum is
 * 31 days.
 */
export const SELF_OFFER_CONSENT_TTL_SECONDS = 7 * 24 * 60 * 60;
