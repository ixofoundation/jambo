import { BLOCKSYNC_URL } from '@constants/common';
import { store } from '@store/index';
import { setEntity, clearEntities } from '@store/slices/entitiesSlice';
import gqlQuery from './graphql';

const STALENESS_THRESHOLD = 5 * 60 * 1000; // 5 minutes

export function clearEntityCache() {
  store.dispatch(clearEntities());
}

export async function fetchProtocolEntity(id: string, force = false) {
  if (!force) {
    const state = store.getState();
    const cached = state.entities.byId[id];
    const fetchedAt = state.entities.fetchedAt[id];
    if (cached && fetchedAt && Date.now() - fetchedAt < STALENESS_THRESHOLD) {
      return cached;
    }
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
    store.dispatch(setEntity({ id, entity: protocolEntity }));
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
  return offerEntities ?? [];
}
