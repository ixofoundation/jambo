import { useCallback, useEffect, useRef, useState } from 'react';

import { KycStatus, isTerminalSuccess } from '@constants/kyc';
import { useAppDispatch, useAppSelector } from '@store/hooks';
import { markCredentialSaved, setKycError, setKycStatus } from '@store/slices/kycSlice';
import { fetchKycCredential, fetchKycStatus } from '@utils/kycServer';
import { saveCredentialToMatrix } from '@utils/matrixState';
import { secret } from '@utils/secrets';

const POLL_INTERVAL_MS = 15_000;

export interface UseKycStatusArgs {
  did: string | null | undefined;
  protocolId: string | null | undefined;
  address: string | null | undefined;
  enabled: boolean;
}

export interface UseKycStatusResult {
  status?: KycStatus;
  loading: boolean;
  error?: string;
  refresh: () => Promise<void>;
}

export function useKycStatus({ did, protocolId, address, enabled }: UseKycStatusArgs): UseKycStatusResult {
  const dispatch = useAppDispatch();
  const entry = useAppSelector((state) => (protocolId ? state.kyc.byProtocolId[protocolId] : undefined));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const cancelledRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingRef = useRef(false);

  const savedRef = useRef(!!entry?.credentialSaved);
  useEffect(() => {
    savedRef.current = !!entry?.credentialSaved;
  }, [entry?.credentialSaved]);

  const maybeSaveCredential = useCallback(
    async (status: KycStatus) => {
      if (!isTerminalSuccess(status)) return;
      if (savedRef.current || savingRef.current) return;
      if (!did || !protocolId || !address) return;

      const accessToken = secret.accessToken as string | null;
      const homeServerUrl = secret.baseUrl as string | null;
      if (!accessToken || !homeServerUrl) return;

      savingRef.current = true;
      try {
        const credentials = await fetchKycCredential(did, protocolId);
        const entries = Object.entries(credentials);
        if (entries.length === 0) throw new Error('KYC credential payload was empty');

        for (const [credentialType, credential] of entries) {
          await saveCredentialToMatrix({
            address,
            did,
            accessToken,
            homeServerUrl,
            credentialType,
            credential,
          });
        }
        dispatch(markCredentialSaved({ protocolId, credentialType: entries[0][0] }));
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        dispatch(setKycError({ protocolId, message }));
        setError(message);
      } finally {
        savingRef.current = false;
      }
    },
    [address, did, dispatch, protocolId],
  );

  const poll = useCallback(async () => {
    if (!enabled || !did || !protocolId) return;
    setLoading(true);
    try {
      const status = await fetchKycStatus(did, protocolId);
      if (cancelledRef.current) return;
      dispatch(setKycStatus({ protocolId, status }));
      setError(undefined);

      if (isTerminalSuccess(status) && !savedRef.current) {
        await maybeSaveCredential(status);
      }

      if (savedRef.current) return;
    } catch (err) {
      if (cancelledRef.current) return;
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      if (!cancelledRef.current) setLoading(false);
    }

    if (!cancelledRef.current && enabled) {
      timerRef.current = setTimeout(poll, POLL_INTERVAL_MS);
    }
  }, [dispatch, did, enabled, maybeSaveCredential, protocolId]);

  useEffect(() => {
    cancelledRef.current = false;
    if (!enabled || !did || !protocolId) return;
    poll();
    return () => {
      cancelledRef.current = true;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [enabled, did, protocolId, poll]);

  const refresh = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    await poll();
  }, [poll]);

  return {
    status: entry?.status,
    loading,
    error: error ?? entry?.lastError,
    refresh,
  };
}
