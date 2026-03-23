import type { AppProps } from 'next/app';

import '@styles/globals.scss';
import '@styles/variables.scss';
import 'react-toastify/dist/ReactToastify.css';
import { ReduxProvider } from '@store/provider';
import { ThemeProvider } from '@providers/theme';
import { AuthProvider } from '@providers/auth';
import { BackgroundSetupProvider } from '@providers/backgroundSetup';
import { SetupResumeProvider } from '@providers/setupResume';
import { ToastContainer } from '@components/Toast/Toast';

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <ReduxProvider>
      <ThemeProvider>
        <AuthProvider>
          <BackgroundSetupProvider>
            <SetupResumeProvider>
              <Component {...pageProps} />
              <ToastContainer />
            </SetupResumeProvider>
          </BackgroundSetupProvider>
        </AuthProvider>
      </ThemeProvider>
    </ReduxProvider>
  );
}

export default MyApp;
