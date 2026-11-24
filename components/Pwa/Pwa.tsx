import { useEffect, useSyncExternalStore } from 'react';
import { useRouter } from 'next/router';

import { ShareIcon, SquarePlusIcon } from '@components/Icons/icons';
import { AnalyticsEvents } from 'lib/analytics/events';
import { track } from 'lib/analytics/client';
import {
  closeInstallSheet,
  dismissInstallSheet,
  getInstallState,
  getServerInstallState,
  listenForInstall,
  runInstallPrompt,
  subscribeInstall,
} from 'lib/pwa/install';
import { applyUpdate, isUpdateWaiting, startServiceWorker, subscribeUpdate } from 'lib/pwa/serviceWorker';
import styles from './Pwa.module.scss';

// Pages where nothing may pop up or reload: the sign-in steps, and the claim form.
const QUIET_ROUTES = ['/auth', '/entities/[entityId]/claimCollections/[collectionId]/[formType]'];

function useQuietRoute(): boolean {
  const { pathname } = useRouter();
  return QUIET_ROUTES.some((r) => pathname === r || pathname.startsWith(`${r}/`));
}

/** Mounted once in _app: starts the service worker and shows the update toast and install sheet. See docs/pwa.md. */
export default function Pwa() {
  useEffect(() => {
    listenForInstall();
    startServiceWorker();
  }, []);

  return (
    <>
      <UpdateToast />
      <InstallSheet />
    </>
  );
}

function UpdateToast() {
  const waiting = useSyncExternalStore(subscribeUpdate, isUpdateWaiting, () => false);
  const quiet = useQuietRoute();
  if (!waiting || quiet) return null;

  return (
    <div className={styles.update} role='status'>
      <span>A new version is ready</span>
      <button
        type='button'
        className={styles.updateButton}
        onClick={() => {
          track(AnalyticsEvents.PwaUpdateAccepted);
          applyUpdate();
        }}
      >
        Update
      </button>
    </div>
  );
}

function InstallSheet() {
  const { platform, openTrigger } = useSyncExternalStore(subscribeInstall, getInstallState, getServerInstallState);
  const quiet = useQuietRoute();
  const open = !!platform && !!openTrigger && !quiet;

  useEffect(() => {
    if (open && platform && openTrigger) track(AnalyticsEvents.PwaInstallPromptShown, { platform, trigger: openTrigger });
  }, [open, platform, openTrigger]);

  if (!open) return null;

  return (
    <>
      <button className='sheet-scrim anim-fade' aria-label='Close' onClick={dismissInstallSheet} />
      <div className='sheet sheet--in' role='dialog' aria-modal='true' aria-labelledby='pwa-install-title'>
        <div className='sheet__grip' />
        <div className={styles.head}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src='/icons/icon-192.png' alt='' className={styles.icon} />
          <div>
            <h3 id='pwa-install-title'>Put yoma on your home screen</h3>
            <p className={styles.lead}>
              {openTrigger === 'claim_submitted' ? 'Nice work on that claim. ' : ''}
              Open it in one tap, full screen, and it loads faster on a slow connection.
            </p>
          </div>
        </div>

        {platform === 'android' ? (
          <div className={styles.actions}>
            <button type='button' className='btn btn--primary btn--block' onClick={() => void runInstallPrompt()}>
              Install
            </button>
            <button type='button' className={styles.later} onClick={dismissInstallSheet}>
              Not now
            </button>
          </div>
        ) : (
          <>
            <ol className={styles.steps}>
              <li>
                <span className={styles.stepIcon}>
                  <ShareIcon size={20} />
                </span>
                <span>
                  Tap <strong>Share</strong> in the browser bar
                </span>
              </li>
              <li>
                <span className={styles.stepIcon}>
                  <SquarePlusIcon size={20} />
                </span>
                <span>
                  Choose <strong>Add to Home Screen</strong>
                </span>
              </li>
            </ol>
            <div className={styles.actions}>
              <button type='button' className='btn btn--primary btn--block' onClick={closeInstallSheet}>
                Got it
              </button>
              <button type='button' className={styles.later} onClick={dismissInstallSheet}>
                Not now
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
