import { useCallback, useSyncExternalStore } from 'react';

import { grantAnalyticsConsent, isAnalyticsEnvEnabled, revokeAnalyticsConsent } from 'lib/analytics/client';
import { AnalyticsConsentState, getAnalyticsConsent, subscribeAnalyticsConsent } from 'lib/analytics/consent';

// null = stored value not read yet (SSR + hydration). Starting at "unset"
// would flash the consent banner at users who had already decided.
const getServerSnapshot = (): AnalyticsConsentState | null => null;

/**
 * Consent state shared by every subscriber in the tab: accepting the banner
 * updates the identity sync and any other consumer at once, because the
 * consent module notifies subscribers on every change.
 */
export default function useAnalyticsConsent() {
  const consent = useSyncExternalStore(subscribeAnalyticsConsent, getAnalyticsConsent, getServerSnapshot);

  const grant = useCallback(() => {
    grantAnalyticsConsent();
  }, []);

  const revoke = useCallback(() => {
    revokeAnalyticsConsent();
  }, []);

  return {
    consent,
    hasConsent: consent === 'granted',
    isUndecided: consent === 'unset',
    isAvailable: isAnalyticsEnvEnabled(),
    grant,
    revoke,
  };
}
