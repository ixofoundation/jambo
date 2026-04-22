import { createAsyncThunk } from '@reduxjs/toolkit';
import { getAllowedSubcollections, getClaimsWithSubclaims } from '../../lib/yomaWorker/client';
import { IS_JAMBO_WORKER_ENABLED } from '../../lib/yomaWorker/config';
import { setAllowedSubcollections, setClaimsWithSubclaims } from '../slices/subclaimsSlice';
import type { RootState } from '../index';

const ALLOWED_TTL_MS = 60 * 1000;
const CLAIMS_WITH_SUB_TTL_MS = 15 * 1000;

export const fetchAllowedSubcollectionsForTrackedCollections = createAsyncThunk<
  void,
  { force?: boolean } | undefined,
  { state: RootState }
>('subclaims/fetchAllowed', async (args, { getState, dispatch }) => {
  if (!IS_JAMBO_WORKER_ENABLED) return;
  const force = !!args?.force;
  const state = getState();
  const collectionIds = Object.keys(state.collections.byId);
  if (collectionIds.length === 0) return;

  const now = Date.now();
  const targets = collectionIds.filter((id) => {
    if (force) return true;
    const fetchedAt = state.subclaims.allowedFetchedAt[id];
    return !fetchedAt || now - fetchedAt > ALLOWED_TTL_MS;
  });
  if (targets.length === 0) return;

  await Promise.allSettled(
    targets.map(async (parentCollectionId) => {
      const res = await getAllowedSubcollections(parentCollectionId);
      dispatch(
        setAllowedSubcollections({
          parentCollectionId,
          allowedSubcollections: res?.allowedSubcollections ?? [],
        }),
      );
    }),
  );
});

export const fetchClaimsWithSubclaims = createAsyncThunk<
  void,
  { parentCollectionId: string; force?: boolean },
  { state: RootState }
>('subclaims/fetchClaimsWithSubclaims', async ({ parentCollectionId, force }, { getState, dispatch }) => {
  if (!IS_JAMBO_WORKER_ENABLED) return;
  const state = getState();
  const fetchedAt = state.subclaims.claimsWithSubclaimsFetchedAt[parentCollectionId];
  if (!force && fetchedAt && Date.now() - fetchedAt < CLAIMS_WITH_SUB_TTL_MS) return;

  const res = await getClaimsWithSubclaims(parentCollectionId);
  const claimIds = res?.claims?.map((c) => c.claimId) ?? [];
  dispatch(setClaimsWithSubclaims({ parentCollectionId, claimIds }));
});
