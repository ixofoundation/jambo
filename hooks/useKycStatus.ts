import { useCallback, useContext, useEffect, useRef, useState } from 'react';

import { KycStatus, isReadyToSave, isTerminalFailure, isTerminalSuccess } from '@constants/kyc';
import { BackgroundSetupContext } from '@contexts/backgroundSetup';
import { useAuth } from '@hooks/useAuth';
import { useAppDispatch, useAppSelector } from '@store/hooks';
import { markCredentialSaved, setKycError, setKycStatus } from '@store/slices/kycSlice';
import { fetchKycCredential, fetchKycPii, fetchKycStatus, updateKycStatus } from '@utils/kycServer';
import {
  computeCredentialCid,
  storeMatrixCredential,
  storeMatrixPii,
  waitForCredentialIndexEntry,
  waitForPiiIndexEntry,
} from '@utils/matrixCredential';

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
  const { getMatrixClient, awaitCompletion, ensureEncryptionReady } = useContext(BackgroundSetupContext);
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
    if (!isReadyToSave(statusRef.current) && !isTerminalSuccess(statusRef.current)) {
      throw new Error('KYC credential is not ready yet');
    }

    setSaving(true);
    setError(undefined);
    try {
      await awaitCompletion();
      // Ensure E2EE / cross-signing / key backup are properly set up before writing
      // credentials into the user's room. Triggers the PIN-gated repair flow if needed.
      await ensureEncryptionReady();
      const mxClient = getMatrixClient();
      if (!mxClient) throw new Error('Matrix client not ready');
      const roomId = auth.matrixRoomId;
      if (!roomId) throw new Error('User matrix room id missing');

      // Fetch the verifiable credential AND the raw credential-data (PII) payload in
      // parallel — they hit different KYC server endpoints and are independent.
      const [credentials, pii] = await Promise.all([
        fetchKycCredential(did, protocolId),
        fetchKycPii(did, protocolId),
      ]);
      const entries = Object.entries(credentials);
      if (entries.length === 0) throw new Error('KYC credential payload was empty');

      // Stash the first credential's event id / cid so the PII index entry can join
      // back to the verifiable credential it was issued from.
      const credentialJoinRef: { eventId?: string; cid?: string } = {};

      for (const [credentialType, credential] of entries) {
        const cid = computeCredentialCid(credential);
        const { eventId } = await storeMatrixCredential({
          mxClient,
          roomId,
          credentialKey: credentialType,
          credential: credential as Record<string, any>,
          cid,
        });

        // Re-query the room state to confirm the index event was echoed back through
        // sync with the new eventId before treating the save as final.
        const verified = await waitForCredentialIndexEntry({
          mxClient,
          roomId,
          credentialKey: credentialType,
          cid,
          eventId,
        });
        if (!verified) {
          throw new Error(`Credential ${credentialType} was sent but did not appear in room state`);
        }

        dispatch(markCredentialSaved({ protocolId, credentialType }));
        if (!credentialJoinRef.eventId) {
          credentialJoinRef.eventId = eventId;
          credentialJoinRef.cid = cid;
        }
      }

      // Save the raw credential-data (PII) payload alongside the verifiable credential.
      // Wrapped so a failure surfaces as a clear, credential-data-focused error message
      // without confusing the user with "PII" jargon. Re-throws to roll into the outer
      // catch so the server-side status is NOT promoted to Complete until both records
      // are in matrix.
      try {
        const piiResult = await storeMatrixPii({
          mxClient,
          roomId,
          protocolId,
          pii,
          credentialEventId: credentialJoinRef.eventId,
          credentialCid: credentialJoinRef.cid,
        });
        const piiVerified = await waitForPiiIndexEntry({
          mxClient,
          roomId,
          protocolId,
          cid: piiResult.cid,
          eventId: piiResult.eventId,
        });
        if (!piiVerified) {
          throw new Error('Credential data was sent but did not appear in your Data Store');
        }
      } catch (err) {
        const cause = err instanceof Error ? err.message : String(err);
        throw new Error(`Could not save your credential data to your Data Store: ${cause}`);
      }

      // Credential + credential-data both verified in state — promote the KYC status
      // to Complete.
      try {
        await updateKycStatus(did, protocolId, KycStatus.Complete);
        dispatch(setKycStatus({ protocolId, status: KycStatus.Complete }));
      } catch (err) {
        console.warn('updateKycStatus(complete) failed:', err);
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
    ensureEncryptionReady,
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
