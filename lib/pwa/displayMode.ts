/**
 * How the app is open right now: 'standalone' when launched from the home
 * screen (installed), 'browser' in a normal tab. iOS Safari reports it through
 * `navigator.standalone` instead of the media query on older versions.
 */
export type DisplayMode = 'standalone' | 'browser';

export function displayMode(): DisplayMode {
  if (typeof window === 'undefined') return 'browser';
  const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches;
  return iosStandalone || standalone ? 'standalone' : 'browser';
}
