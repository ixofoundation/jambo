import { EMAIL_NOTIFIER_URL } from './client';

/**
 * Resolves the email-notifier worker's DID (the `audience` for every UCAN
 * delegation we mint). Memoized for the page lifetime; a failed fetch resets the
 * promise so the next call retries.
 */
let workerDidPromise: Promise<string> | null = null;

export async function getEmailNotifierWorkerDid(): Promise<string> {
  if (!workerDidPromise) {
    workerDidPromise = (async () => {
      if (!EMAIL_NOTIFIER_URL) {
        throw new Error('Email notifications are not configured (NEXT_PUBLIC_EMAIL_NOTIFIER_URL is unset).');
      }
      const res = await fetch(`${EMAIL_NOTIFIER_URL}/.well-known/did.json`);
      if (!res.ok) throw new Error(`Email notifier worker DID fetch failed: ${res.status}`);
      const data = (await res.json()) as { id?: string };
      if (!data?.id) throw new Error('Email notifier worker DID document missing `id`');
      return data.id;
    })().catch((err) => {
      workerDidPromise = null;
      throw err;
    });
  }
  return workerDidPromise;
}
