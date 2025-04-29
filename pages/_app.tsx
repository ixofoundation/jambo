import type { AppProps } from 'next/app';

import '@styles/globals.scss';
import '@styles/variables.scss';
import { ThemeProvider } from '@providers/theme';

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <ThemeProvider>
      <Component {...pageProps} />
    </ThemeProvider>
  );
}

export default MyApp;
