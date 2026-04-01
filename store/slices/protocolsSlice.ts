import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface ProtocolsState {
  vctTemplates: Record<string, any>;
  bcoTemplates: Record<string, any>;
  bevTemplates: Record<string, any>;
  formNames: Record<string, string>;
  fetchedAt: Record<string, number>;
  resolvedUrls: Record<string, { vct?: string; bco?: string; bev?: string }>;
}

const initialState: ProtocolsState = {
  vctTemplates: {},
  bcoTemplates: {},
  bevTemplates: {},
  formNames: {},
  fetchedAt: {},
  resolvedUrls: {},
};

const protocolsSlice = createSlice({
  name: 'protocols',
  initialState,
  reducers: {
    setVctTemplate(state, action: PayloadAction<{ protocolDid: string; template: any; url: string }>) {
      state.vctTemplates[action.payload.protocolDid] = action.payload.template;
      state.fetchedAt[action.payload.protocolDid] = Date.now();
      if (!state.resolvedUrls) state.resolvedUrls = {};
      if (!state.resolvedUrls[action.payload.protocolDid]) state.resolvedUrls[action.payload.protocolDid] = {};
      state.resolvedUrls[action.payload.protocolDid].vct = action.payload.url;
    },
    setBcoTemplate(state, action: PayloadAction<{ protocolDid: string; template: any; url: string }>) {
      state.bcoTemplates[action.payload.protocolDid] = action.payload.template;
      if (!state.resolvedUrls) state.resolvedUrls = {};
      if (!state.resolvedUrls[action.payload.protocolDid]) state.resolvedUrls[action.payload.protocolDid] = {};
      state.resolvedUrls[action.payload.protocolDid].bco = action.payload.url;
    },
    setBevTemplate(state, action: PayloadAction<{ protocolDid: string; template: any; url: string }>) {
      if (!state.bevTemplates) state.bevTemplates = {};
      state.bevTemplates[action.payload.protocolDid] = action.payload.template;
      if (!state.resolvedUrls) state.resolvedUrls = {};
      if (!state.resolvedUrls[action.payload.protocolDid]) state.resolvedUrls[action.payload.protocolDid] = {};
      state.resolvedUrls[action.payload.protocolDid].bev = action.payload.url;
    },
    setFormName(state, action: PayloadAction<{ protocolDid: string; name: string }>) {
      state.formNames[action.payload.protocolDid] = action.payload.name;
    },
    clearProtocols() {
      return initialState;
    },
  },
});

export const { setVctTemplate, setBcoTemplate, setBevTemplate, setFormName, clearProtocols } = protocolsSlice.actions;
export default protocolsSlice.reducer;
