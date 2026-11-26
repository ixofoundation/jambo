import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface AccountState {
  address: string | null;
  did: string | null;
  signingMethod: 'session_key' | undefined;
  sessionAuthenticatorId: string | null;
  displayName: string | null;
  /** Optional — sessions created before the auth hub returned it have none. */
  email?: string | null;
  /** 'workos' or a direct provider id ('yoma'); absent for sessions from before the hub returned it. */
  authProvider?: string | null;
  matrixUserId: string | null;
  matrixRoomId: string | null;
}

const initialState: AccountState = {
  address: null,
  did: null,
  signingMethod: undefined,
  sessionAuthenticatorId: null,
  displayName: null,
  email: null,
  authProvider: null,
  matrixUserId: null,
  matrixRoomId: null,
};

const accountSlice = createSlice({
  name: 'account',
  initialState,
  reducers: {
    setAccount(
      state,
      action: PayloadAction<{
        address: string;
        did: string;
        signingMethod: 'session_key';
        sessionAuthenticatorId: string | null;
        displayName: string | null;
        email?: string | null;
        authProvider?: string | null;
        matrixUserId: string | null;
        matrixRoomId: string | null;
      }>,
    ) {
      state.address = action.payload.address;
      state.did = action.payload.did;
      state.signingMethod = action.payload.signingMethod;
      state.sessionAuthenticatorId = action.payload.sessionAuthenticatorId;
      state.displayName = action.payload.displayName;
      state.email = action.payload.email ?? null;
      state.authProvider = action.payload.authProvider ?? null;
      state.matrixUserId = action.payload.matrixUserId;
      state.matrixRoomId = action.payload.matrixRoomId;
    },
    clearAccount() {
      return initialState;
    },
  },
});

export const { setAccount, clearAccount } = accountSlice.actions;
export default accountSlice.reducer;
