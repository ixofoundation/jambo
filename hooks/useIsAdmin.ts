import { useEffect, useState } from 'react';

import { secret } from '@utils/secrets';
import { checkIsAdmin } from 'lib/yomaWorker/client';

/**
 * Checks (against the jambo worker) whether the current user is a whitelisted
 * admin. Uses the matrix access token from secure storage as the credential, so
 * it only resolves true for users the worker actually recognises as admins.
 *
 * `loading` is true until the worker has responded — guards should wait for it
 * before deciding access, and UI affordances should stay hidden until then.
 */
export default function useIsAdmin(): { isAdmin: boolean; loading: boolean } {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    // secret.accessToken reads localStorage, so it's only available client-side.
    const token = secret.accessToken;
    if (!token) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    checkIsAdmin(token)
      .then((ok) => {
        if (!cancelled) setIsAdmin(ok);
      })
      .catch(() => {
        if (!cancelled) setIsAdmin(false);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { isAdmin, loading };
}
