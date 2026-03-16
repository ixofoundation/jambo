import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { SigningMethod } from '@contexts/auth';

interface AccountState {
  address: string | null;
  did: string | null;
  signingMethod: SigningMethod;
}

const initialState: AccountState = {
  address: null,
  did: null,
  signingMethod: undefined,
};

const accountSlice = createSlice({
  name: 'account',
  initialState,
  reducers: {
    setAccount(state, action: PayloadAction<{ address: string; did: string; signingMethod: SigningMethod }>) {
      state.address = action.payload.address;
      state.did = action.payload.did;
      state.signingMethod = action.payload.signingMethod;
    },
    clearAccount() {
      return initialState;
    },
  },
});

export const { setAccount, clearAccount } = accountSlice.actions;
export default accountSlice.reducer;
