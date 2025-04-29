import { createContext } from 'react';
import { Theme } from 'types/general';

export const ThemeContext = createContext({
  theme: 'light' as Theme,
  updateTheme: (newTheme: Theme) => {},
});
