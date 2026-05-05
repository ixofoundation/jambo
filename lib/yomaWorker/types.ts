export type ClaimLinkStatus = 'pending' | 'approved' | 'rejected' | 'disputed';

export interface SubClaimView {
  subClaimId: string;
  subClaimCollectionId: string;
  status: ClaimLinkStatus;
}

export interface ClaimWithSubclaims {
  claimId: string;
  subClaims: SubClaimView[];
}

export interface CollectionLinksResponse {
  collection: string;
  sub: string[];
  base: string[];
}

export interface CollectionClaimsResponse {
  collectionId: string;
  claims: ClaimWithSubclaims[];
}

export interface RegisterSubclaimLinkageInput {
  parentCollectionId: string;
  parentClaimId: string;
  subClaimCollectionId: string;
  subClaimId: string;
  agentDid: string;
}

export interface WorkerEnvelope<T> {
  data: T | null;
  message: string;
  status: number;
}
