import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface SubclaimsState {
  claimsWithSubclaimsByParent: Record<string, string[]>;
  claimsWithSubclaimsFetchedAt: Record<string, number>;
}

const initialState: SubclaimsState = {
  claimsWithSubclaimsByParent: {},
  claimsWithSubclaimsFetchedAt: {},
};

const subclaimsSlice = createSlice({
  name: 'subclaims',
  initialState,
  reducers: {
    setClaimsWithSubclaims(state, action: PayloadAction<{ parentCollectionId: string; claimIds: string[] }>) {
      const { parentCollectionId, claimIds } = action.payload;
      state.claimsWithSubclaimsByParent[parentCollectionId] = claimIds;
      state.claimsWithSubclaimsFetchedAt[parentCollectionId] = Date.now();
    },
    clearSubclaims() {
      return initialState;
    },
  },
});

export const { setClaimsWithSubclaims, clearSubclaims } = subclaimsSlice.actions;
export default subclaimsSlice.reducer;
