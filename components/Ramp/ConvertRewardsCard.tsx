import { useMemo, useState } from 'react';
import { useRouter } from 'next/router';

import Button, { BUTTON_BG_COLOR, BUTTON_BORDER_COLOR, BUTTON_COLOR, BUTTON_SIZE } from '@components/Button/Button';
import Loader from '@components/Loader/Loader';
import { formatRewardsUsd } from '@constants/cleanup';
import { fromPayBase, toPayBase } from '@constants/payConvert';
import type usePayConvert from '@hooks/usePayConvert';

import styles from '@styles/Offramp.module.scss';

/** The per-conversion cap the oracle enforces (1,000 units); mirrored here so the input can say so kindly. */
const MAX_CONVERT = 1000;

const STAGE_COPY: Record<string, string> = {
  preparing: 'Getting things ready…',
  authorizing: 'Authorizing your conversion…',
  signing: 'Confirm the conversion to continue.',
  confirming: 'Converting your rewards — this usually takes under a minute.',
};

interface Props {
  /** Whole PAY the user holds. */
  payBalance: number;
  /** Whether the user also holds USDC — decides what "done" leads to. */
  hasUsdc: boolean;
  convert: ReturnType<typeof usePayConvert>;
  /** Called once a conversion has landed, so the screen re-reads balances. */
  onConverted: () => void;
}

/**
 * The Withdraw screen's step for World Cleanup Day rewards: PAY becomes USDC
 * in one signed transaction (the PAY goes to the conversion deed, a claim for
 * the same amount of USDC is filed, the oracle pays it out). Copy is customer
 * facing throughout — what happens, what it costs the user (nothing), and what
 * to do if it takes a while.
 */
export default function ConvertRewardsCard({ payBalance, hasUsdc, convert, onConverted }: Props) {
  const router = useRouter();
  const cap = Math.min(payBalance, MAX_CONVERT);
  const [amount, setAmount] = useState<string>(() => cap.toFixed(2).replace(/\.00$/, ''));
  const [rechecking, setRechecking] = useState(false);

  const amountNum = parseFloat(amount);
  const amountValid = Number.isFinite(amountNum) && amountNum > 0 && amountNum <= cap + 1e-9;
  const amountBase = useMemo(() => (amountValid ? toPayBase(amountNum) : null), [amountValid, amountNum]);
  const busy = convert.stage !== 'idle' && convert.stage !== 'done' && convert.stage !== 'error';

  const start = async () => {
    if (!amountBase) return;
    try {
      const result = await convert.convert(amountBase);
      if (result.settled) onConverted();
    } catch {
      // The hook already holds the friendly message.
    }
  };

  const recheck = async () => {
    setRechecking(true);
    try {
      if (await convert.recheck()) onConverted();
    } finally {
      setRechecking(false);
    }
  };

  if (convert.stage === 'done' && convert.result) {
    const converted = fromPayBase(convert.result.txHash ? amountBase ?? '0' : '0');
    return (
      <div className={styles.card}>
        {convert.result.settled ? (
          <>
            <p className={styles.cardTitle}>Done — {formatRewardsUsd(converted)} is now USDC</p>
            <p className={styles.kycGateText}>
              Your Cleanup rewards were converted. The USDC is in your wallet and ready to withdraw to your bank or
              mobile money.
            </p>
            <div className={styles.actions}>
              <Button
                label={hasUsdc ? 'Continue' : 'Withdraw now'}
                size={BUTTON_SIZE.mediumLarge}
                bgColor={BUTTON_BG_COLOR.primary}
                borderColor={BUTTON_BORDER_COLOR.primary}
                color={BUTTON_COLOR.white}
                onClick={() => {
                  convert.reset();
                  onConverted();
                }}
              />
            </div>
          </>
        ) : (
          <>
            <p className={styles.cardTitle}>Your rewards are on their way</p>
            <p className={styles.kycGateText}>
              The conversion is in progress and usually lands within a few minutes. Your USDC will appear in your
              wallet automatically — nothing more to do on your side.
            </p>
            <div className={styles.actions}>
              <Button
                label={rechecking ? 'Checking…' : 'Check again'}
                size={BUTTON_SIZE.mediumLarge}
                bgColor={BUTTON_BG_COLOR.primary}
                borderColor={BUTTON_BORDER_COLOR.primary}
                color={BUTTON_COLOR.white}
                disabled={rechecking}
                onClick={() => void recheck()}
              />
              <Button
                label='Back to wallet'
                size={BUTTON_SIZE.mediumLarge}
                bgColor={BUTTON_BG_COLOR.grey}
                borderColor={BUTTON_BORDER_COLOR.grey}
                color={BUTTON_COLOR.primary}
                onClick={() => router.push('/wallet')}
              />
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <p className={styles.cardTitle}>Convert your Cleanup rewards to USDC</p>
      <p className={styles.kycGateText}>
        Great work at World Cleanup Day! You have {formatRewardsUsd(payBalance)} in Cleanup rewards. Convert them to
        USDC to withdraw to your bank or mobile money — one confirmation, no fees from Yoma, and it usually takes under
        a minute.
      </p>

      {busy ? (
        <div className={styles.balanceRow} style={{ marginTop: 12 }}>
          <Loader size={16} />
          <span className={styles.balanceUnit}>{STAGE_COPY[convert.stage] ?? 'Working…'}</span>
        </div>
      ) : (
        <>
          <div className={styles.field} style={{ marginTop: 12 }}>
            <label className={styles.label} htmlFor='convert-amount'>
              Amount to convert (USD)
            </label>
            <input
              id='convert-amount'
              className={`${styles.input} ${amount && !amountValid ? styles.inputError : ''}`}
              type='number'
              inputMode='decimal'
              min={0}
              step='0.01'
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                if (convert.stage === 'error') convert.reset();
              }}
            />
            {amount && !amountValid && (
              <p className={styles.hint}>
                {amountNum > cap
                  ? payBalance > MAX_CONVERT
                    ? `You can convert up to ${formatRewardsUsd(MAX_CONVERT)} at a time.`
                    : `You have ${formatRewardsUsd(payBalance)} in rewards to convert.`
                  : 'Enter an amount above zero.'}
              </p>
            )}
          </div>

          {convert.stage === 'error' && convert.error && <div className={styles.alertError}>{convert.error}</div>}

          <div className={styles.actions}>
            <Button
              label={amountValid ? `Convert ${formatRewardsUsd(amountNum)} to USDC` : 'Convert to USDC'}
              size={BUTTON_SIZE.mediumLarge}
              bgColor={BUTTON_BG_COLOR.primary}
              borderColor={BUTTON_BORDER_COLOR.primary}
              color={BUTTON_COLOR.white}
              disabled={!amountValid}
              onClick={() => void start()}
            />
          </div>
        </>
      )}
    </div>
  );
}
