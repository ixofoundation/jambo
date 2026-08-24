import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

import { useAuth } from '@hooks/useAuth';
import { useLocalCurrency } from '@hooks/useLocalCurrency';
import { getUsdcBalance } from '@utils/usdcBalance';
import { formatCurrency } from '@utils/localCurrency';
import Header from '@components/Header/Header';
import {
  ArrowDownLeftIcon,
  ArrowUpRightIcon,
  BanknoteIcon,
  CheckIcon,
  CopyIcon,
  LandmarkIcon,
} from '@components/Icons/icons';

const fmtUsd = (v: number) =>
  `$ ${v.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Same compact identifier format as the profile DID: first 4 … last 4. */
const shortAddress = (a: string) => (a.length > 11 ? `${a.slice(0, 4)}…${a.slice(-4)}` : a);

/**
 * Wallet: the user's real money. USDC balance on chain, deposit via the
 * on-ramp, withdraw to mobile money / bank via the off-ramp (YellowCard).
 */
export default function Wallet() {
  const router = useRouter();
  const { address } = useAuth();
  const local = useLocalCurrency();
  const [balance, setBalance] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    void getUsdcBalance(address).then((b) => {
      if (!cancelled) setBalance(b.amount);
    });
    return () => {
      cancelled = true;
    };
  }, [address]);

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
            {balance === null ? '· · ·' : local ? formatCurrency(balance * local.rate, local.currency) : fmtUsd(balance)}
          </div>
          <div className='muted' style={{ fontSize: 14 }}>
            {local
              ? `Available to withdraw · ≈ of ${balance === null ? '…' : fmtUsd(balance)} USDC`
              : 'Available to withdraw · USD'}
          </div>
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
          <div style={{ fontWeight: 800, fontSize: 17 }}>
            {balance === null ? '· · ·' : local ? formatCurrency(balance * local.rate, local.currency) : fmtUsd(balance)}
          </div>
        </div>

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
          Approved task payments land here automatically. Withdraw sends your balance to mobile money or a bank
          account — no fees from Yoma.
          <span className='hstack' style={{ display: 'inline-flex', marginLeft: 4, verticalAlign: 'middle' }}>
            <ArrowUpRightIcon size={13} />
          </span>
        </p>
      </main>
    </div>
  );
}
