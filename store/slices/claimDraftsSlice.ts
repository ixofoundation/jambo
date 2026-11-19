import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface ClaimDraft {
  // 'kyc' is no longer written (the old KYC form is gone). It stays in the type
  // because a persisted draft from before may still carry it; such a draft
  // matches no form mode, so it is never restored (persist v5 deletes them:
  // store/migrations.ts).
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
