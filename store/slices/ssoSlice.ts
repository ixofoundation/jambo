import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface SSOState {
  isAuthenticated: boolean;
  idToken: string | null;
  accessToken: string | null;
  email: string | null;
  name: string | null;
  picture: string | null;
}

const initialState: SSOState = {
  isAuthenticated: false,
  idToken: null,
  accessToken: null,
  email: null,
  name: null,
  picture: null,
};

const ssoSlice = createSlice({
  name: 'sso',
  initialState,
  reducers: {
    setSSOSession(
      state,
      action: PayloadAction<{
        idToken: string;
        accessToken?: string | null;
        email: string | null;
        name: string | null;
        picture?: string | null;
      }>,
    ) {
      state.isAuthenticated = true;
      state.idToken = action.payload.idToken;
      state.accessToken = action.payload.accessToken ?? null;
      state.email = action.payload.email;
      state.name = action.payload.name;
      state.picture = action.payload.picture ?? null;
    },
    clearSSOSession() {
      return initialState;
    },
  },
});

export const { setSSOSession, clearSSOSession } = ssoSlice.actions;
export default ssoSlice.reducer;
