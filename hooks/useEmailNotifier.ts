import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';

import { useAuth } from '@hooks/useAuth';
import { useAppDispatch } from '@store/hooks';
import { setEmailSubscription } from '@store/slices/emailSubscriptionSlice';
import { mintDelegation } from '@utils/ucanDelegation';
import {
  buildCapabilities,
  fetchEvents,
  unsubscribe as unsubscribeRequest,
  updatePreferences,
  EMAIL_NOTIFIER_URL,
  type EmailNotifierEvent,
  type Subscription,
} from 'lib/emailNotifier/client';
import { getEmailNotifierWorkerDid } from 'lib/emailNotifier/workerDid';
import { readSubscriptionStatus, subscribeLinkedEmail } from 'lib/emailNotifier/subscribe';

const MANAGE_TTL_SECONDS = 60;

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) {
    // Both sentinels mean the Ed25519 signing key on this device isn't the one
    // the chain has registered. The fix is to re-link from auth-hub.
    if (
      err.message.includes('signing_mnemonic_missing_from_matrix') ||
      err.message.includes('signing_mnemonic_mismatch_with_chain')
    ) {
      return "Your signing key on this device doesn't match the one registered on chain. Sign out and log back in to restore it, then try again.";
    }
    return err.message;
  }
  return fallback;
}

export default function useEmailNotifier(enabled: boolean) {
  const { address, did, onSign } = useAuth();
  const dispatch = useAppDispatch();
  const configured = !!EMAIL_NOTIFIER_URL;

  const [events, setEvents] = useState<EmailNotifierEvent[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusChecked, setStatusChecked] = useState(false);
  const [mutating, setMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The auth-gated subscription check must run AT MOST ONCE per address per
  // mount — without this guard the effect re-fires on every render after the
  // call completes (loading flips back to false) and loops if the worker keeps
  // returning a non-2xx.
  const statusAttemptedFor = useRef<string | null>(null);

  const showError = useCallback((title: string, message: string) => {
    toast.error(`${title}: ${message}`);
  }, []);

  // Set local state AND mirror into the global redux flag so the rest of the app
  // (e.g. the activation prompt) sees subscription changes made here.
  const applySubscription = useCallback(
    (sub: Subscription | null) => {
      setSubscription(sub);
      dispatch(setEmailSubscription({ subscribed: sub?.status === 'active', status: sub?.status ?? null }));
    },
    [dispatch],
  );

  const loadEvents = useCallback(async () => {
    setEventsLoading(true);
    try {
      const eventList = await fetchEvents();
      setEvents(eventList);
    } catch (err) {
      setError(errorMessage(err, 'Failed to load email notification events'));
    } finally {
      setEventsLoading(false);
    }
  }, []);

  const checkSubscription = useCallback(async () => {
    if (!address || !did) return;
    setStatusLoading(true);
    try {
      const sub = await readSubscriptionStatus({ did, address });
      applySubscription(sub);
    } catch (err) {
      // 401/403/404 are already mapped to null by getSubscription. Anything else
      // surfaces a toast — deeper auth issues reappear with a clearer error
      // during the subscribe attempt.
      showError('Email notifications', errorMessage(err, 'Could not check subscription status'));
    } finally {
      setStatusLoading(false);
      statusAttemptedFor.current = address;
      setStatusChecked(true);
    }
  }, [address, did, applySubscription, showError]);

  useEffect(() => {
    if (enabled && configured && events.length === 0 && !eventsLoading) {
      loadEvents();
    }
  }, [enabled, configured, events.length, eventsLoading, loadEvents]);

  useEffect(() => {
    if (!enabled || !configured || !address) return;
    if (statusAttemptedFor.current === address) return;
    if (statusLoading) return;
    checkSubscription();
  }, [enabled, configured, address, statusLoading, checkSubscription]);

  const refreshStatus = useCallback(async () => {
    if (!address || !did) return;
    const sub = await readSubscriptionStatus({ did, address });
    applySubscription(sub);
    setStatusChecked(true);
    statusAttemptedFor.current = address;
  }, [address, did, applySubscription]);

  const subscribe = useCallback(async () => {
    if (!address || !did) return;
    setMutating(true);
    try {
      await subscribeLinkedEmail({ did, address, onSign });
      await refreshStatus();
    } catch (err) {
      showError('Subscribe failed', errorMessage(err, 'Could not subscribe to email notifications'));
      throw err;
    } finally {
      setMutating(false);
    }
  }, [address, did, onSign, refreshStatus, showError]);

  const setPreference = useCallback(
    async (eventType: string, nextEnabled: boolean) => {
      if (!address || !did || !subscription) return;

      const previous = subscription.preferences;
      const optimistic = previous.map((p) => (p.event_type === eventType ? { ...p, enabled: nextEnabled } : p));
      setSubscription({ ...subscription, preferences: optimistic });
      setMutating(true);

      try {
        const audience = await getEmailNotifierWorkerDid();
        const delegation = await mintDelegation({
          userDid: did,
          audience,
          capabilities: buildCapabilities('notifier/preferences', address),
          ttlSeconds: MANAGE_TTL_SECONDS,
        });
        const { preferences } = await updatePreferences(delegation, [{ event_type: eventType, enabled: nextEnabled }]);
        setSubscription((prev) => (prev ? { ...prev, preferences } : prev));
      } catch (err) {
        setSubscription((prev) => (prev ? { ...prev, preferences: previous } : prev));
        showError('Preference update failed', errorMessage(err, 'Could not update preference'));
      } finally {
        setMutating(false);
      }
    },
    [address, did, subscription, showError],
  );

  const unsubscribe = useCallback(async () => {
    if (!address || !did) return;
    setMutating(true);
    try {
      const audience = await getEmailNotifierWorkerDid();
      const delegation = await mintDelegation({
        userDid: did,
        audience,
        capabilities: buildCapabilities('notifier/unsubscribe', address),
        ttlSeconds: MANAGE_TTL_SECONDS,
      });
      await unsubscribeRequest(delegation);
      applySubscription(null);
    } catch (err) {
      showError('Unsubscribe failed', errorMessage(err, 'Could not unsubscribe'));
      throw err;
    } finally {
      setMutating(false);
    }
  }, [address, did, applySubscription, showError]);

  const refresh = useCallback(() => {
    statusAttemptedFor.current = null;
    setStatusChecked(false);
    setError(null);
  }, []);

  return {
    configured,
    events,
    subscription,
    loading: eventsLoading || statusLoading,
    statusChecked,
    mutating,
    error,
    refresh,
    subscribe,
    setPreference,
    unsubscribe,
  };
}
