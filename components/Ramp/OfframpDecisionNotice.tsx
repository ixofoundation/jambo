import Button, { BUTTON_BG_COLOR, BUTTON_BORDER_COLOR, BUTTON_COLOR, BUTTON_SIZE } from '@components/Button/Button';
import {
  DECISION_CHECK_AGAIN_LABEL,
  type OfframpDecisionView,
  decisionCheckAgainLine,
  decisionRetryLabel,
} from 'lib/yellowcard/offrampDecision';

import styles from '@styles/Offramp.module.scss';

type OfframpDecisionNoticeProps = {
  view: OfframpDecisionView;
  /** Seconds left before a retry is worth it (`Retry-After`); 0 = now. */
  retryWaitSec?: number;
  /** Sends the same withdrawal again (pending / in review only). */
  onRetry?: () => void;
  /** E.g. while the form no longer validates. */
  retryDisabled?: boolean;
  /** An extra line, e.g. that the rewards conversion already paid out. */
  note?: string;
};

/**
 * The decision rail's answer when a withdrawal wasn't approved
 * (lib/yellowcard/offrampDecision). A refusal reads as one; "try again in a
 * moment" and "being reviewed" are calm next steps, deliberately not styled as
 * errors — nothing was sent in any of the three.
 *
 * Pending and in-review take the Withdraw button's place (like the identity
 * card): their own button sends the same withdrawal again, which resumes the
 * same decision. Never retried automatically.
 */
export default function OfframpDecisionNotice({
  view,
  retryWaitSec = 0,
  onRetry,
  retryDisabled = false,
  note,
}: OfframpDecisionNoticeProps) {
  if (view.kind === 'rejected') {
    return (
      <div className={`${styles.kycCard} ${styles.decisionRejected}`} role='alert'>
        <p className={styles.kycCardTitle}>{view.title}</p>
        {view.message && <p className={styles.kycCardText}>{view.message}</p>}
        {view.reasons.length > 0 && (
          <ul className={styles.decisionReasons}>
            {view.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        )}
        <p className={styles.kycCardText}>{view.note}</p>
        {note && <p className={styles.kycCardText}>{note}</p>}
      </div>
    );
  }

  const waiting = retryWaitSec > 0;

  return (
    <div className={styles.kycCard} role='status' aria-live='polite'>
      <p className={styles.kycCardTitle}>{view.title}</p>
      <p className={styles.kycCardText}>{view.message}</p>
      {view.kind === 'review' && <p className={styles.kycCardText}>{view.followUp}</p>}
      {note && <p className={styles.kycCardText}>{note}</p>}
      {view.kind === 'review' && waiting ? (
        <p className={styles.decisionWait}>{decisionCheckAgainLine(retryWaitSec)}</p>
      ) : (
        onRetry && (
          <div className={styles.actions}>
            <Button
              label={view.kind === 'review' ? DECISION_CHECK_AGAIN_LABEL : decisionRetryLabel(retryWaitSec)}
              size={BUTTON_SIZE.mediumLarge}
              bgColor={BUTTON_BG_COLOR.primary}
              borderColor={BUTTON_BORDER_COLOR.primary}
              color={BUTTON_COLOR.white}
              disabled={waiting || retryDisabled}
              onClick={onRetry}
            />
          </div>
        )
      )}
    </div>
  );
}
