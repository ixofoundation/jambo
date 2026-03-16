import type { AppProps } from 'next/app';

import '@styles/globals.scss';
import '@styles/variables.scss';
import 'react-toastify/dist/ReactToastify.css';
import { ReduxProvider } from '@store/provider';
import { ThemeProvider } from '@providers/theme';
import { AuthProvider } from '@providers/auth';
import { ToastContainer } from '@components/Toast/Toast';
import { DrawerProvider, PageWrapper } from '@components/Drawer/Drawer';
import AppDrawer from '@components/Drawer/AppDrawer';

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <ReduxProvider>
      <ThemeProvider>
        <AuthProvider>
          <DrawerProvider>
            <AppDrawer />
            <PageWrapper>
              <Component {...pageProps} />
              <ToastContainer />
            </PageWrapper>
          </DrawerProvider>
        </AuthProvider>
      </ThemeProvider>
    </ReduxProvider>
  );
}

export default MyApp;
