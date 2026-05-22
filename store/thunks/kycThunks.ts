import { createAsyncThunk } from '@reduxjs/toolkit';

import { BLOCKSYNC_URL } from '@constants/common';
import { KYC_ENTITY_ID } from '@constants/kyc';
import gqlQuery from '@utils/graphql';
import { getAdditionalInfo, getServiceEndpoint } from '@utils/url';
import { setKycCollectionId, setKycDeedOfferId, setKycProtocolId, setKycSurveyTemplate } from '../slices/kycSlice';
import { setCollection } from '../slices/collectionsSlice';
import type { RootState } from '../index';

const STALENESS_THRESHOLD = 5 * 60 * 1000;

interface LoadKycFormArgs {
  force?: boolean;
}

interface LoadKycFormResult {
  protocolId: string;
  claimCollectionId: string;
  deedOfferId: string;
}

async function fetchKycClaimCollection(protocolId: string): Promise<{ id: string; entity: string }> {
  const query = `
    query getKycClaimCollectionByProtocol($protocolId: String!) {
      claimCollections(filter: { protocol: { equalTo: $protocolId } }) {
        nodes { 
          id 
          entity 
        }
      }
    }
  `;
  const result = await gqlQuery(BLOCKSYNC_URL, query, { protocolId });
  // @ts-ignore
  const node = result.data?.data?.claimCollections?.nodes?.[0];
  if (!node?.id) throw new Error('KYC claim collection not found');
  if (!node.entity) throw new Error('KYC claim collection has no owning entity');
  return { id: node.id, entity: node.entity };
}

async function fetchKycDeedOfferEntity(claimCollectionId: string) {
  const query = `
    query getOfferEntityByClaimCollectionId($claimCollectionId: String!) {
      entities(
        filter: {
          and: {
            type: { equalTo: "deed/offer" }
            iidById: { linkedEntity: { contains: [{ type: "ClaimCollection", id: $claimCollectionId }] } }
            # entityVerified: { equalTo: true }
          }
        }
      ) {
        nodes {
          id
          entityVerified
          linkedEntity
          linkedResource
          service
          type
        }
      }
    }
  `;
  const result = await gqlQuery(BLOCKSYNC_URL, query, { claimCollectionId });
  // @ts-ignore
  return result.data?.data?.entities?.nodes?.[0] ?? null;
}

export const loadKycForm = createAsyncThunk<LoadKycFormResult, LoadKycFormArgs | undefined>(
  'kyc/loadForm',
  async (args, { dispatch, getState }) => {
    const force = args?.force ?? false;
    const protocolId = KYC_ENTITY_ID;
    if (!protocolId) throw new Error('KYC not configured');

    if (!force) {
      const state = getState() as RootState;
      const { kyc, collections } = state;
      const cachedCollectionEntity = kyc.claimCollectionId
        ? collections.byId[kyc.claimCollectionId]?.entity
        : undefined;
      if (
        kyc.protocolId === protocolId &&
        kyc.claimCollectionId &&
        cachedCollectionEntity &&
        kyc.deedOfferId &&
        kyc.surveyTemplate &&
        kyc.resolvedAt &&
        Date.now() - kyc.resolvedAt < STALENESS_THRESHOLD
      ) {
        return {
          protocolId,
          claimCollectionId: kyc.claimCollectionId,
          deedOfferId: kyc.deedOfferId,
        };
      }
    }

    dispatch(setKycProtocolId(protocolId));

    const { id: claimCollectionId, entity: claimCollectionEntity } = await fetchKycClaimCollection(protocolId);
    dispatch(setKycCollectionId(claimCollectionId));
    dispatch(
      setCollection({
        id: claimCollectionId,
        collection: { id: claimCollectionId, entity: claimCollectionEntity, protocol: protocolId },
      }),
    );

    const offerEntity = await fetchKycDeedOfferEntity(claimCollectionId);
    if (!offerEntity?.id) throw new Error('KYC offer entity not found');
    dispatch(setKycDeedOfferId(offerEntity.id));

    const resource =
      offerEntity.linkedResource?.find((r: any) => r?.id?.includes('#vct')) ??
      offerEntity.linkedResource?.find((r: any) => r?.id?.includes('#surveyTemplate'));
    if (!resource?.serviceEndpoint) throw new Error('KYC form template not found');
    const url = getServiceEndpoint(resource.serviceEndpoint, offerEntity.service);
    console.log('url', url);
    const template = await getAdditionalInfo(url);
    console.log('template', template);
    dispatch(setKycSurveyTemplate({ template, url }));

    return { protocolId, claimCollectionId, deedOfferId: offerEntity.id };
  },
);
