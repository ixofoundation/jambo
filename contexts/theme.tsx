import { getLocalStorage, setLocalStorage } from '@utils/persistence';
import { createContext, useState, HTMLAttributes, useEffect } from 'react';
import { Theme } from 'types/general';

export const ThemeContext = createContext({
  theme: 'light' as Theme,
  updateTheme: (newTheme: Theme) => {},
});

export const ThemeProvider = ({ children }: HTMLAttributes<HTMLDivElement>) => {
  const [theme, setTheme] = useState<Theme>('light');
  const [loaded, setLoaded] = useState<boolean>(false);

  const updateTheme = (newTheme: Theme) => {
    if (newTheme !== theme) setTheme(newTheme);
  };

  useEffect(() => {
    const persistedTheme = getLocalStorage('theme');
    setLoaded(true);
    if (persistedTheme) setTheme(persistedTheme as Theme);
  }, []);

  useEffect(() => {
    if (loaded) setLocalStorage('theme', theme);
  }, [theme]);

  const value = {
    theme,
    updateTheme,
  };

  return (
    <ThemeContext.Provider value={value}>
      <div className={theme}>
        {children}

        <div id='modal-root'></div>
        <div id='custom-root'></div>
      </div>
    </ThemeContext.Provider>
  );
};
