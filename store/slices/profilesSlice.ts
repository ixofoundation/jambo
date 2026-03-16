import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface EntityProfile {
  name: string;
  logo?: string;
  type?: string;
}

interface ProfilesState {
  byEntityDid: Record<string, EntityProfile>;
}

const initialState: ProfilesState = {
  byEntityDid: {},
};

const profilesSlice = createSlice({
  name: 'profiles',
  initialState,
  reducers: {
    setProfile(state, action: PayloadAction<{ entityDid: string; profile: EntityProfile }>) {
      state.byEntityDid[action.payload.entityDid] = action.payload.profile;
    },
    clearProfiles() {
      return initialState;
    },
  },
});

export const { setProfile, clearProfiles } = profilesSlice.actions;
export default profilesSlice.reducer;
