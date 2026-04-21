import { useCallback, useContext, useEffect, useRef, useState } from 'react';

import { KycStatus, isTerminalFailure, isTerminalSuccess } from '@constants/kyc';
import { BackgroundSetupContext } from '@contexts/backgroundSetup';
import { useAuth } from '@hooks/useAuth';
import { useAppDispatch, useAppSelector } from '@store/hooks';
import { markCredentialSaved, setKycError, setKycStatus } from '@store/slices/kycSlice';
import { fetchKycCredential, fetchKycStatus } from '@utils/kycServer';
import { computeCredentialCid, storeMatrixCredential } from '@utils/matrixCredential';

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
  saving: boolean;
  saved: boolean;
  error?: string;
  refresh: () => Promise<void>;
  saveCredential: () => Promise<void>;
}

export function useKycStatus({ did, protocolId, address, enabled }: UseKycStatusArgs): UseKycStatusResult {
  const dispatch = useAppDispatch();
  const entry = useAppSelector((state) => (protocolId ? state.kyc.byProtocolId[protocolId] : undefined));
  const { getMatrixClient, awaitCompletion } = useContext(BackgroundSetupContext);
  const auth = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const cancelledRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const saved = !!entry?.credentialSaved;
  const statusRef = useRef<KycStatus | undefined>(entry?.status);
  useEffect(() => {
    statusRef.current = entry?.status;
  }, [entry?.status]);

  const saveCredential = useCallback(async () => {
    if (saving) return;
    if (!protocolId) throw new Error('KYC protocol id missing');
    if (!did || !address) throw new Error('User identity missing');
    if (!isTerminalSuccess(statusRef.current)) {
      throw new Error('KYC credential is not ready yet');
    }

    setSaving(true);
    setError(undefined);
    try {
      await awaitCompletion();
      const mxClient = getMatrixClient();
      if (!mxClient) throw new Error('Matrix client not ready');
      const roomId = auth.matrixRoomId;
      if (!roomId) throw new Error('User matrix room id missing');

      const credentials = await fetchKycCredential(did, protocolId);
      const entries = Object.entries(credentials);
      if (entries.length === 0) throw new Error('KYC credential payload was empty');

      for (const [credentialType, credential] of entries) {
        const cid = computeCredentialCid(credential);
        await storeMatrixCredential({
          mxClient,
          roomId,
          credentialKey: credentialType,
          credential: credential as Record<string, any>,
          cid,
        });
        dispatch(markCredentialSaved({ protocolId, credentialType }));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      dispatch(setKycError({ protocolId, message }));
      setError(message);
      throw err;
    } finally {
      setSaving(false);
    }
  }, [
    address,
    auth.matrixRoomId,
    awaitCompletion,
    did,
    dispatch,
    getMatrixClient,
    protocolId,
    saving,
  ]);

  const fetchOnce = useCallback(async (): Promise<{ reachedTerminal: boolean }> => {
    if (!did || !protocolId) return { reachedTerminal: true };
    setLoading(true);
    let reachedTerminal = false;
    try {
      const status = await fetchKycStatus(did, protocolId);
      if (cancelledRef.current) return { reachedTerminal: true };
      dispatch(setKycStatus({ protocolId, status }));
      setError(undefined);
      reachedTerminal = isTerminalSuccess(status) || isTerminalFailure(status);
    } catch (err) {
      if (!cancelledRef.current) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
      }
    } finally {
      if (!cancelledRef.current) setLoading(false);
    }
    return { reachedTerminal };
  }, [dispatch, did, protocolId]);

  const poll = useCallback(async () => {
    if (!enabled) return;
    const { reachedTerminal } = await fetchOnce();
    if (!cancelledRef.current && enabled && !reachedTerminal) {
      timerRef.current = setTimeout(poll, POLL_INTERVAL_MS);
    }
  }, [enabled, fetchOnce]);

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
    await fetchOnce();
  }, [fetchOnce]);

  return {
    status: entry?.status,
    loading,
    saving,
    saved,
    error: error ?? entry?.lastError,
    refresh,
    saveCredential,
  };
}
