import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface ProtocolsState {
  vctTemplates: Record<string, any>;
  bcoTemplates: Record<string, any>;
  formNames: Record<string, string>;
  fetchedAt: Record<string, number>;
}

const initialState: ProtocolsState = {
  vctTemplates: {},
  bcoTemplates: {},
  formNames: {},
  fetchedAt: {},
};

const protocolsSlice = createSlice({
  name: 'protocols',
  initialState,
  reducers: {
    setVctTemplate(state, action: PayloadAction<{ protocolDid: string; template: any }>) {
      state.vctTemplates[action.payload.protocolDid] = action.payload.template;
      state.fetchedAt[action.payload.protocolDid] = Date.now();
    },
    setBcoTemplate(state, action: PayloadAction<{ protocolDid: string; template: any }>) {
      state.bcoTemplates[action.payload.protocolDid] = action.payload.template;
    },
    setFormName(state, action: PayloadAction<{ protocolDid: string; name: string }>) {
      state.formNames[action.payload.protocolDid] = action.payload.name;
    },
    clearProtocols() {
      return initialState;
    },
  },
});

export const { setVctTemplate, setBcoTemplate, setFormName, clearProtocols } = protocolsSlice.actions;
export default protocolsSlice.reducer;
