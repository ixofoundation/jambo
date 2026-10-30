import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/router';

import { useAuth } from '@hooks/useAuth';
import { useLocalCurrency } from '@hooks/useLocalCurrency';
import useUsdcUpgrade from '@hooks/useUsdcUpgrade';
import { CLEANUP_REWARDS_HOLD, cleanupRewardsWithdrawWhen, formatRewardsUsd } from '@constants/cleanup';
import { PAY_CONVERT_ENABLED } from '@constants/payConvert';
import { type UsdcBalances, fromMicro, getWalletBalances } from '@utils/usdcBalance';
import { formatCurrency } from '@utils/localCurrency';
import Header from '@components/Header/Header';
import UsdcUpgradeCard from '@components/Ramp/UsdcUpgradeCard';
import {
  ArrowDownLeftIcon,
  ArrowUpRightIcon,
  BanknoteIcon,
  CheckIcon,
  CopyIcon,
  LandmarkIcon,
} from '@components/Icons/icons';

const fmtUsd = (v: number) => `$ ${v.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Same compact identifier format as the profile DID: first 4 … last 4. */
const shortAddress = (a: string) => (a.length > 11 ? `${a.slice(0, 4)}…${a.slice(-4)}` : a);

/**
 * Wallet: the user's real money. USDC balance on chain — ONE amount, the
 * withdrawable USDC plus any legacy USDC (constants/usdc), with a calm one-tap
 * upgrade notice while legacy USDC is held — deposit via the
 * on-ramp, withdraw to mobile money / bank via the off-ramp (YellowCard).
 * World Cleanup Day rewards (PAY, 1 PAY = 1 USDC) count in the total but are
 * held until conversion ships — see constants/cleanup.
 */
export default function Wallet() {
  const router = useRouter();
  const { address } = useAuth();
  const local = useLocalCurrency();
  // The last GOOD read: a failed read is unknown, never zero — it keeps these and says so.
  const [usdcBalances, setUsdcBalances] = useState<UsdcBalances | null>(null);
  const [rewards, setRewards] = useState<number | null>(null);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const [copied, setCopied] = useState(false);
  // Bumped when an upgrade settles (or on "Try again"), so the balances are re-read.
  const [refresh, setRefresh] = useState(0);
  const onUpgradeSettled = useCallback(() => setRefresh((n) => n + 1), []);
  const upgrade = useUsdcUpgrade({ balances: usdcBalances, onSettled: onUpgradeSettled });

  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    void getWalletBalances(address).then((b) => {
      if (cancelled) return;
      setRefreshFailed(!b.complete);
      if (!b.complete) return;
      setUsdcBalances(b.usdc);
      setRewards(b.pay.amount);
    });
    return () => {
      cancelled = true;
    };
  }, [address, refresh]);

  // The ONE USDC amount: withdrawable + legacy, plus an upgrade on its way back to the wallet.
  const balance = usdcBalances === null ? null : fromMicro(usdcBalances.totalMicro + upgrade.inTransitMicro);

  const hasRewards = (rewards ?? 0) > 0;
  // Held rewards: in the total, but not "available to withdraw" yet.
  const heldRewards = CLEANUP_REWARDS_HOLD && hasRewards;
  // Convertible rewards: one step on Withdraw turns them into USDC.
  const convertibleRewards = PAY_CONVERT_ENABLED && hasRewards;
  const total = balance === null ? null : balance + (rewards ?? 0);
  const rewardsWhen = cleanupRewardsWithdrawWhen();
  const fmtMoney = (v: number) => (local ? formatCurrency(v * local.rate, local.currency) : fmtUsd(v));

  // Inline green-check feedback (same grammar as the profile's copy button) —
  // no toast for a micro-action this local.
  const copyAddress = async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard blocked — the full address stays visible for long-press
    }
  };

  return (
    <div style={{ position: 'relative', minHeight: '100dvh' }}>
      <Header />
      <main
        style={{
          position: 'relative',
          zIndex: 1,
          maxWidth: 'var(--max-width)',
          margin: '0 auto',
          padding: '0 20px var(--dock-clearance)',
          paddingTop: 'calc(var(--header-height) + 4px)',
        }}
      >
        <div className='section-header' style={{ marginTop: 4, marginBottom: 12 }}>
          <h2>Wallet</h2>
        </div>

        <div className='card' style={{ padding: '20px 18px 18px' }}>
          <div className='muted' style={{ fontSize: 14, fontWeight: 600 }}>
            Total balance
          </div>
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 42,
              fontWeight: 800,
              letterSpacing: '-0.02em',
              margin: '2px 0',
            }}
          >
            {total === null ? '· · ·' : fmtMoney(total)}
          </div>
          <div className='muted' style={{ fontSize: 14 }}>
            {heldRewards
              ? `Available to withdraw now · ${balance === null ? '…' : fmtUsd(balance)} USDC`
              : convertibleRewards
              ? `Available to withdraw · ${total === null ? '…' : fmtUsd(total)} including rewards`
              : local
              ? `Available to withdraw · ≈ of ${balance === null ? '…' : fmtUsd(balance)} USDC`
              : 'Available to withdraw · USD'}
          </div>
          {heldRewards && (
            <div className='muted' style={{ fontSize: 13.5, marginTop: 4 }}>
              Includes {formatRewardsUsd(rewards ?? 0)} in Cleanup rewards, withdrawable {rewardsWhen.when}.
            </div>
          )}
          {convertibleRewards && (
            <div className='muted' style={{ fontSize: 13.5, marginTop: 4 }}>
              Includes {formatRewardsUsd(rewards ?? 0)} in Cleanup rewards — they count towards what you can withdraw.
            </div>
          )}
          {refreshFailed && (
            <div className='muted' style={{ fontSize: 13.5, marginTop: 4 }}>
              {balance === null
                ? 'We couldn’t load your balance just now.'
                : 'We couldn’t refresh your balance just now.'}{' '}
              <button
                type='button'
                onClick={() => setRefresh((n) => n + 1)}
                style={{
                  border: 0,
                  padding: 0,
                  background: 'none',
                  color: 'inherit',
                  font: 'inherit',
                  textDecoration: 'underline',
                  cursor: 'pointer',
                }}
              >
                Try again
              </button>
            </div>
          )}
          <UsdcUpgradeCard upgrade={upgrade} variant='notice' />
          <div className='hstack' style={{ gap: 10, marginTop: 16 }}>
            <button
              className='btn btn--primary'
              style={{ flex: 2, whiteSpace: 'nowrap' }}
              onClick={() => router.push('/profile/offramp')}
            >
              <LandmarkIcon size={18} /> Withdraw
            </button>
            <button className='btn btn--ghost' style={{ flex: 1 }} onClick={() => router.push('/profile/onramp')}>
              <ArrowDownLeftIcon size={18} /> Deposit
            </button>
          </div>
        </div>

        <div className='section-header'>
          <h2>Your earnings</h2>
        </div>
        <div className='status-item' style={{ marginBottom: 12 }}>
          <span className='notif-ic' style={{ background: '#fdeed8', color: 'var(--coral)' }}>
            <BanknoteIcon size={20} />
          </span>
          <div className='status-item__body'>
            <div className='status-item__title'>Cash</div>
            <div className='status-item__meta'>Paid by organisations</div>
          </div>
          <div style={{ fontWeight: 800, fontSize: 17 }}>{balance === null ? '· · ·' : fmtMoney(balance)}</div>
        </div>
        {hasRewards && (
          <div className='status-item' style={{ marginBottom: 12 }}>
            <span className='notif-ic' style={{ background: 'var(--yellow-primary)', color: '#3d2c07' }}>
              <BanknoteIcon size={20} />
            </span>
            <div className='status-item__body'>
              <div className='status-item__title'>Cleanup rewards</div>
              <div className='status-item__meta'>
                {heldRewards
                  ? `Withdrawable ${rewardsWhen.when}`
                  : convertibleRewards
                  ? 'Counts towards withdrawals'
                  : 'World Cleanup Day'}
              </div>
            </div>
            <div style={{ fontWeight: 800, fontSize: 17 }}>{fmtMoney(rewards ?? 0)}</div>
          </div>
        )}

        <div className='section-header'>
          <h2>Receive</h2>
        </div>
        <div className='card card--inset hstack' style={{ padding: '12px 14px', gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Your account address</div>
            <div className='muted' style={{ fontSize: 13.5, fontFamily: 'var(--font-mono)' }}>
              {address ? shortAddress(address) : '—'}
            </div>
          </div>
          <button className='pill-btn' onClick={copyAddress} aria-label='Copy address' title='Copy address'>
            {copied ? <CheckIcon size={15} color='var(--green-primary)' /> : <CopyIcon size={15} />}
          </button>
        </div>

        <p className='muted' style={{ fontSize: 13.5, lineHeight: 1.55, margin: '14px 4px 0' }}>
          Approved task payments land here automatically. Withdraw sends your balance to mobile money or a bank account
          — no fees from Yoma.
          <span className='hstack' style={{ display: 'inline-flex', marginLeft: 4, verticalAlign: 'middle' }}>
            <ArrowUpRightIcon size={13} />
          </span>
        </p>
      </main>
    </div>
  );
}
