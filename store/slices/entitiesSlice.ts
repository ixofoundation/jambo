import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface EntitiesState {
  byId: Record<string, any>;
  fetchedAt: Record<string, number>;
}

const initialState: EntitiesState = {
  byId: {},
  fetchedAt: {},
};

const entitiesSlice = createSlice({
  name: 'entities',
  initialState,
  reducers: {
    setEntity(state, action: PayloadAction<{ id: string; entity: any }>) {
      state.byId[action.payload.id] = action.payload.entity;
      state.fetchedAt[action.payload.id] = Date.now();
    },
    setEntities(state, action: PayloadAction<Record<string, any>>) {
      const now = Date.now();
      for (const [id, entity] of Object.entries(action.payload)) {
        state.byId[id] = entity;
        state.fetchedAt[id] = now;
      }
    },
    clearEntities() {
      return initialState;
    },
  },
});

export const { setEntity, setEntities, clearEntities } = entitiesSlice.actions;
export default entitiesSlice.reducer;
