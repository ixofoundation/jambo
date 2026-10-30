import { useCallback } from 'react';
import { useRouter } from 'next/router';

import Button, { BUTTON_BG_COLOR, BUTTON_BORDER_COLOR, BUTTON_COLOR, BUTTON_SIZE } from '@components/Button/Button';
import Loader from '@components/Loader/Loader';
import { useKycSupportEntityDid } from '@hooks/useKycSupportEntityDid';
import { type UsdcUpgrade } from '@hooks/useUsdcUpgrade';
import {
  UPGRADE_LEAVE_LINE,
  UPGRADE_STEPS,
  type UpgradeAction,
  type UpgradeVariant,
  upgradeCopy,
} from 'lib/usdcUpgrade/upgradeState';

import styles from '@styles/UsdcUpgrade.module.scss';

type UsdcUpgradeCardProps = {
  upgrade: UsdcUpgrade;
  /** `notice`: the calm line under the balance (wallet + withdraw screens).
   *  `gate`: "One quick step before you withdraw", in the Withdraw button's place. */
  variant: UpgradeVariant;
  /** Gate only: back to the withdrawal form (always offered). */
  onBack?: () => void;
  /** Gate only: withdraw the USDC that is ready now — offered when `readyNow`. */
  onReadyNow?: () => void;
  readyNow?: boolean;
};

const fmtUsdc = (micro: bigint) =>
  `${(Number(micro) / 1e6).toLocaleString(undefined, { maximumFractionDigits: 6 })} USDC`;

/** "Contact support": the app's existing support chat (the KYC protocol's support room). */
function SupportButton({ primary }: { primary: boolean }) {
  const router = useRouter();
  const { entityDid, loading } = useKycSupportEntityDid();
  const onClick = useCallback(() => {
    if (entityDid) void router.push(`/profile/support/${encodeURIComponent(entityDid)}`);
  }, [entityDid, router]);
  if (!entityDid && !loading) return null;
  return (
    <Button
      label='Contact support'
      size={BUTTON_SIZE.mediumLarge}
      bgColor={primary ? BUTTON_BG_COLOR.primary : BUTTON_BG_COLOR.white}
      borderColor={primary ? BUTTON_BORDER_COLOR.primary : BUTTON_BORDER_COLOR.grey}
      color={primary ? BUTTON_COLOR.white : BUTTON_COLOR.grey}
      disabled={!entityDid}
      onClick={onClick}
    />
  );
}

/**
 * The one-tap USDC upgrade, as the customer sees it (copy:
 * lib/usdcUpgrade/upgradeState `upgradeCopy`; flow: hooks/useUsdcUpgrade).
 * Calm by design — a next step, never an error: the money is always said to be
 * safe and where it is. In the withdraw step there is always a way back.
 */
export default function UsdcUpgradeCard({ upgrade, variant, onBack, onReadyNow, readyNow }: UsdcUpgradeCardProps) {
  if (!upgrade.enabled) return null;
  const { view } = upgrade;
  const shown = !!view && !(variant === 'notice' && upgrade.hidden);
  const copy = view
    ? upgradeCopy(view, variant, {
        amount: fmtUsdc(upgrade.amountMicro),
        returned: upgrade.returnedMicro != null ? fmtUsdc(upgrade.returnedMicro) : undefined,
        feeUsed: upgrade.returnedMicro != null && upgrade.returnedMicro < upgrade.amountMicro,
        canRetry: upgrade.offerMicro > BigInt(0),
        readyNow: !!readyNow,
      })
    : null;
  // Always mounted (while the feature is on), so every change is announced — not just the first.
  const live = (
    <p className={styles.liveRegion} role='status' aria-live='polite'>
      {shown && copy ? [copy.title, copy.lines[0]].filter(Boolean).join(' ') : ''}
    </p>
  );
  if (!shown || !view || !copy) return live;

  const working = view.kind === 'preparing' || view.kind === 'in_progress' || view.kind === 'returning';

  const run = (action: UpgradeAction) => {
    switch (action) {
      case 'open':
      case 'retry':
        upgrade.open();
        break;
      case 'start':
        void upgrade.start();
        break;
      case 'dismiss':
        upgrade.dismiss();
        break;
      case 'cancel':
        upgrade.cancel();
        break;
      case 'back':
        onBack?.();
        break;
      case 'ready_now':
        onReadyNow?.();
        break;
      case 'support':
        break; // its own button
    }
  };

  // The bare notice under a balance: one line and a button, no card chrome.
  if (view.kind === 'offer' && variant === 'notice') {
    const action = copy.actions[0];
    return (
      <>
        {live}
        <div className={styles.notice}>
          <p className={styles.text}>{copy.lines[0]}</p>
          {action && (
            <button type='button' className={styles.noticeButton} onClick={() => run(action.action)}>
              {action.label}
            </button>
          )}
        </div>
      </>
    );
  }

  return (
    <>
      {live}
      <div
        className={`${styles.card}${
          copy.tone === 'good' ? ` ${styles.good}` : copy.tone === 'warn' ? ` ${styles.warn}` : ''
        }`}
      >
        {copy.step != null && (
          <ol className={styles.steps} aria-label='Upgrade progress'>
            {UPGRADE_STEPS.map((label, i) => (
              <li
                key={label}
                className={`${styles.step}${i < copy.step! || copy.step === 2 ? ` ${styles.stepDone}` : ''}${
                  i === copy.step && copy.step !== 2 ? ` ${styles.stepActive}` : ''
                }`}
                aria-current={i === copy.step ? 'step' : undefined}
              >
                <span className={styles.stepDot} />
                {label}
              </li>
            ))}
          </ol>
        )}
        {copy.title && (
          <p className={styles.title}>
            {working && <Loader size={14} />}
            {copy.title}
          </p>
        )}
        {copy.lines.map((line) => (
          <p key={line} className={styles.text}>
            {line}
          </p>
        ))}
        {copy.canLeave && <p className={styles.small}>{UPGRADE_LEAVE_LINE}</p>}
        {copy.actions.length > 0 && (
          <div className={styles.actions}>
            {copy.actions.map((a) =>
              a.action === 'support' ? (
                <SupportButton key={a.action} primary={a.primary} />
              ) : (
                <Button
                  key={a.action}
                  label={a.label}
                  size={BUTTON_SIZE.mediumLarge}
                  bgColor={a.primary ? BUTTON_BG_COLOR.primary : BUTTON_BG_COLOR.white}
                  borderColor={a.primary ? BUTTON_BORDER_COLOR.primary : BUTTON_BORDER_COLOR.grey}
                  color={a.primary ? BUTTON_COLOR.white : BUTTON_COLOR.grey}
                  onClick={() => run(a.action)}
                />
              ),
            )}
          </div>
        )}
      </div>
    </>
  );
}
