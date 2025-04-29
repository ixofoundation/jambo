import { BLOCKSYNC_URL, CHAIN_RPC_URL } from '@constants/common';
import { createQueryClient } from '@ixo/impactxclient-sdk';
import gqlQuery from './graphql';

const COLLECTION_CACHE = new Map<string, any>();

export async function fetchCollectionByCollectionId(collectionId: string) {
  if (COLLECTION_CACHE.has(collectionId)) {
    return COLLECTION_CACHE.get(collectionId);
  }
  const queryClient = await createQueryClient(CHAIN_RPC_URL);
  const claimCollectionResponse = await queryClient.ixo.claims.v1beta1.collection({ id: collectionId });
  if (!claimCollectionResponse?.collection?.id) {
    throw new Error('Collection not found');
  }
  COLLECTION_CACHE.set(collectionId, claimCollectionResponse.collection);
  return COLLECTION_CACHE.get(collectionId);
}

export async function fetchClaimsByCollectionId(collectionId: string, address: string) {
  const query = `
    query getClaimsByClaimCollectionIds {
      claims(filter: { collectionId: { equalTo: "${collectionId}" }, agentAddress: { equalTo: "${address}" } }) {
        nodes {
          claimId
          collectionId
          paymentsStatus
          schemaType
          submissionDate
        }
      }
    }
  `;
  const result = await gqlQuery(BLOCKSYNC_URL, query);
  // @ts-ignore
  return result.data?.data?.claims?.nodes;
}
