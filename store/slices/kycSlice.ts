import { createSlice, PayloadAction } from '@reduxjs/toolkit';

import { KycStatus } from '@constants/kyc';

export interface KycEntry {
  status?: KycStatus;
  lastRedirectAt?: number;
  lastPolledAt?: number;
  credentialSaved?: boolean;
  credentialType?: string;
  lastError?: string;
}

interface KycState {
  protocolId: string | null;
  claimCollectionId: string | null;
  deedOfferId: string | null;
  surveyTemplate: any | null;
  surveyTemplateUrl: string | null;
  resolvedAt: number | null;
  byProtocolId: Record<string, KycEntry>;
}

const initialState: KycState = {
  protocolId: null,
  claimCollectionId: null,
  deedOfferId: null,
  surveyTemplate: null,
  surveyTemplateUrl: null,
  resolvedAt: null,
  byProtocolId: {},
};

const kycSlice = createSlice({
  name: 'kyc',
  initialState,
  reducers: {
    setKycStatus(state, action: PayloadAction<{ protocolId: string; status: KycStatus }>) {
      const { protocolId, status } = action.payload;
      const prev = state.byProtocolId[protocolId] ?? {};
      state.byProtocolId[protocolId] = {
        ...prev,
        status,
        lastPolledAt: Date.now(),
        lastError: undefined,
      };
    },
    setRedirectedAt(state, action: PayloadAction<{ protocolId: string; at: number }>) {
      const { protocolId, at } = action.payload;
      const prev = state.byProtocolId[protocolId] ?? {};
      state.byProtocolId[protocolId] = { ...prev, lastRedirectAt: at };
    },
    markCredentialSaved(state, action: PayloadAction<{ protocolId: string; credentialType: string }>) {
      const { protocolId, credentialType } = action.payload;
      const prev = state.byProtocolId[protocolId] ?? {};
      state.byProtocolId[protocolId] = { ...prev, credentialSaved: true, credentialType };
    },
    setKycError(state, action: PayloadAction<{ protocolId: string; message: string }>) {
      const { protocolId, message } = action.payload;
      const prev = state.byProtocolId[protocolId] ?? {};
      state.byProtocolId[protocolId] = { ...prev, lastError: message };
    },
    setKycProtocolId(state, action: PayloadAction<string>) {
      state.protocolId = action.payload;
    },
    setKycCollectionId(state, action: PayloadAction<string>) {
      state.claimCollectionId = action.payload;
    },
    setKycDeedOfferId(state, action: PayloadAction<string>) {
      state.deedOfferId = action.payload;
    },
    setKycSurveyTemplate(state, action: PayloadAction<{ template: any; url: string }>) {
      state.surveyTemplate = action.payload.template;
      state.surveyTemplateUrl = action.payload.url;
      state.resolvedAt = Date.now();
    },
    clearKycData(state) {
      state.protocolId = null;
      state.claimCollectionId = null;
      state.deedOfferId = null;
      state.surveyTemplate = null;
      state.surveyTemplateUrl = null;
      state.resolvedAt = null;
      state.byProtocolId = {};
    },
  },
});

export const {
  setKycStatus,
  setRedirectedAt,
  markCredentialSaved,
  setKycError,
  setKycProtocolId,
  setKycCollectionId,
  setKycDeedOfferId,
  setKycSurveyTemplate,
  clearKycData,
} = kycSlice.actions;
export default kycSlice.reducer;
