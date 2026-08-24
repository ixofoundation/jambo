import { store } from '@store/index';
import { setProfile } from '@store/slices/profilesSlice';
import { fetchProtocolEntities } from '@utils/entity';
import { getServiceEndpoint, getAdditionalInfo, cleanUrlString } from '@utils/url';

/**
 * Fetch and cache entity profile documents (name, hero image, brand,
 * description) for the given entities. One batched blocksync query resolves
 * the entities; only the profile documents themselves fan out (they live on
 * per-entity endpoints). Failures are non-blocking per entity.
 */
export async function ensureEntityProfiles(entityDids: string[]): Promise<void> {
  const profiles = store.getState().profiles.byEntityDid;
  // Entries cached before the deck existed lack the image/description fields —
  // refresh those too so cards get their hero imagery. (A fetched profile with
  // no image stores description: '' so it is not re-fetched every mount.)
  const missing = entityDids.filter((id) => {
    const p = profiles[id];
    return !p || (p.image === undefined && p.description === undefined);
  });
  if (missing.length === 0) return;

  const entities = await fetchProtocolEntities(missing).catch(() => []);
  const entityById: Record<string, any> = {};
  for (const e of entities) if (e?.id) entityById[e.id] = e;

  await Promise.allSettled(
    missing.map(async (entityDid) => {
      try {
        const entity = entityById[entityDid];
        const profileEndpoint = entity?.settings?.Profile?.serviceEndpoint;
        if (!profileEndpoint) return;
        const resolvedUrl = getServiceEndpoint(profileEndpoint, entity.service);
        const doc = await getAdditionalInfo(resolvedUrl);
        if (!doc?.name) return;
        store.dispatch(
          setProfile({
            entityDid,
            profile: {
              name: doc.name,
              logo: doc.logo ? cleanUrlString(doc.logo) : undefined,
              type: entity.type,
              image: doc.image ? cleanUrlString(doc.image) : undefined,
              brand: typeof doc.brand === 'string' ? doc.brand : undefined,
              description: typeof doc.description === 'string' ? doc.description : '',
              location: typeof doc.location === 'string' ? doc.location : undefined,
            },
          }),
        );
      } catch {
        // Profile fetch failure is non-blocking
      }
    }),
  );
}
