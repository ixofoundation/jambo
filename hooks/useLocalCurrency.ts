import { useEffect, useState } from 'react';

import { getLocalCurrency, subscribeLocalCurrency, LocalCurrency } from '@utils/localCurrency';

/**
 * The session's local display currency (country-derived), or null when the
 * user has none — callers fall back to USD. Live-updates when resolution
 * completes after Vault setup.
 */
export function useLocalCurrency(): LocalCurrency | null {
  const [local, setLocal] = useState<LocalCurrency | null>(() => getLocalCurrency());
  useEffect(() => {
    setLocal(getLocalCurrency());
    return subscribeLocalCurrency(() => setLocal(getLocalCurrency()));
  }, []);
  return local;
}
