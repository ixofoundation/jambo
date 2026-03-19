import { createAsyncThunk } from '@reduxjs/toolkit';
import { fetchProtocolEntity } from '@utils/entity';
import { fetchCollectionsByEntityDid } from '@utils/claims';
import { getServiceEndpoint, getAdditionalInfo } from '@utils/url';
import { setCollectionsLoading } from '../slices/collectionsSlice';
import { setVctTemplate, setFormName } from '../slices/protocolsSlice';
import { setProfile } from '../slices/profilesSlice';

interface FetchCollectionDataArgs {
  entityDid: string;
  force?: boolean;
}

export const fetchAllCollectionData = createAsyncThunk(
  'data/fetchAllCollectionData',
  async ({ entityDid, force }: FetchCollectionDataArgs, { dispatch }) => {
    dispatch(setCollectionsLoading(true));
    try {
      if (!entityDid) return;

      // Fetch entity profile (non-blocking)
      (async () => {
        try {
          const entity = await fetchProtocolEntity(entityDid);
          const profileEndpoint = entity?.settings?.Profile?.serviceEndpoint;
          if (!profileEndpoint) return;
          const resolvedUrl = getServiceEndpoint(profileEndpoint, entity.service);
          const profileData = await getAdditionalInfo(resolvedUrl);
          if (profileData?.name) {
            dispatch(
              setProfile({
                entityDid,
                profile: { name: profileData.name, logo: profileData.logo, type: entity.type },
              }),
            );
          }
        } catch {
          // Profile fetch failure doesn't block collection loading
        }
      })();

      // Step 1: Fetch collections for this entity DID
      // fetchCollectionsByEntityDid dispatches setCollections to the store,
      // which atomically replaces collections per entityDid (removes old, adds new)
      const collectionResults = await Promise.allSettled([entityDid].map((did) => fetchCollectionsByEntityDid(did)));

      const allRawCollections: any[] = [];
      collectionResults.forEach((result) => {
        if (result.status === 'fulfilled' && Array.isArray(result.value)) {
          allRawCollections.push(...result.value);
        }
      });

      // Step 2: Get unique protocol DIDs
      const protocolDids = [...new Set(allRawCollections.map((c: any) => c.protocol).filter(Boolean))];

      // Step 3: Fetch protocol entities (bypasses staleness cache when force=true)
      // fetchProtocolEntity dispatches setEntity to the store
      const entityResults = await Promise.allSettled(protocolDids.map((did) => fetchProtocolEntity(did, !!force)));
      const entityMap = new Map<string, any>();
      entityResults.forEach((result, i) => {
        if (result.status === 'fulfilled' && result.value?.id) {
          entityMap.set(protocolDids[i], result.value);
        }
      });

      // Step 4: Resolve VCT templates and form names
      await Promise.allSettled(
        protocolDids.map(async (did) => {
          try {
            const entity = entityMap.get(did);
            const vctResource = entity?.linkedResource?.find(
              (r: any) => r?.id?.includes('#vct-1') || r?.id?.includes('#vct') || r?.id?.includes('#surveyTemplate'),
            );
            if (!vctResource?.serviceEndpoint) return;
            const url = getServiceEndpoint(vctResource.serviceEndpoint, entity.service);
            const formData = await getAdditionalInfo(url);
            if (formData) {
              dispatch(setVctTemplate({ protocolDid: did, template: formData }));
              const name = formData?.title || formData?.question?.title;
              if (name) {
                dispatch(setFormName({ protocolDid: did, name }));
              }
            }
          } catch {
            // silent fail
          }
        }),
      );
    } finally {
      dispatch(setCollectionsLoading(false));
    }
  },
);
