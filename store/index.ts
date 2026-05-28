import { configureStore, combineReducers } from '@reduxjs/toolkit';
import {
  persistStore,
  persistReducer,
  createMigrate,
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
} from 'redux-persist';
import storage from 'redux-persist/lib/storage';

import accountReducer from './slices/accountSlice';
import entitiesReducer from './slices/entitiesSlice';
import collectionsReducer from './slices/collectionsSlice';
import protocolsReducer from './slices/protocolsSlice';
import profilesReducer from './slices/profilesSlice';
import matrixProfileReducer from './slices/matrixProfileSlice';
import matrixProfilesReducer from './slices/matrixProfilesSlice';
import claimDraftsReducer from './slices/claimDraftsSlice';
import projectsReducer from './slices/projectsSlice';
import kycReducer from './slices/kycSlice';
import subclaimsReducer from './slices/subclaimsSlice';
import { KycStatus } from '@constants/kyc';

const rootReducer = combineReducers({
  account: accountReducer,
  entities: entitiesReducer,
  collections: collectionsReducer,
  protocols: protocolsReducer,
  profiles: profilesReducer,
  matrixProfile: matrixProfileReducer,
  matrixProfiles: matrixProfilesReducer,
  claimDrafts: claimDraftsReducer,
  projects: projectsReducer,
  kyc: kycReducer,
  subclaims: subclaimsReducer,
});

// v3: the save flow now persists the credential-data (PII) payload to matrix in
// addition to the verifiable credential. Users carrying a `credentialSaved: true`
// flag or a `Complete` status from v2 need to re-trigger the save once so the
// PII record lands in their data store. Clear the flag and demote Complete →
// Issued so the KYC card re-renders the "Save Credential" button.
const migrations: Record<number, (state: any) => any> = {
  3: (state: any) => {
    if (!state?.kyc?.byProtocolId) return state;
    const byProtocolId = { ...state.kyc.byProtocolId };
    for (const protocolId of Object.keys(byProtocolId)) {
      const entry = byProtocolId[protocolId];
      if (!entry) continue;
      byProtocolId[protocolId] = {
        ...entry,
        credentialSaved: false,
        status: entry.status === KycStatus.Complete ? KycStatus.Issued : entry.status,
      };
    }
    return { ...state, kyc: { ...state.kyc, byProtocolId } };
  },
};

const persistConfig = {
  key: 'jambo-cache',
  version: 3,
  storage,
  whitelist: ['account', 'entities', 'collections', 'protocols', 'profiles', 'matrixProfile', 'claimDrafts', 'projects', 'kyc'],
  migrate: createMigrate(migrations, { debug: false }),
};

const persistedReducer = persistReducer(persistConfig, rootReducer);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }),
});

export const persistor = persistStore(store);

export type RootState = ReturnType<typeof rootReducer>;
export type AppDispatch = typeof store.dispatch;
