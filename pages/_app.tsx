import type { AppProps } from 'next/app';
import 'react-toastify/dist/ReactToastify.css';

import '@styles/globals.scss';
import '@styles/variables.scss';
import { ToastContainer } from '@components/Toast/Toast';
import { WalletProvider } from '@contexts/wallet';
import { ChainProvider } from '@contexts/chain';
import { ThemeProvider } from '@contexts/theme';
import { ExtractProvider } from '@contexts/extract';

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <ThemeProvider>
      <ChainProvider>
        <WalletProvider>
          <ExtractProvider>
            <ToastContainer />
            <Component {...pageProps} />
          </ExtractProvider>
        </WalletProvider>
      </ChainProvider>
    </ThemeProvider>
  );
}

export default MyApp;
