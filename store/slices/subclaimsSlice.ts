import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface SubclaimsState {
  allowedSubcollectionsByParent: Record<string, string[]>;
  allowedFetchedAt: Record<string, number>;
  claimsWithSubclaimsByParent: Record<string, string[]>;
  claimsWithSubclaimsFetchedAt: Record<string, number>;
}

const initialState: SubclaimsState = {
  allowedSubcollectionsByParent: {},
  allowedFetchedAt: {},
  claimsWithSubclaimsByParent: {},
  claimsWithSubclaimsFetchedAt: {},
};

const subclaimsSlice = createSlice({
  name: 'subclaims',
  initialState,
  reducers: {
    setAllowedSubcollections(
      state,
      action: PayloadAction<{ parentCollectionId: string; allowedSubcollections: string[] }>,
    ) {
      const { parentCollectionId, allowedSubcollections } = action.payload;
      state.allowedSubcollectionsByParent[parentCollectionId] = allowedSubcollections;
      state.allowedFetchedAt[parentCollectionId] = Date.now();
    },
    setClaimsWithSubclaims(
      state,
      action: PayloadAction<{ parentCollectionId: string; claimIds: string[] }>,
    ) {
      const { parentCollectionId, claimIds } = action.payload;
      state.claimsWithSubclaimsByParent[parentCollectionId] = claimIds;
      state.claimsWithSubclaimsFetchedAt[parentCollectionId] = Date.now();
    },
    clearSubclaims() {
      return initialState;
    },
  },
});

export const { setAllowedSubcollections, setClaimsWithSubclaims, clearSubclaims } = subclaimsSlice.actions;
export default subclaimsSlice.reducer;
