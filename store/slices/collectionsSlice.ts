import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface CollectionsState {
  byId: Record<string, any>;
  byEntityDid: Record<string, string[]>;
  fetchedAt: Record<string, number>;
  loading: boolean;
}

const initialState: CollectionsState = {
  byId: {},
  byEntityDid: {},
  fetchedAt: {},
  loading: false,
};

const collectionsSlice = createSlice({
  name: 'collections',
  initialState,
  reducers: {
    setCollections(state, action: PayloadAction<{ entityDid: string; collections: any[] }>) {
      const { entityDid, collections } = action.payload;
      // Remove old collections for this entity to prevent orphaned entries
      const oldIds = state.byEntityDid[entityDid] ?? [];
      for (const oldId of oldIds) {
        delete state.byId[oldId];
      }
      const ids: string[] = [];
      for (const c of collections) {
        if (c?.id) {
          state.byId[c.id] = c;
          ids.push(c.id);
        }
      }
      state.byEntityDid[entityDid] = ids;
      state.fetchedAt[entityDid] = Date.now();
    },
    setCollection(state, action: PayloadAction<{ id: string; collection: any }>) {
      state.byId[action.payload.id] = action.payload.collection;
    },
    setCollectionsLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload;
    },
    clearCollections() {
      return initialState;
    },
  },
});

export const { setCollections, setCollection, setCollectionsLoading, clearCollections } = collectionsSlice.actions;
export default collectionsSlice.reducer;
