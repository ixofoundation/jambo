import type { AppProps } from 'next/app';
import { useRouter } from 'next/router';

import '@styles/globals.scss';
import '@styles/variables.scss';
import 'react-toastify/dist/ReactToastify.css';
import { ReduxProvider } from '@store/provider';
import { ThemeProvider } from '@providers/theme';
import { AuthProvider } from '@providers/auth';
import { BackgroundSetupProvider } from '@providers/backgroundSetup';
import { ToastContainer } from '@components/Toast/Toast';
import BottomNav from '@components/BottomNav/BottomNav';

// Pages where bottom nav should NOT appear
const NO_NAV_ROUTES = ['/auth', '/auth/callback', '/entities/[entityId]/claimCollections/[collectionId]/[formType]'];

function MyApp({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const showNav = !NO_NAV_ROUTES.includes(router.pathname);

  return (
    <ReduxProvider>
      <ThemeProvider>
        <AuthProvider>
          <BackgroundSetupProvider>
            <Component {...pageProps} />
            {showNav && <BottomNav />}
            <ToastContainer />
          </BackgroundSetupProvider>
        </AuthProvider>
      </ThemeProvider>
    </ReduxProvider>
  );
}

export default MyApp;
