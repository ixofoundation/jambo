import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface ClaimDraft {
  surveyMode: 'bco' | 'bev' | 'claim' | 'view' | 'kyc';
  surveyTemplate: string;
  surveyData: Record<string, any>;
  updatedAt: number;
}

interface ClaimDraftsState {
  byCollectionId: Record<string, ClaimDraft>;
}

const initialState: ClaimDraftsState = {
  byCollectionId: {},
};

const claimDraftsSlice = createSlice({
  name: 'claimDrafts',
  initialState,
  reducers: {
    saveDraft(state, action: PayloadAction<{ collectionId: string; draft: ClaimDraft }>) {
      state.byCollectionId[action.payload.collectionId] = action.payload.draft;
    },
    clearDraft(state, action: PayloadAction<string>) {
      delete state.byCollectionId[action.payload];
    },
    clearAllDrafts() {
      return initialState;
    },
  },
});

export const { saveDraft, clearDraft, clearAllDrafts } = claimDraftsSlice.actions;
export default claimDraftsSlice.reducer;
