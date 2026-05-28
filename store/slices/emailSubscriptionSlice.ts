import { createSlice, PayloadAction } from '@reduxjs/toolkit';

import type { SubscriptionStatus } from 'lib/emailNotifier/client';

/**
 * Global email-notification subscription flag. Deliberately NOT persisted (not in
 * the redux-persist whitelist) so it resets each app load — the status is
 * re-verified against the notifier worker on login, and the "prompt once per
 * session" gate lives in sessionStorage (see EmailNotificationPrompt).
 */
interface EmailSubscriptionState {
  checked: boolean; // a status check has completed this app load
  subscribed: boolean; // the global flag
  status: SubscriptionStatus | null;
}

const initialState: EmailSubscriptionState = {
  checked: false,
  subscribed: false,
  status: null,
};

const emailSubscriptionSlice = createSlice({
  name: 'emailSubscription',
  initialState,
  reducers: {
    setEmailSubscription(state, action: PayloadAction<{ subscribed: boolean; status: SubscriptionStatus | null }>) {
      state.checked = true;
      state.subscribed = action.payload.subscribed;
      state.status = action.payload.status;
    },
    resetEmailSubscription() {
      return initialState;
    },
  },
});

export const { setEmailSubscription, resetEmailSubscription } = emailSubscriptionSlice.actions;
export default emailSubscriptionSlice.reducer;
