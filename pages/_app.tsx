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
import AnalyticsConsentBanner from '@components/Analytics/AnalyticsConsentBanner';
import AnalyticsIdentitySync from '@components/Analytics/AnalyticsIdentitySync';
import { initAnalytics } from 'lib/analytics/client';

// No-op on the server, off-mainnet, and until the user has accepted the
// consent banner (accepting calls initAnalytics() again). See lib/analytics.
initAnalytics();

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <ReduxProvider>
      <ThemeProvider>
        <AuthProvider>
          <BackgroundSetupProvider>
            <YomaLinkProvider>
              <AnalyticsIdentitySync />
              <Component {...pageProps} />
              <Dock />
              <EmailNotificationPrompt />
              <AnalyticsConsentBanner />
              <ToastContainer />
            </YomaLinkProvider>
          </BackgroundSetupProvider>
        </AuthProvider>
      </ThemeProvider>
    </ReduxProvider>
  );
}

export default MyApp;
