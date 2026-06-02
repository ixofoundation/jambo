import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface ProjectsState {
  ids: string[];
}

const initialState: ProjectsState = {
  ids: [],
};

const projectsSlice = createSlice({
  name: 'projects',
  initialState,
  reducers: {
    addProject(state, action: PayloadAction<string>) {
      if (!state.ids.includes(action.payload)) {
        state.ids.push(action.payload);
      }
    },
    setProjects(state, action: PayloadAction<string[]>) {
      state.ids = action.payload;
    },
    clearProjects() {
      return initialState;
    },
  },
});

export const { addProject, setProjects, clearProjects } = projectsSlice.actions;
export default projectsSlice.reducer;
