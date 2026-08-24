import { useEffect, useState } from 'react';

import { useBackgroundSetup } from '@hooks/useBackgroundSetup';
import { isDeckPrefsHydrated, subscribeDeckPrefs } from '@utils/deckPrefs';

/**
 * Session-level Vault gate shared by the deck and the dock.
 *
 * - `pending`: the Vault (Matrix) is still being opened — hold Vault-backed UI
 *   (deck contents, dock pill) so users never see state that hydration is
 *   about to replace.
 * - `failed`: setup errored, or never started within a grace window (sessions
 *   without Matrix credentials stay 'idle' forever) — stop holding and let the
 *   caller offer the log-out / continue-without choice.
 * - `hydrated`: hydration settled successfully at least once this session.
 */
export function useVaultGate(): { pending: boolean; failed: boolean; hydrated: boolean } {
  const { status } = useBackgroundSetup();
  const [hydrated, setHydrated] = useState(false);
  const [idleGraceOver, setIdleGraceOver] = useState(false);

  useEffect(() => {
    const sync = () => setHydrated(isDeckPrefsHydrated());
    sync();
    return subscribeDeckPrefs(sync);
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => setIdleGraceOver(true), 8000);
    return () => window.clearTimeout(t);
  }, []);

  const failed = !hydrated && (status === 'error' || (status === 'idle' && idleGraceOver));
  const pending = !hydrated && !failed;
  return { pending, failed, hydrated };
}
