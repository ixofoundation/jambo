import { createAsyncThunk } from '@reduxjs/toolkit';
import { getClaimsWithSubclaims } from '../../lib/yomaWorker/client';
import { IS_JAMBO_WORKER_ENABLED } from '../../lib/yomaWorker/config';
import { setClaimsWithSubclaims } from '../slices/subclaimsSlice';
import type { RootState } from '../index';

const CLAIMS_WITH_SUB_TTL_MS = 15 * 1000;

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
  if (!res.ok) return;
  const claimIds = res.data?.claims?.map((c) => c.claimId) ?? [];
  dispatch(setClaimsWithSubclaims({ parentCollectionId, claimIds }));
});
