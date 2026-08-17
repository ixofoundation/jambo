import type { AppProps } from 'next/app';

import '@styles/globals.scss';
import '@styles/variables.scss';
import 'react-toastify/dist/ReactToastify.css';
import 'maplibre-gl/dist/maplibre-gl.css';
import '../lib/here/here-map.css';
import { ReduxProvider } from '@store/provider';
import { ThemeProvider } from '@providers/theme';
import { AuthProvider } from '@providers/auth';
import { BackgroundSetupProvider } from '@providers/backgroundSetup';
import { ToastContainer } from '@components/Toast/Toast';
import EmailNotificationPrompt from '@components/EmailNotifier/EmailNotificationPrompt';

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <ReduxProvider>
      <ThemeProvider>
        <AuthProvider>
          <BackgroundSetupProvider>
            <Component {...pageProps} />
            <EmailNotificationPrompt />
            <ToastContainer />
          </BackgroundSetupProvider>
        </AuthProvider>
      </ThemeProvider>
    </ReduxProvider>
  );
}

export default MyApp;
