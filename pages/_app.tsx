import type { AppProps } from 'next/app';
import 'react-toastify/dist/ReactToastify.css';

import '@styles/globals.scss';
import '@styles/variables.scss';
import { ToastContainer } from '@components/Toast/Toast';
import { WalletProvider } from '@contexts/wallet';
import { ChainProvider } from '@contexts/chain';
import { ThemeProvider } from '@contexts/theme';

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <ThemeProvider>
      <ChainProvider>
        <WalletProvider>
          <ToastContainer />
          <Component {...pageProps} />
        </WalletProvider>
      </ChainProvider>
    </ThemeProvider>
  );
}

export default MyApp;
