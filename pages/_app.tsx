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
import { YomaLinkProvider } from '@providers/yomaLink';
import { ToastContainer } from '@components/Toast/Toast';
import EmailNotificationPrompt from '@components/EmailNotifier/EmailNotificationPrompt';
import Dock from '@components/Dock/Dock';

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <ReduxProvider>
      <ThemeProvider>
        <AuthProvider>
          <BackgroundSetupProvider>
            <YomaLinkProvider>
              <Component {...pageProps} />
              <Dock />
              <EmailNotificationPrompt />
              <ToastContainer />
            </YomaLinkProvider>
          </BackgroundSetupProvider>
        </AuthProvider>
      </ThemeProvider>
    </ReduxProvider>
  );
}

export default MyApp;
