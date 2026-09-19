import { useEffect } from 'react';

import { useAuth } from '@hooks/useAuth';
import useAnalyticsConsent from '@hooks/useAnalyticsConsent';
import { buildUserTraits, identify } from 'lib/analytics/client';

/**
 * Keeps the PostHog person in step with the auth session. Mounted once in
 * `_app`, inside AuthProvider. Re-identifies whenever the signed-in DID or its
 * traits change, and — because consent is a subscribed store — the moment a
 * signed-in user accepts the banner.
 *
 * Logout does NOT reset here: `AuthProvider.clearAllState` calls
 * `resetAnalytics()` explicitly, so an anonymous boot never churns a fresh
 * anonymous id.
 */
export default function AnalyticsIdentitySync() {
  const { hasConsent } = useAnalyticsConsent();
  const { did, address, displayName, matrixUserId } = useAuth();

  useEffect(() => {
    if (!hasConsent || !did) return;
    identify(did, buildUserTraits({ did, address, displayName, matrixUserId }));
  }, [hasConsent, did, address, displayName, matrixUserId]);

  return null;
}
