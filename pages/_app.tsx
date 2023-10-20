import type { AppProps } from 'next/app';
import 'react-toastify/dist/ReactToastify.css';

import '@styles/globals.scss';
import '@styles/variables.scss';
import { ToastContainer } from '@components/Toast/Toast';
import { WalletProvider } from '@contexts/wallet';
import { ChainProvider } from '@contexts/chain';
import { ThemeProvider } from '@contexts/theme';
import GovProvider from '@contexts/gov';

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <ThemeProvider>
      <ChainProvider>
        <WalletProvider>
          <GovProvider>
            <ToastContainer />
            <Component {...pageProps} />
          </GovProvider>
        </WalletProvider>
      </ChainProvider>
    </ThemeProvider>
  );
}

export default MyApp;
