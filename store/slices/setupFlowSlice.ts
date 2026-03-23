import { createSlice, PayloadAction } from '@reduxjs/toolkit';

// ─── Types ───────────────────────────────────────────────────────────────────

export type SetupFlowType = 'register' | 'login';

export type RegisterStep =
  | 'MNEMONIC_SAVED'
  | 'FEEGRANT_GRANTED'
  | 'PASSKEY_REGISTERED'
  | 'PIN_COLLECTED'
  | 'DID_CREATED'
  | 'MATRIX_MNEMONIC_SAVED'
  | 'MATRIX_ACCOUNT_CREATED'
  | 'CROSS_SIGNING_DONE'
  | 'MATRIX_ROOM_CREATED'
  | 'MNEMONIC_STORED_IN_ROOM'
  | 'COMPLETE';

export type LoginStep =
  | 'PASSKEY_ASSERTED'
  | 'ENCRYPTED_MNEMONIC_CACHED'
  | 'PIN_ENTERED'
  | 'MATRIX_LOGGED_IN'
  | 'CROSS_SIGNING_DONE'
  | 'COMPLETE';

export type FlowStep = RegisterStep | LoginStep;

export interface SetupFlowState {
  flowType: SetupFlowType | null;
  currentStep: FlowStep | null;
  address: string | null;
  did: string | null;
  credentialId: string | null;
  authenticatorId: string | null;
  keyId: string | null;
  startedAt: number | null;
  lastError: string | null;
}

// ─── Step ordering (for resume logic) ────────────────────────────────────────

export const REGISTER_STEP_ORDER: RegisterStep[] = [
  'MNEMONIC_SAVED',
  'FEEGRANT_GRANTED',
  'PASSKEY_REGISTERED',
  'PIN_COLLECTED',
  'DID_CREATED',
  'MATRIX_MNEMONIC_SAVED',
  'MATRIX_ACCOUNT_CREATED',
  'CROSS_SIGNING_DONE',
  'MATRIX_ROOM_CREATED',
  'MNEMONIC_STORED_IN_ROOM',
  'COMPLETE',
];

export const LOGIN_STEP_ORDER: LoginStep[] = [
  'PASSKEY_ASSERTED',
  'ENCRYPTED_MNEMONIC_CACHED',
  'PIN_ENTERED',
  'MATRIX_LOGGED_IN',
  'CROSS_SIGNING_DONE',
  'COMPLETE',
];

/** Returns true if currentStep is before targetStep in the ordering. */
export function isStepBefore(currentStep: FlowStep, targetStep: FlowStep, flowType: SetupFlowType): boolean {
  const order = flowType === 'register' ? REGISTER_STEP_ORDER : LOGIN_STEP_ORDER;
  const currentIdx = order.indexOf(currentStep as any);
  const targetIdx = order.indexOf(targetStep as any);
  if (currentIdx === -1 || targetIdx === -1) return false;
  return currentIdx < targetIdx;
}

// ─── Slice ───────────────────────────────────────────────────────────────────

const initialState: SetupFlowState = {
  flowType: null,
  currentStep: null,
  address: null,
  did: null,
  credentialId: null,
  authenticatorId: null,
  keyId: null,
  startedAt: null,
  lastError: null,
};

const setupFlowSlice = createSlice({
  name: 'setupFlow',
  initialState,
  reducers: {
    startFlow(
      state,
      action: PayloadAction<{
        flowType: SetupFlowType;
        address?: string;
        did?: string;
        credentialId?: string;
        authenticatorId?: string;
        keyId?: string;
      }>,
    ) {
      state.flowType = action.payload.flowType;
      state.currentStep = null;
      state.address = action.payload.address ?? null;
      state.did = action.payload.did ?? null;
      state.credentialId = action.payload.credentialId ?? null;
      state.authenticatorId = action.payload.authenticatorId ?? null;
      state.keyId = action.payload.keyId ?? null;
      state.startedAt = Date.now();
      state.lastError = null;
    },
    advanceStep(state, action: PayloadAction<FlowStep>) {
      state.currentStep = action.payload;
      state.lastError = null;
    },
    updateFlowData(
      state,
      action: PayloadAction<{
        address?: string;
        did?: string;
        credentialId?: string;
        authenticatorId?: string;
        keyId?: string;
      }>,
    ) {
      if (action.payload.address !== undefined) state.address = action.payload.address;
      if (action.payload.did !== undefined) state.did = action.payload.did;
      if (action.payload.credentialId !== undefined) state.credentialId = action.payload.credentialId;
      if (action.payload.authenticatorId !== undefined) state.authenticatorId = action.payload.authenticatorId;
      if (action.payload.keyId !== undefined) state.keyId = action.payload.keyId;
    },
    setFlowError(state, action: PayloadAction<string>) {
      state.lastError = action.payload;
    },
    clearFlow() {
      return initialState;
    },
  },
});

export const { startFlow, advanceStep, updateFlowData, setFlowError, clearFlow } = setupFlowSlice.actions;
export default setupFlowSlice.reducer;
