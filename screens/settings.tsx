import { useContext, useState, useEffect } from 'react';

import Header from '@components/Header/Header';
import { ThemeContext } from '@contexts/theme';
import { Theme } from 'types/general';

const THEME_OPTIONS: { value: Theme; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

const ACCENT_COLORS = [
  { value: '#34d399', label: 'Green' },
  { value: '#3b82f6', label: 'Blue' },
  { value: '#8b5cf6', label: 'Purple' },
  { value: '#f43f5e', label: 'Rose' },
  { value: '#f59e0b', label: 'Amber' },
  { value: '#06b6d4', label: 'Cyan' },
];

const DEFAULT_ACCENT = '#34d399';

export default function SettingsScreen() {
  const { theme, updateTheme } = useContext(ThemeContext);
  const [accentColor, setAccentColor] = useState(DEFAULT_ACCENT);

  useEffect(() => {
    const stored = localStorage.getItem('jambo-accent-color');
    if (stored) setAccentColor(stored);
  }, []);

  function handleAccentChange(color: string) {
    document.documentElement.style.setProperty('--primary-color', color);
    document.documentElement.style.setProperty('--link-color', color);
    localStorage.setItem('jambo-accent-color', color);
    setAccentColor(color);
  }

  return (
    <>
      <Header />
      <main
        style={{
          maxWidth: 'var(--max-width)',
          margin: '0 auto',
          padding: '16px',
          paddingTop: 'calc(var(--header-height) + 20px)',
          minHeight: '100vh',
        }}
      >
        {/* Appearance */}
        <section style={{ marginBottom: '32px' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '13px', fontWeight: 600, color: 'var(--muted-font-color)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Appearance
          </h3>

          {/* Theme toggle */}
          <div style={{ marginBottom: '24px' }}>
            <p style={{ margin: '0 0 10px', fontSize: '14px', color: 'var(--main-font-color)' }}>Theme</p>
            <div style={{ display: 'flex', gap: '8px' }}>
              {THEME_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => updateTheme(opt.value)}
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: '10px',
                    border: theme === opt.value ? '2px solid var(--primary-color)' : '1px solid var(--border-color)',
                    backgroundColor: theme === opt.value ? 'var(--card-bg-color)' : 'transparent',
                    cursor: 'pointer',
                    fontSize: '14px',
                    color: 'var(--main-font-color)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                  }}
                >
                  {opt.value === 'light' ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="5" />
                      <line x1="12" y1="1" x2="12" y2="3" />
                      <line x1="12" y1="21" x2="12" y2="23" />
                      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                      <line x1="1" y1="12" x2="3" y2="12" />
                      <line x1="21" y1="12" x2="23" y2="12" />
                      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                    </svg>
                  )}
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Accent color */}
          <div>
            <p style={{ margin: '0 0 10px', fontSize: '14px', color: 'var(--main-font-color)' }}>Accent Color</p>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {ACCENT_COLORS.map((c) => {
                const isActive = accentColor === c.value;
                return (
                  <button
                    key={c.value}
                    onClick={() => handleAccentChange(c.value)}
                    title={c.label}
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      border: isActive ? '3px solid var(--main-font-color)' : '2px solid var(--border-color)',
                      backgroundColor: c.value,
                      cursor: 'pointer',
                      padding: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'border-color 0.15s ease, transform 0.15s ease',
                      transform: isActive ? 'scale(1.1)' : 'scale(1)',
                    }}
                  >
                    {isActive && (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
