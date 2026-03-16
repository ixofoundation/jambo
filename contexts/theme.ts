import { createContext } from 'react';
import { Theme } from 'types/general';

export const ThemeContext = createContext({
  theme: 'dark' as Theme,
  updateTheme: (newTheme: Theme) => {},
});
