import { useEffect, useState } from 'react';

import { useAppDispatch, useAppSelector } from '@store/hooks';
import { loadKycForm } from '@store/thunks/kycThunks';

export interface UseKycSupportEntityDidResult {
  entityDid: string | null;
  loading: boolean;
  error: string | null;
}

export function useKycSupportEntityDid(): UseKycSupportEntityDidResult {
  const dispatch = useAppDispatch();
  const claimCollectionId = useAppSelector((state) => state.kyc.claimCollectionId);
  const entityDid = useAppSelector((state) =>
    claimCollectionId ? (state.collections.byId[claimCollectionId]?.entity as string | undefined) ?? null : null,
  );

  const [loading, setLoading] = useState(!entityDid);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (entityDid) {
      setLoading(false);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    dispatch(loadKycForm())
      .unwrap()
      .catch((err) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [dispatch, entityDid]);

  return { entityDid, loading, error };
}
