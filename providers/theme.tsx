import { ThemeContext } from '@contexts/theme';
import { useState, HTMLAttributes, useEffect } from 'react';
import { Theme } from 'types/general';

export const ThemeProvider = ({ children }: HTMLAttributes<HTMLDivElement>) => {
  const [theme, setTheme] = useState<Theme>('light');
  const updateTheme = (newTheme: Theme) => {
    if (newTheme !== theme) setTheme(newTheme);
  };

  useEffect(() => {
    // Restore persisted accent color
    const accentColor = localStorage.getItem('jambo-accent-color');
    if (accentColor) {
      document.documentElement.style.setProperty('--accent-color', accentColor);
      document.documentElement.style.setProperty('--blue-primary', accentColor);
    }
  }, []);

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
