import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface MatrixProfileState {
  displayName: string | null;
  avatarUrl: string | null;
}

const initialState: MatrixProfileState = {
  displayName: null,
  avatarUrl: null,
};

const matrixProfileSlice = createSlice({
  name: 'matrixProfile',
  initialState,
  reducers: {
    setMatrixProfile(state, action: PayloadAction<{ displayName?: string | null; avatarUrl?: string | null }>) {
      if (action.payload.displayName !== undefined) state.displayName = action.payload.displayName;
      if (action.payload.avatarUrl !== undefined) state.avatarUrl = action.payload.avatarUrl;
    },
    clearMatrixProfile() {
      return initialState;
    },
  },
});

export const { setMatrixProfile, clearMatrixProfile } = matrixProfileSlice.actions;
export default matrixProfileSlice.reducer;
