import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface ClaimDraft {
  surveyMode: 'bid' | 'claim';
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
    updateDraftData(state, action: PayloadAction<{ collectionId: string; surveyData: Record<string, any> }>) {
      const draft = state.byCollectionId[action.payload.collectionId];
      if (draft) {
        draft.surveyData = action.payload.surveyData;
        draft.updatedAt = Date.now();
      }
    },
    clearDraft(state, action: PayloadAction<string>) {
      delete state.byCollectionId[action.payload];
    },
    clearAllDrafts() {
      return initialState;
    },
  },
});

export const { saveDraft, updateDraftData, clearDraft, clearAllDrafts } = claimDraftsSlice.actions;
export default claimDraftsSlice.reducer;
