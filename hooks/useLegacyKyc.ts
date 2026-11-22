import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { KYC_ENTITY_ID } from '@constants/kyc';
import { useAuth } from '@hooks/useAuth';
import { useKycStatus, type UseKycStatusResult } from '@hooks/useKycStatus';
import { useAppSelector } from '@store/hooks';
import { canLeaveLegacyKyc, showsLegacyKyc } from '@utils/kyc/legacyCheck';
import { isLegacyKycSkipped, needsLegacyKycLookup, skipLegacyKyc } from '@utils/kyc/legacyOptOut';

/**
 * The lookup is a courtesy: a slow KYC server must not hold the Self check
 * back. On a timeout the person reads as "no old check"; if the answer still
 * arrives and says otherwise, the old view takes over then.
 */
const LOOKUP_TIMEOUT_MS = 3000;

export type LegacyKyc = UseKycStatusResult & {
  /** The old path's protocol id; null = `NEXT_PUBLIC_KYC_ENTITY_ID` is blank and the old path is off. */
  protocolId: string | null;
  /** An old check was started and can still be finished (see `isLegacyKycInFlight`). */
  inFlight: boolean;
  /** Whether `inFlight` is an answer yet: false only while the one status lookup runs. */
  checked: boolean;
  /**
   * "Use the new identity check instead": the way out of an old check that is
   * stalled or abandoned. From then on `inFlight` is false for this person on
   * this device; the old check itself is left as it is. Does nothing unless
   * `canSkip`.
   */
  skip: () => void;
  /**
   * Whether that way out may be offered: not once the old credential is issued
   * or being issued (`canLeaveLegacyKyc`). An earlier `skip` is ignored then too.
   */
  canSkip: boolean;
};

/**
 * The old identity check (ixo-kyc-server), for the people still midway through
 * one: nobody can start it any more (docs/self-kyc-plan.md 4.6).
 *
 * `active` = the person is known not to be verified. Only then is the server
 * asked: once, to learn whether an old check exists, and not again within a
 * day of an answer. The status poll of `useKycStatus` runs only while one is
 * in flight, so a person with no old check costs one request, not a poll.
 */
export function useLegacyKyc(active: boolean): LegacyKyc {
  const { did, address } = useAuth();
  const protocolId = KYC_ENTITY_ID || null;
  const on = active && !!protocolId && !!did;

  // Persisted (redux-persist), so a check in flight is known before the server answers.
  const stored = useAppSelector((state) => (protocolId ? state.kyc.byProtocolId[protocolId]?.status : undefined));
  const lastPolledAt = useAppSelector((state) =>
    protocolId ? state.kyc.byProtocolId[protocolId]?.lastPolledAt : undefined,
  );
  // The person left the old check for the new one (kept per DID on this device).
  const [skippedNow, setSkippedNow] = useState<string | null>(null);
  const skipped = useMemo(() => !!did && (skippedNow === did || isLegacyKycSkipped(did)), [did, skippedNow]);
  const canSkip = canLeaveLegacyKyc(stored);
  const skip = useCallback(() => {
    if (!did || !canSkip) return;
    skipLegacyKyc(did);
    setSkippedNow(did);
  }, [did, canSkip]);
  const inFlight = on && showsLegacyKyc(stored, skipped);

  const kyc = useKycStatus({ did, protocolId, address, enabled: inFlight });
  const { refresh } = kyc;

  const [lookedUpFor, setLookedUpFor] = useState<string | null>(null);
  const lookupStartedFor = useRef<string | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!on || skipped || inFlight || !did || lookupStartedFor.current === did) return;
    lookupStartedFor.current = did;
    // The server said "no old check" recently: do not ask again on every visit.
    if (!needsLegacyKycLookup({ inFlight, lastPolledAt })) {
      setLookedUpFor(did);
      return;
    }
    const timeout = new Promise<void>((resolve) => setTimeout(resolve, LOOKUP_TIMEOUT_MS));
    // `refresh` stores the status in the slice; a failure reads as "no old check".
    void Promise.race([refresh().catch(() => undefined), timeout]).then(() => {
      if (mounted.current) setLookedUpFor(did);
    });
  }, [on, skipped, inFlight, did, lastPolledAt, refresh]);

  return {
    ...kyc,
    status: on ? kyc.status : undefined,
    protocolId,
    inFlight,
    checked: !on || skipped || inFlight || lookedUpFor === did,
    skip,
    canSkip: inFlight && canSkip,
  };
}
