import { configureStore, combineReducers } from '@reduxjs/toolkit';
import { persistStore, persistReducer, FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER } from 'redux-persist';
import storage from 'redux-persist/lib/storage';

import accountReducer from './slices/accountSlice';
import entitiesReducer from './slices/entitiesSlice';
import collectionsReducer from './slices/collectionsSlice';
import protocolsReducer from './slices/protocolsSlice';
import profilesReducer from './slices/profilesSlice';
import matrixProfileReducer from './slices/matrixProfileSlice';
import claimDraftsReducer from './slices/claimDraftsSlice';
import ssoReducer from './slices/ssoSlice';
import projectsReducer from './slices/projectsSlice';

const rootReducer = combineReducers({
  account: accountReducer,
  entities: entitiesReducer,
  collections: collectionsReducer,
  protocols: protocolsReducer,
  profiles: profilesReducer,
  matrixProfile: matrixProfileReducer,
  claimDrafts: claimDraftsReducer,
  sso: ssoReducer,
  projects: projectsReducer,
});

const persistConfig = {
  key: 'jambo-cache',
  version: 1,
  storage,
  whitelist: ['account', 'entities', 'collections', 'protocols', 'profiles', 'matrixProfile', 'claimDrafts', 'sso', 'projects'],
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
