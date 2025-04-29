import { BLOCKSYNC_URL } from '@constants/common';
import gqlQuery from './graphql';

const ENTITY_CACHE = new Map<string, any>();

export async function fetchProtocolEntity(id: string) {
  if (ENTITY_CACHE.has(id)) {
    return ENTITY_CACHE.get(id);
  }
  const query = `
    query getProtocolEntityByEntityId {
      entities(filter: { id: { equalTo: "${id}" } }) {
        nodes {
          id
          accounts
          entityVerified
          linkedEntity
          linkedResource
          owner
          service
          settings
          type
          status
        }
      }
    }
  `;
  const result = await gqlQuery(BLOCKSYNC_URL, query);
  // @ts-ignore
  const protocolEntity = result.data?.data?.entities?.nodes?.[0];
  if (protocolEntity?.id) {
    ENTITY_CACHE.set(id, protocolEntity);
  }
  return protocolEntity;
}

export async function fetchOfferEntitiesByClaimCollectionId(collectionId: string) {
  const query = `
    query getOfferEntityByClaimCollectionId {
      entities(
        filter: {
          and: {
            type: { equalTo: "deed/offer" }
            iidById: { linkedEntity: { contains: [{ type: "ClaimCollection", id: "${collectionId}" }] } }
          }
        }
      ) {
        nodes {
          id
          accounts
          entityVerified
          linkedEntity
          linkedResource
          service
          settings
          type
          status
        }
      }
    }
  `;
  const result = await gqlQuery(BLOCKSYNC_URL, query);
  // @ts-ignore
  const offerEntities = result.data?.data?.entities?.nodes;
  // if (offerEntities?.length) {
  //   offerEntities.forEach((offerEntity: any) => {
  //     ENTITY_CACHE.set(offerEntity.id, offerEntity);
  //   });
  // }
  return offerEntities ?? [];
}
