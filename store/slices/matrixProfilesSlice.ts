import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface MatrixUserProfile {
  displayName: string | null;
  avatarUrl: string | null;
  fetchedAt: number;
}

interface MatrixProfilesState {
  byUserId: Record<string, MatrixUserProfile>;
  pending: Record<string, true>;
}

const initialState: MatrixProfilesState = {
  byUserId: {},
  pending: {},
};

const matrixProfilesSlice = createSlice({
  name: 'matrixProfiles',
  initialState,
  reducers: {
    setMatrixUserProfile(
      state,
      action: PayloadAction<{ userId: string; displayName: string | null; avatarUrl: string | null }>,
    ) {
      const { userId, displayName, avatarUrl } = action.payload;
      state.byUserId[userId] = { displayName, avatarUrl, fetchedAt: Date.now() };
      delete state.pending[userId];
    },
    setMatrixUserProfilePending(state, action: PayloadAction<{ userId: string }>) {
      state.pending[action.payload.userId] = true;
    },
    clearMatrixUserProfilePending(state, action: PayloadAction<{ userId: string }>) {
      delete state.pending[action.payload.userId];
    },
    clearMatrixProfiles() {
      return initialState;
    },
  },
});

export const {
  setMatrixUserProfile,
  setMatrixUserProfilePending,
  clearMatrixUserProfilePending,
  clearMatrixProfiles,
} = matrixProfilesSlice.actions;
export default matrixProfilesSlice.reducer;
