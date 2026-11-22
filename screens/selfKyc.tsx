import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/router';

import Header from '@components/Header/Header';
import { ArrowUpRightIcon, ClockIcon, FileCheckIcon, ShieldCheckIcon } from '@components/Icons/icons';
import Loader from '@components/Loader/Loader';
import authConstants from '@constants/auth';
import { SELF_KYC_ENABLED } from '@constants/self';
import { AUTH_HUB_URL } from 'lib/authHub/config';
import { useAuth } from '@hooks/useAuth';
import { useKyc } from '@hooks/useKyc';
import { useLegacyKyc } from '@hooks/useLegacyKyc';
import { findSelfCredential } from '@utils/kyc/hubCredentials';
import {
  SELF_ACTIVE_ELSEWHERE_COPY,
  SELF_COULD_NOT_CHECK_COPY,
  SELF_LIMIT_TITLE,
  SELF_NOT_IN_WALLET_COPY,
  SELF_POLL_SLOW_INTERVAL_MS,
  SELF_REVERIFY_COPY,
  SELF_STRANDED_COPY,
  canRetrySelfCheck,
  isSelfCheckOver,
  isSelfLinkOpenable,
  selfCheckCopy,
  selfCheckPhase,
  selfCheckPollDelayMs,
  selfLinkErrorMessage,
  selfProgressView,
  selfStatusErrorAction,
  type SelfCheckPhase,
} from '@utils/self/checkView';
import { createSelfLink, getSelfLinkStatus } from '@utils/self/client';
import { clearPendingSelfLink, loadPendingSelfLink } from '@utils/self/pendingLink';
import { secureLoad } from '@utils/storage';
import type { SelfLinkErrorCode, SelfLinkStatus, SelfLinkStatusResult } from 'types/kyc';

/**
 * The Self identity check (docs/self-kyc-plan.md 4.3): asks for a single-use
 * link, opens it in a new tab, and follows the check from here until the
 * credential is in the person's Auth Hub wallet.
 *
 * The link URL is a bearer secret (whoever opens it first does the check). It
 * is held in a ref for as long as this screen is mounted and the link is
 * valid, and nowhere else: not in state, Redux, storage, the route, a log or
 * an analytics event. This screen sends no analytics at all.
 */

const PROFILE_ROUTE = '/profile';
/** A focus or tab switch polls at once, but never closer together than this. */
const MIN_POLL_GAP_MS = 3_000;
/** After a check passes the Hub may need a moment before it lists the credential. Bounded: about 90 seconds. */
const FINISH_RETRY_DELAYS_MS = [0, 3_000, 5_000, 8_000, 15_000, 30_000, 30_000];
/** Self says "already verified", or the person taps "Check again": the credential is there or it is not. */
const FINISH_RECHECK_DELAYS_MS = [0, 3_000];

type Ended = { phase: 'failed' | 'expired' | 'cancelled' } & Pick<SelfLinkStatus, 'failure' | 'startsLeft'>;
type Notice = { message: string; code: SelfLinkErrorCode | null };
type ViewKind =
  | 'signed_out'
  | 'verified'
  | 'finishing'
  | 'not_in_wallet'
  | 'could_not_check'
  | 'loading'
  | 'legacy'
  | 'not_available'
  | 'progress'
  | 'ended'
  | 'starting'
  | 'elsewhere'
  | 'unavailable'
  | 'start';

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const tabHidden = () => typeof document !== 'undefined' && document.visibilityState === 'hidden';

/**
 * Opens the new tab inside the click, before the link exists: Safari only
 * allows a new tab during the user gesture. No 'noopener' here, because then
 * `window.open` answers null and the tab could not be sent to the link.
 */
function openBlankTab(): Window | null {
  try {
    const tab = window.open('about:blank', '_blank');
    if (!tab) return null;
    try {
      // Shown for the second or two before the link arrives.
      tab.document.title = 'Identity check';
      const line = tab.document.createElement('p');
      line.textContent = 'Preparing your identity check…';
      line.style.cssText = 'font-family: system-ui, sans-serif; padding: 24px; margin: 0;';
      tab.document.body.appendChild(line);
    } catch {
      // Cosmetic only.
    }
    return tab;
  } catch {
    return null;
  }
}

/** Sends the pre-opened tab to the link, cutting its tie to this page. False = no usable tab. */
function sendTabTo(tab: Window | null, url: string): boolean {
  try {
    if (!tab || tab.closed) return false;
    tab.opener = null;
    tab.location.replace(url);
    return true;
  } catch {
    return false;
  }
}

/** The person's credentials in their Auth Hub wallet (the Hub web app's `/credentials` page). */
function openHubWallet() {
  window.open(`${AUTH_HUB_URL.replace(/\/+$/, '')}/credentials`, '_blank', 'noopener,noreferrer');
}

function closeTab(tab: Window | null) {
  try {
    tab?.close();
  } catch {
    // Already gone.
  }
}

export default function SelfKycScreen() {
  const router = useRouter();
  const { did, address, onSign, logout } = useAuth();
  const kyc = useKyc();
  const legacy = useLegacyKyc(kyc.status !== 'checking' && !kyc.verified);
  /** The Self credential arrived for a person who came to verify again (see `reverify`). */
  const [reverified, setReverified] = useState(false);
  // A ramp sends a person here with `?reverify=1` when their earlier (legacy)
  // verification was refused: offer the Self check instead of "you're verified".
  // Never for a person verified with Self: Self would only answer "already verified".
  const reverify = router.query.reverify === '1' && kyc.status === 'legacy' && !reverified;
  /** Nothing more to do here. */
  const verified = kyc.verified && !reverify;

  /** The link being followed (its id only). */
  const [linkId, setLinkId] = useState<string | null>(null);
  const [phase, setPhase] = useState<SelfCheckPhase | null>(null);
  const [ended, setEnded] = useState<Ended | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [activeElsewhere, setActiveElsewhere] = useState(false);
  const [popupBlocked, setPopupBlocked] = useState(false);
  const [pollTrouble, setPollTrouble] = useState(false);
  /** `slow`: the Hub answered and lists no credential. `unreachable`: it could not be asked. */
  const [finishing, setFinishing] = useState<'no' | 'working' | 'slow' | 'unreachable'>('no');
  const [retryingKyc, setRetryingKyc] = useState(false);
  /** When the link held in `linkUrlRef` stops being usable (the URL itself never enters state). */
  const [reopenUntil, setReopenUntil] = useState<string | null>(null);
  /** Self will not start the check on the open link: the person's tries are used up for now. */
  const [limit, setLimit] = useState<SelfLinkStatus['limit'] | null>(null);

  // The bearer link: memory only, dropped on expiry, on any final state and on unmount.
  const linkUrlRef = useRef<{ url: string; expiresAt: string } | null>(null);
  const mounted = useRef(true);
  const kycRef = useRef(kyc);
  kycRef.current = kyc;
  const verifiedRef = useRef(verified);
  verifiedRef.current = verified;
  const reverifyRef = useRef(reverify);
  reverifyRef.current = reverify;

  const dropLinkUrl = useCallback(() => {
    linkUrlRef.current = null;
    setReopenUntil(null);
    setPopupBlocked(false);
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      linkUrlRef.current = null;
    };
  }, []);

  // Forget the link the moment it can no longer be used.
  useEffect(() => {
    if (!reopenUntil) return;
    const msLeft = Date.parse(reopenUntil) - Date.now() - 15_000;
    const timer = setTimeout(dropLinkUrl, Math.max(0, msLeft));
    return () => clearTimeout(timer);
  }, [reopenUntil, dropLinkUrl]);

  // A check started earlier on this device (only its id is remembered).
  useEffect(() => {
    if (!did) return;
    setLinkId(loadPendingSelfLink(did)?.linkId ?? null);
  }, [did]);

  /**
   * The check passed (or Self says the person is already verified): re-read
   * the shared state until the Hub lists the credential. A bounded number of
   * tries; after that the "not in your wallet yet" state takes over, or
   * "couldn't check" when the Hub could not be asked at all.
   */
  const finish = useCallback(
    async (delays: number[] = FINISH_RETRY_DELAYS_MS) => {
      setFinishing('working');
      /** The last try could not reach the Hub (or the Vault), so "no credential" is not an answer. */
      let unreachable = false;
      for (const delay of delays) {
        if (delay) await sleep(delay);
        if (!mounted.current || verifiedRef.current) return;
        if (reverifyRef.current && did) {
          // The shared state stays `legacy` for this person, so ask the Hub directly.
          unreachable = false;
          const held = await findSelfCredential(did, { force: true }).then(Boolean, () => {
            unreachable = true;
            return false;
          });
          if (!mounted.current) return;
          if (held) {
            clearPendingSelfLink(did);
            setReverified(true);
            return;
          }
        } else {
          await kycRef.current.refresh();
        }
      }
      // Let the last answer reach the ref before deciding it was too slow.
      await sleep(100);
      if (!mounted.current || verifiedRef.current) return;
      if (!reverifyRef.current) {
        // `unavailable` says so itself; a remembered check reads `pending` even
        // when the Hub is down, so ask once more whether it answers at all.
        unreachable =
          kycRef.current.status === 'unavailable' ||
          (!!did &&
            (await findSelfCredential(did).then(
              () => false,
              () => true,
            )));
        if (!mounted.current || verifiedRef.current) return;
      }
      setFinishing(unreachable ? 'unreachable' : 'slow');
    },
    [did],
  );

  // What one status answer means. Kept in a ref so the poller below never restarts on a re-render.
  const onStatusRef = useRef<(result: SelfLinkStatusResult, askedLinkId: string) => number | null>(() => null);
  onStatusRef.current = (result, askedLinkId) => {
    if (!did) return null;
    if (result.outcome === 'status') {
      const next = selfCheckPhase(result);
      setPollTrouble(false);
      if (!isSelfCheckOver(next)) {
        setPhase(next);
        setLimit(result.limit ?? null);
        // Once a person is reviewing it, or it is being saved, the link has done its job.
        if (next === 'review' || next === 'saving') dropLinkUrl();
        return selfCheckPollDelayMs(next);
      }
      // A passed check stays remembered until the Hub lists its credential
      // (`useKyc` forgets it then), so the profile keeps showing it as in
      // progress and a revisit comes back to "finishing" instead of the start.
      // Only the link this answer is about is forgotten: a newer one may have replaced it.
      if (next !== 'passed' && loadPendingSelfLink(did)?.linkId === result.linkId) clearPendingSelfLink(did);
      dropLinkUrl();
      setLinkId(null);
      setPhase(null);
      setLimit(null);
      if (next === 'passed') void finish();
      else setEnded({ phase: next as Ended['phase'], failure: result.failure, startsLeft: result.startsLeft });
      return null;
    }
    const action = selfStatusErrorAction(result.code);
    if (action === 'retry') {
      setPollTrouble(true);
      return SELF_POLL_SLOW_INTERVAL_MS;
    }
    if (action === 'reset') {
      // Self does not know this link (any more): back to the start. Only the
      // link that was asked about is forgotten: a newer one may have replaced it.
      if (loadPendingSelfLink(did)?.linkId === askedLinkId) clearPendingSelfLink(did);
    } else {
      // Signed out or not configured: the check itself is untouched, so it stays remembered.
      setNotice({
        message: selfLinkErrorMessage({ code: result.code as SelfLinkErrorCode, message: result.message }),
        code: result.code as SelfLinkErrorCode,
      });
    }
    dropLinkUrl();
    setLinkId(null);
    setPhase(null);
    setLimit(null);
    setPollTrouble(false);
    return null;
  };

  const canPoll = !!did && !!linkId && SELF_KYC_ENABLED && kyc.status !== 'checking' && !verified && !legacy.inFlight;

  // Follows the open check: one request at a time, paused while the tab is
  // hidden, and at once when the person comes back (hooks/useUsdcUpgrade pattern).
  useEffect(() => {
    if (!canPoll || !did || !linkId) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let inFlight = false;
    let waitingForVisible = false;
    let lastCallAt = 0;

    const schedule = (delayMs: number) => {
      if (stopped) return;
      timer = setTimeout(() => {
        timer = null;
        if (tabHidden()) {
          waitingForVisible = true;
          return;
        }
        void tick();
      }, delayMs);
    };

    const tick = async () => {
      if (stopped || inFlight) return;
      inFlight = true;
      lastCallAt = Date.now();
      const result = await getSelfLinkStatus({ userDid: did, linkId });
      inFlight = false;
      if (stopped) return;
      const nextDelay = onStatusRef.current(result, linkId);
      if (nextDelay !== null) schedule(nextDelay);
    };

    // Back from the check's tab: look now instead of waiting out the timer.
    const onReturn = () => {
      if (stopped || inFlight || tabHidden()) return;
      if (!waitingForVisible && !timer) return;
      const sinceLast = Date.now() - lastCallAt;
      if (timer) clearTimeout(timer);
      timer = null;
      waitingForVisible = false;
      if (sinceLast >= MIN_POLL_GAP_MS) void tick();
      else schedule(MIN_POLL_GAP_MS - sinceLast);
    };

    document.addEventListener('visibilitychange', onReturn);
    window.addEventListener('focus', onReturn);
    if (tabHidden()) waitingForVisible = true;
    else void tick();

    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener('visibilitychange', onReturn);
      window.removeEventListener('focus', onReturn);
    };
  }, [canPoll, did, linkId]);

  const start = useCallback(() => {
    if (busy || !did || !address) return;
    setNotice(null);
    setEnded(null);
    setActiveElsewhere(false);
    dropLinkUrl();
    // Stop following a link this start replaces ("Start a new check" on a
    // check whose link can't be reopened): its "expired" answer must not undo the new one.
    setLinkId(null);
    setPhase(null);
    setLimit(null);
    // Without the signing key nothing can be signed: say so before opening a tab.
    let hasSigningKey = false;
    try {
      hasSigningKey = !!secureLoad(authConstants.secretKey.ED_SIGNING_MNEMONIC);
    } catch {
      hasSigningKey = false;
    }
    if (!hasSigningKey) {
      setNotice({ message: selfLinkErrorMessage({ code: 'unauthorized', message: '' }), code: 'unauthorized' });
      return;
    }

    // Synchronously, inside the click (see openBlankTab). `createSelfLink` may
    // first register the person's signing key on chain; that is signed with the
    // session key and asks nothing of the person (this page only shows
    // "Confirming…" meanwhile), so the new tab taking the focus is harmless.
    const tab = openBlankTab();
    setBusy(true);
    void (async () => {
      const result = await createSelfLink({ userDid: did, address, onSign }).catch(
        () => ({ outcome: 'error', code: 'unknown', message: '' } as const),
      );
      if (!mounted.current) {
        // Left the screen: the link is not kept, and the empty tab is not left
        // behind. Nobody can open that link now, so it is not remembered either
        // (it would only show as a check that can't be continued).
        closeTab(tab);
        if (result.outcome === 'created' && loadPendingSelfLink(did)?.linkId === result.linkId) {
          clearPendingSelfLink(did);
        }
        return;
      }
      if (result.outcome !== 'created') closeTab(tab);
      setBusy(false);

      switch (result.outcome) {
        case 'created': {
          linkUrlRef.current = { url: result.url, expiresAt: result.expiresAt };
          setReopenUntil(result.expiresAt);
          // A blocked pop-up leaves the link one tap away ("Open the check" below).
          setPopupBlocked(!sendTabTo(tab, result.url));
          setPhase('waiting');
          setLinkId(result.linkId);
          return;
        }
        case 'already_verified':
          void finish(FINISH_RECHECK_DELAYS_MS);
          return;
        case 'link_active':
          // The client has already remembered the link id when Self named it.
          if (result.linkId) setLinkId(result.linkId);
          else setActiveElsewhere(true);
          return;
        default:
          setNotice({ message: selfLinkErrorMessage(result), code: result.code });
      }
    })();
  }, [address, busy, did, dropLinkUrl, finish, onSign]);

  /** A fresh tap, so a new tab is allowed; if the browser still refuses one, use this tab. */
  const openHeldLink = useCallback(() => {
    const held = linkUrlRef.current;
    if (!held || !isSelfLinkOpenable(held.expiresAt)) {
      dropLinkUrl();
      return;
    }
    setPopupBlocked(false);
    let tab: Window | null = null;
    try {
      tab = window.open('about:blank', '_blank');
    } catch {
      tab = null;
    }
    if (!sendTabTo(tab, held.url)) window.location.href = held.url;
  }, [dropLinkUrl]);

  const retryKyc = useCallback(() => {
    setRetryingKyc(true);
    void kycRef.current.refresh().finally(() => {
      if (mounted.current) setRetryingKyc(false);
    });
  }, []);

  const goToProfile = useCallback(() => {
    void router.push(PROFILE_ROUTE);
  }, [router]);

  const signInAgain = useCallback(() => {
    // Comes back to this page after signing in.
    void logout({ preserveReturnTo: true });
  }, [logout]);

  const view: ViewKind = !did
    ? 'signed_out'
    : verified
    ? 'verified'
    : finishing === 'slow'
    ? 'not_in_wallet'
    : finishing === 'unreachable'
    ? 'could_not_check'
    : finishing !== 'no'
    ? 'finishing'
    : kyc.status === 'checking' || !legacy.checked
    ? 'loading'
    : legacy.inFlight
    ? 'legacy'
    : !SELF_KYC_ENABLED || notice?.code === 'not_configured'
    ? 'not_available'
    : busy
    ? 'starting'
    : linkId
    ? 'progress'
    : ended
    ? 'ended'
    : activeElsewhere
    ? 'elsewhere'
    : kyc.status === 'unavailable'
    ? 'unavailable'
    : 'start';

  // When a tap replaces the button that was tapped, keep the keyboard / screen
  // reader position on the new state instead of dropping it to the page top.
  const headingRef = useRef<HTMLHeadingElement>(null);
  const lastView = useRef<ViewKind>(view);
  useEffect(() => {
    if (lastView.current === view) return;
    lastView.current = view;
    const active = document.activeElement;
    if (!active || active === document.body) headingRef.current?.focus();
  }, [view]);

  const canReopen = !!reopenUntil && (phase === 'waiting' || phase === 'in_progress');
  const progressCopy = phase ? selfCheckCopy(phase) : null;
  const endedCopy = ended ? selfCheckCopy(ended.phase, ended) : null;

  let title = '';
  let text = '';
  let working = false;
  let tone: 'plain' | 'good' = 'plain';
  let actions: ReactNode = null;

  const backToProfile = (primary: boolean) => (
    <button type='button' className={`btn btn--block ${primary ? 'btn--primary' : 'btn--ghost'}`} onClick={goToProfile}>
      Back to profile
    </button>
  );

  switch (view) {
    case 'signed_out':
      title = 'Sign in first';
      text = 'Please sign in to verify your identity.';
      break;
    case 'loading':
      title = 'Checking your verification…';
      working = true;
      break;
    case 'verified':
      title = 'You’re verified';
      text = 'Your identity is verified. There is nothing more to do.';
      tone = 'good';
      actions = backToProfile(true);
      break;
    case 'finishing':
      title = 'Almost done';
      text = 'Saving your credential.';
      working = true;
      break;
    case 'not_in_wallet':
      // Self has checked this person, but the wallet lists no credential (not
      // saved yet, or removed). Self would refuse a new check, so none is offered.
      title = SELF_NOT_IN_WALLET_COPY.title;
      text = SELF_NOT_IN_WALLET_COPY.text;
      actions = (
        <>
          <button type='button' className='btn btn--primary btn--block' onClick={openHubWallet}>
            Open my wallet
          </button>
          <button
            type='button'
            className='btn btn--ghost btn--block'
            onClick={() => void finish(FINISH_RECHECK_DELAYS_MS)}
          >
            Check again
          </button>
          {backToProfile(false)}
        </>
      );
      break;
    case 'could_not_check':
      // The check passed (or Self says "already verified"), but the Hub can't
      // be asked right now: the wallet is not the problem, so it is not named.
      title = SELF_COULD_NOT_CHECK_COPY.title;
      text = SELF_COULD_NOT_CHECK_COPY.text;
      actions = (
        <>
          <button
            type='button'
            className='btn btn--primary btn--block'
            onClick={() => void finish(FINISH_RECHECK_DELAYS_MS)}
          >
            Check again
          </button>
          {backToProfile(false)}
        </>
      );
      break;
    case 'legacy':
      title = 'You already have a check in progress';
      text =
        SELF_KYC_ENABLED && legacy.canSkip
          ? 'You started an identity check earlier. Finish it from the Identity Credential card on your profile, or use the new identity check instead. Your earlier check will be left as it is.'
          : 'You started an identity check earlier. Finish it from the Identity Credential card on your profile.';
      actions = (
        <>
          {backToProfile(true)}
          {SELF_KYC_ENABLED && legacy.canSkip && (
            <button type='button' className='btn btn--ghost btn--block' onClick={legacy.skip}>
              Use the new identity check instead
            </button>
          )}
        </>
      );
      break;
    case 'not_available':
      title = 'Not available right now';
      text = 'Identity verification is not available right now. Please try again later.';
      actions = backToProfile(false);
      break;
    case 'unavailable':
      title = SELF_COULD_NOT_CHECK_COPY.title;
      text = SELF_COULD_NOT_CHECK_COPY.text;
      actions = (
        <button type='button' className='btn btn--primary btn--block' onClick={retryKyc} disabled={retryingKyc}>
          {retryingKyc ? 'Checking…' : 'Try again'}
        </button>
      );
      break;
    case 'starting':
      title = 'Preparing your check…';
      text = 'This takes a few seconds.';
      working = true;
      break;
    case 'progress': {
      const progress = selfProgressView({ phase, holdsLink: !!reopenUntil, popupBlocked, limited: !!limit });
      title = progressCopy?.title ?? 'Check in progress';
      text = progressCopy?.text ?? 'Looking up where your check stands…';
      working = true;
      if (progress === 'popup_blocked') {
        text = 'Your browser didn’t open the new tab. Tap “Open the check” to continue.';
        working = false;
      } else if (progress === 'limit') {
        title = SELF_LIMIT_TITLE;
        text = selfLinkErrorMessage({ code: 'daily_limit', message: '', resetsAt: limit?.resetsAt });
        working = false;
      } else if (progress === 'stranded') {
        title = SELF_STRANDED_COPY.title;
        text = SELF_STRANDED_COPY.text;
        working = false;
      }
      actions = (
        <>
          {canReopen && progress !== 'limit' && (
            <button
              type='button'
              className={`btn btn--block ${progress === 'popup_blocked' ? 'btn--primary' : 'btn--ghost'}`}
              onClick={openHeldLink}
            >
              {progress === 'popup_blocked' ? 'Open the check' : 'Open the check again'}
            </button>
          )}
          {progress === 'stranded' && (
            <button type='button' className='btn btn--primary btn--block' onClick={start} disabled={!address}>
              Start a new check
            </button>
          )}
          {backToProfile(false)}
        </>
      );
      break;
    }
    case 'ended':
      title = endedCopy?.title ?? '';
      text = endedCopy?.text ?? '';
      actions = (
        <>
          {(ended?.phase !== 'failed' || canRetrySelfCheck(ended.startsLeft)) && (
            <button type='button' className='btn btn--primary btn--block' onClick={start}>
              {ended?.phase === 'failed' ? 'Try again' : 'Start a new check'}
            </button>
          )}
          {backToProfile(false)}
        </>
      );
      break;
    case 'elsewhere':
      title = SELF_ACTIVE_ELSEWHERE_COPY.title;
      text = SELF_ACTIVE_ELSEWHERE_COPY.text;
      actions = (
        <>
          <button type='button' className='btn btn--primary btn--block' onClick={start}>
            Try again
          </button>
          {backToProfile(false)}
        </>
      );
      break;
    case 'start':
      title = reverify ? SELF_REVERIFY_COPY.title : 'Verify your identity';
      text = reverify
        ? SELF_REVERIFY_COPY.text
        : 'Some features need a verified identity. You only need to do this once.';
      actions = (
        <>
          <button type='button' className='btn btn--primary btn--block' onClick={start} disabled={!address}>
            Start check
          </button>
          {/* Arriving here from a ramp is not a decision to verify again: offer the way out. */}
          {reverify && backToProfile(false)}
        </>
      );
      break;
  }

  const showNotice = !!notice && (view === 'start' || view === 'ended' || view === 'elsewhere');

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <Header onGradient title='Identity check' onBack={goToProfile} />

      <main
        style={{
          width: '100%',
          maxWidth: 'var(--max-width)',
          margin: '0 auto',
          padding: '0 20px var(--dock-clearance)',
          paddingTop: 'calc(var(--header-height) + 4px)',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          flex: 1,
        }}
      >
        <div className='card' style={{ padding: 20 }}>
          {/* Always mounted, so every change of state is announced. */}
          <div role='status' aria-live='polite'>
            <h1
              ref={headingRef}
              tabIndex={-1}
              className='h2'
              style={{
                margin: 0,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                outline: 'none',
                color: tone === 'good' ? 'var(--green-primary)' : undefined,
              }}
            >
              {working && <Loader size={18} />}
              {tone === 'good' && <ShieldCheckIcon size={22} />}
              <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{title}</span>
            </h1>
            {text && (
              <p className='muted' style={{ margin: '8px 0 0', fontSize: 14.5, lineHeight: 1.5 }}>
                {text}
              </p>
            )}
            {view === 'progress' && pollTrouble && (
              <p className='muted' style={{ margin: '8px 0 0', fontSize: 14.5, lineHeight: 1.5 }}>
                We can’t check the progress right now. We’ll keep trying.
              </p>
            )}
          </div>

          {view === 'start' && (
            <div style={{ marginTop: 8 }}>
              <div className='trust-block'>
                <span className='trust-block__icon'>
                  <ArrowUpRightIcon size={20} />
                </span>
                <div>
                  <div className='trust-block__t'>Opens in a new tab</div>
                  <div className='trust-block__s'>You do the check on a separate page. No sign-in is needed there.</div>
                </div>
              </div>
              <div className='trust-block'>
                <span className='trust-block__icon'>
                  <FileCheckIcon size={20} />
                </span>
                <div>
                  <div className='trust-block__t'>Your ID document and a selfie</div>
                  <div className='trust-block__s'>You take a photo of your ID document, then a photo of your face.</div>
                </div>
              </div>
              <div className='trust-block'>
                <span className='trust-block__icon'>
                  <ClockIcon size={20} />
                </span>
                <div>
                  <div className='trust-block__t'>Takes a few minutes</div>
                  <div className='trust-block__s'>When you finish, come back to this page. It updates by itself.</div>
                </div>
              </div>
            </div>
          )}

          {showNotice && notice && (
            <p
              role='alert'
              style={{ margin: '14px 0 0', fontSize: 14.5, lineHeight: 1.5, color: 'var(--error-color)' }}
            >
              {notice.message}
            </p>
          )}

          {(actions || (showNotice && notice?.code === 'unauthorized')) && (
            <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {showNotice && notice?.code === 'unauthorized' ? (
                <button type='button' className='btn btn--primary btn--block' onClick={signInAgain}>
                  Sign in again
                </button>
              ) : (
                actions
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
