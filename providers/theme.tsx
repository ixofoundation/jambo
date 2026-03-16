import { ThemeContext } from '@contexts/theme';
import { getLocalStorage, setLocalStorage } from '@utils/persistence';
import { useState, HTMLAttributes, useEffect } from 'react';
import { Theme } from 'types/general';

export const ThemeProvider = ({ children }: HTMLAttributes<HTMLDivElement>) => {
  const [theme, setTheme] = useState<Theme>('dark');
  const [loaded, setLoaded] = useState<boolean>(false);

  const updateTheme = (newTheme: Theme) => {
    if (newTheme !== theme) setTheme(newTheme);
  };

  useEffect(() => {
    const persistedTheme = getLocalStorage('theme');
    setLoaded(true);
    if (persistedTheme) setTheme(persistedTheme as Theme);

    // Restore persisted accent color
    const accentColor = localStorage.getItem('jambo-accent-color');
    if (accentColor) {
      document.documentElement.style.setProperty('--primary-color', accentColor);
      document.documentElement.style.setProperty('--link-color', accentColor);
    }
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
