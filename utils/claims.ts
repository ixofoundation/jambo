import { BLOCKSYNC_URL, CHAIN_RPC_URL } from '@constants/common';
import { createQueryClient } from '@ixo/impactxclient-sdk';
import { store } from '@store/index';
import { setCollection, setCollections, clearCollections } from '@store/slices/collectionsSlice';
import gqlQuery from './graphql';

export function clearCollectionCache() {
  store.dispatch(clearCollections());
}

export async function fetchCollectionByCollectionId(collectionId: string) {
  const cached = store.getState().collections.byId[collectionId];
  if (cached) return cached;

  const queryClient = await createQueryClient(CHAIN_RPC_URL);
  const claimCollectionResponse = await queryClient.ixo.claims.v1beta1.collection({ id: collectionId });
  if (!claimCollectionResponse?.collection?.id) {
    throw new Error('Collection not found');
  }
  store.dispatch(setCollection({ id: collectionId, collection: claimCollectionResponse.collection }));
  return claimCollectionResponse.collection;
}

export async function fetchCollectionsByProtocolDid(protocolDid: string) {
  const query = `
    query getCollectionsByProtocol {
      claimCollections(filter: { protocol: { equalTo: "${protocolDid}" } }) {
        nodes {
          id
          entity
          admin
          protocol
          startDate
          endDate
          state
          count
          quota
          evaluated
          approved
          rejected
          disputed
          payments
        }
      }
    }
  `;
  const result = await gqlQuery(BLOCKSYNC_URL, query);
  // @ts-ignore
  const collections = result.data?.data?.claimCollections?.nodes;
  if (collections?.length) {
    collections.forEach((c: any) => {
      if (c?.id) store.dispatch(setCollection({ id: c.id, collection: c }));
    });
  }
  return collections ?? [];
}

export async function fetchCollectionsByEntityDid(entityDid: string) {
  const query = `
    query getCollectionsByEntity {
      claimCollections(filter: { entity: { equalTo: "${entityDid}" } }) {
        nodes {
          id
          entity
          admin
          protocol
          startDate
          endDate
          state
          count
          quota
          evaluated
          approved
          rejected
          disputed
          payments
        }
      }
    }
  `;
  const result = await gqlQuery(BLOCKSYNC_URL, query);
  // @ts-ignore
  const collections = result.data?.data?.claimCollections?.nodes;
  if (collections?.length) {
    store.dispatch(setCollections({ entityDid, collections }));
  }
  return collections ?? [];
}

/**
 * Lightweight count (no store side effects) of the claim collections an entity
 * owns. Used by admin entity-whitelisting to warn before whitelisting an entity
 * that has nothing to claim against, and to label each whitelisted entity.
 */
export async function getEntityClaimCollectionCount(entityDid: string): Promise<number> {
  const query = `
    query entityCollectionCount {
      claimCollections(filter: { entity: { equalTo: "${entityDid}" } }) {
        nodes {
          id
        }
      }
    }
  `;
  const result = await gqlQuery<{ data?: { claimCollections?: { nodes?: Array<{ id: string }> } } }>(
    BLOCKSYNC_URL,
    query,
  );
  if (result.error) throw result.error;
  return result.data?.data?.claimCollections?.nodes?.length ?? 0;
}

/** Convenience boolean wrapper around getEntityClaimCollectionCount. */
export async function entityHasClaimCollections(entityDid: string): Promise<boolean> {
  return (await getEntityClaimCollectionCount(entityDid)) > 0;
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
          evaluationByClaimId {
            status
            evaluationDate
            oracle
          }
        }
      }
    }
  `;
  const result = await gqlQuery(BLOCKSYNC_URL, query);
  // @ts-ignore
  return result.data?.data?.claims?.nodes;
}

export async function fetchAllClaimsByCollectionId(collectionId: string) {
  const query = `
    query getAllClaimsByCollectionId {
      claims(filter: { collectionId: { equalTo: "${collectionId}" } }) {
        nodes {
          claimId
          collectionId
          agentAddress
          agentDid
          paymentsStatus
          schemaType
          submissionDate
          evaluationByClaimId {
            status
            evaluationDate
            oracle
          }
        }
      }
    }
  `;
  const result = await gqlQuery(BLOCKSYNC_URL, query);
  // @ts-ignore
  return result.data?.data?.claims?.nodes;
}
