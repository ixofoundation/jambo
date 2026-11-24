/**
 * Install state for the home-screen app. See docs/pwa.md.
 *
 * Android (and desktop Chrome): the browser fires `beforeinstallprompt` when
 * the app can be installed. We hold on to it and call `prompt()` from our own
 * sheet at a good moment, instead of letting Chrome show its own banner on the
 * first visit, when people just dismiss it.
 *
 * iOS: there is no install API. We show instructions (Share → Add to Home Screen).
 *
 * The "good moment" is a submitted claim (`markInstallMoment`). The sheet can
 * also be opened by hand from Profile. "Not now" hides the automatic offer
 * for DISMISS_DAYS.
 */

import { AnalyticsEvents } from 'lib/analytics/events';
import { track } from 'lib/analytics/client';
import type { PwaInstallPlatform, PwaInstallTrigger } from 'lib/analytics/events';
import { displayMode } from './displayMode';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const DISMISSED_KEY = 'jambo-pwa-install-dismissed-at';
const DISMISS_DAYS = 14;

export type InstallState = {
  /** Which kind of install this phone can do, or null (already installed, or not possible here). */
  platform: PwaInstallPlatform | null;
  /** Set when the sheet should be open, with what opened it. */
  openTrigger: PwaInstallTrigger | null;
};

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let installedThisSession = false;
let openTrigger: PwaInstallTrigger | null = null;
let snapshot: InstallState = { platform: null, openTrigger: null };
const listeners = new Set<() => void>();
let listening = false;

function isIos(): boolean {
  if (typeof navigator === 'undefined') return false;
  // iPadOS reports itself as a Mac; touch support gives it away.
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function currentPlatform(): PwaInstallPlatform | null {
  if (typeof window === 'undefined' || installedThisSession || displayMode() === 'standalone') return null;
  if (deferredPrompt) return 'android';
  if (isIos()) return 'ios';
  return null;
}

function emit() {
  snapshot = { platform: currentPlatform(), openTrigger };
  listeners.forEach((fn) => fn());
}

export function subscribeInstall(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getInstallState(): InstallState {
  return snapshot;
}

const SERVER_STATE: InstallState = { platform: null, openTrigger: null };
export function getServerInstallState(): InstallState {
  return SERVER_STATE;
}

/** Call once, as early as possible: Chrome fires `beforeinstallprompt` soon after load. */
export function listenForInstall(): void {
  if (listening || typeof window === 'undefined') return;
  listening = true;
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    emit();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    installedThisSession = true;
    openTrigger = null;
    track(AnalyticsEvents.PwaInstalled);
    emit();
  });
  emit();
}

function recentlyDismissed(): boolean {
  try {
    const at = Number(window.localStorage.getItem(DISMISSED_KEY));
    return Number.isFinite(at) && at > 0 && Date.now() - at < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

/** A good moment to offer the app happened (a claim was submitted). Does nothing if it can't or shouldn't be offered. */
export function markInstallMoment(): void {
  if (typeof window === 'undefined' || !currentPlatform() || recentlyDismissed()) return;
  openTrigger = 'claim_submitted';
  emit();
}

/** Open the sheet on request (Profile → Install the app). Ignores the "Not now" pause. */
export function openInstallSheet(): void {
  if (!currentPlatform()) return;
  openTrigger = 'profile';
  emit();
}

/** "Not now": close, and pause the automatic offer. */
export function dismissInstallSheet(): void {
  const platform = currentPlatform();
  if (openTrigger && platform) track(AnalyticsEvents.PwaInstallPromptDismissed, { platform, trigger: openTrigger });
  try {
    window.localStorage.setItem(DISMISSED_KEY, String(Date.now()));
  } catch {
    /* storage blocked: the offer may come back sooner, which is fine */
  }
  openTrigger = null;
  emit();
}

/** Close without pausing (after an install attempt, or on iOS "Got it"). */
export function closeInstallSheet(): void {
  openTrigger = null;
  emit();
}

/** Android: show the browser's own install dialog. Chrome allows each held event to be used once. */
export async function runInstallPrompt(): Promise<void> {
  const prompt = deferredPrompt;
  if (!prompt) return;
  deferredPrompt = null;
  await prompt.prompt();
  const { outcome } = await prompt.userChoice;
  track(AnalyticsEvents.PwaInstallPromptResult, { outcome });
  openTrigger = null;
  emit();
}
