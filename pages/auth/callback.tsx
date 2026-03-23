import { useEffect } from 'react';
import { useRouter } from 'next/router';

/**
 * Legacy SSO callback route — redirects to /auth/passkey which now handles
 * both the SSO callback and the passkey login flow.
 */
export default function SSOCallbackRedirect() {
  const router = useRouter();

  useEffect(() => {
    if (!router.isReady) return;
    // Preserve query params (code, state, error, etc.)
    const query = router.asPath.split('?')[1];
    router.replace(query ? `/auth/passkey?${query}` : '/auth/passkey');
  }, [router.isReady]);

  return null;
}
