import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { useRouter } from 'next/router';

import Header from '@components/Header/Header';
import { CheckIcon, ChevronRightIcon, CopyIcon } from '@components/Icons/icons';
import useAirtimeSwap, { type SwapStep, type SwapView } from '@hooks/useAirtimeSwap';
import useVoucherBalance from '@hooks/useVoucherBalance';
import { formatWait, rand, type RefusalCopy } from 'lib/airtimeVoucher/messages';
import { swapNeed, type StoredSwap, type SwapNeed } from 'lib/airtimeVoucher/swapStore';
import type { ServiceInfo, SwapPin } from 'lib/airtimeVoucher/types';

/**
 * Get airtime: swap airtime vouchers (1 voucher = R1) for an airtime PIN.
 * Amount → confirm → progress → PIN, with a state for every way it can stop
 * in between. The flow itself is in hooks/useAirtimeSwap; see
 * docs/airtime-swap.md.
 */

const QUICK_AMOUNTS = [10, 20, 50, 100, 200];

const noticeStyle: CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--warning-border)',
  borderRadius: 14,
  padding: '12px 14px',
  fontSize: 14.5,
  lineHeight: 1.45,
  color: 'var(--text-primary)',
};

const titleStyle: CSSProperties = {
  fontFamily: 'var(--font-display)',
  fontSize: 22,
  fontWeight: 700,
  letterSpacing: '-0.01em',
  lineHeight: 1.2,
  margin: 0,
};

const bodyStyle: CSSProperties = { fontSize: 15.5, lineHeight: 1.5, margin: '8px 0 0' };

const clockTime = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const dayAndTime = (ms: number) =>
  new Date(ms).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** `1234567890123456` → `1234 5678 9012 3456`, for reading aloud and typing. */
const groupPin = (pin: string) => pin.replace(/(.{4})(?=.)/g, '$1 ');

/** A clock for the countdowns on this screen. */
function useNow(everyMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(timer);
  }, [everyMs]);
  return now;
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard blocked: the value stays on screen for long-press
    }
  };
  return (
    <button type='button' className='pill-btn' onClick={copy} aria-label={label} title={label}>
      {copied ? <CheckIcon size={15} color='var(--green-primary)' /> : <CopyIcon size={15} />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

function Reference({ swap }: { swap: StoredSwap }) {
  return (
    <div className='card card--inset hstack' style={{ padding: '12px 14px', gap: 10, marginTop: 14 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className='muted' style={{ fontSize: 13.5, fontWeight: 600 }}>
          Reference
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13.5, wordBreak: 'break-all' }}>{swap.reference}</div>
      </div>
      <CopyButton value={swap.reference} label='Copy reference' />
    </div>
  );
}

function TestNotice() {
  return (
    <div role='status' style={noticeStyle}>
      <strong>Test PIN.</strong> This is a test network: the PIN is not real airtime and will not work on any phone.
    </div>
  );
}

const STEP_ORDER: SwapStep[] = ['asking', 'burning', 'issuing'];
const STEP_LABEL: Record<SwapStep, string> = {
  asking: 'Asking the airtime service',
  burning: 'Using your vouchers',
  issuing: 'Getting your PIN',
  reading: 'Checking your swap',
};

function Progress({ step }: { step: SwapStep }) {
  const steps = step === 'reading' ? (['reading'] as SwapStep[]) : STEP_ORDER;
  const at = steps.indexOf(step);
  return (
    <div className='card' style={{ padding: '20px 18px' }} aria-live='polite'>
      <h1 style={titleStyle}>{step === 'reading' ? 'One moment' : 'Swapping your vouchers'}</h1>
      <div className='vstack' style={{ gap: 12, marginTop: 16 }}>
        {steps.map((s, i) => (
          <div key={s} className='hstack' style={{ gap: 12, opacity: i > at ? 0.45 : 1 }}>
            <span
              aria-hidden='true'
              style={{
                width: 26,
                height: 26,
                borderRadius: '50%',
                flex: 'none',
                display: 'grid',
                placeItems: 'center',
                background: i < at ? 'var(--mint)' : 'var(--surface-2)',
                color: 'var(--green-primary)',
              }}
            >
              {i < at ? (
                <CheckIcon size={15} />
              ) : i === at ? (
                <span
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: '50%',
                    border: '2px solid var(--border-color)',
                    borderTopColor: 'var(--purple-primary)',
                    animation: 'airtimeSpin 0.8s linear infinite',
                  }}
                />
              ) : null}
            </span>
            <span style={{ fontWeight: i === at ? 700 : 600, fontSize: 15.5 }}>{STEP_LABEL[s]}</span>
          </div>
        ))}
      </div>
      {step !== 'reading' && (
        <p className='muted' style={{ fontSize: 14, lineHeight: 1.5, margin: '16px 0 0' }}>
          This can take a minute. If this page closes, your swap is saved: open Get airtime again to pick it up.
        </p>
      )}
      <style>{`@keyframes airtimeSpin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function AmountStep({
  info,
  vouchers,
  held,
  onContinue,
}: {
  info: ServiceInfo;
  vouchers: { amount: number; at: number } | null;
  /** The balance read from the chain just now, in rand; null when not known. */
  held: number | null;
  onContinue: (amount: number) => void;
}) {
  const [text, setText] = useState('');
  const amount = /^\d{1,6}$/.test(text) ? Number(text) : null;
  const { minSwapZar: min, maxSwapZar: max } = info;
  const tooSmall = amount !== null && amount < min;
  const tooLarge = amount !== null && amount > max;
  // The fresh read when there is one, else what the last swap counted.
  const known = held ?? vouchers?.amount ?? null;
  const overHeld = amount !== null && known !== null && amount > known;
  const valid = amount !== null && !tooSmall && !tooLarge;
  const quick = QUICK_AMOUNTS.filter((a) => a >= min && a <= max && (known === null || a <= known));

  return (
    <div className='card' style={{ padding: '20px 18px 18px' }}>
      <h1 style={titleStyle}>How much airtime?</h1>
      <p className='muted' style={bodyStyle}>
        Swap your airtime vouchers for an airtime PIN that works on Vodacom, MTN, Telkom and Cell C. One voucher is R1
        of airtime.
      </p>

      <div className='field'>
        <label className='field__label' htmlFor='airtime-amount' style={{ display: 'block' }}>
          Amount in rand
        </label>
        <div style={{ position: 'relative' }}>
          <span
            aria-hidden='true'
            style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontWeight: 700 }}
          >
            R
          </span>
          <input
            id='airtime-amount'
            className='field__box'
            style={{ paddingLeft: 32, fontWeight: 700 }}
            inputMode='numeric'
            pattern='[0-9]*'
            autoComplete='off'
            placeholder={String(min)}
            value={text}
            onChange={(e) => setText(e.target.value.replace(/\D/g, '').replace(/^0+/, '').slice(0, 6))}
            aria-describedby='airtime-amount-help'
          />
        </div>
        <div id='airtime-amount-help' className='muted' style={{ fontSize: 14, marginTop: 7, lineHeight: 1.45 }}>
          {tooSmall ? (
            <span style={{ color: 'var(--error-color)' }}>The smallest swap is {rand(min)}.</span>
          ) : tooLarge ? (
            <span style={{ color: 'var(--error-color)' }}>The largest swap is {rand(max)}.</span>
          ) : (
            <>
              Whole rands only, from {rand(min)} to {rand(max)}.
            </>
          )}
        </div>
      </div>

      {quick.length > 0 && (
        <div className='hstack' style={{ gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          {quick.map((a) => (
            <button
              key={a}
              type='button'
              className={`chip${amount === a ? ' chip--active' : ''}`}
              onClick={() => setText(String(a))}
            >
              {rand(a)}
            </button>
          ))}
        </div>
      )}

      <p className='muted' style={{ fontSize: 14, lineHeight: 1.45, margin: '14px 0 0' }}>
        {held !== null
          ? `You have ${rand(held)} in airtime vouchers.`
          : vouchers === null
          ? 'We count your vouchers when you continue.'
          : `You had ${rand(vouchers.amount)} in airtime vouchers when we last counted (${dayAndTime(vouchers.at)}).`}
        {overHeld && ' That is less than this amount; we will count again when you continue.'}
      </p>

      <button
        type='button'
        className='btn btn--primary btn--block'
        style={{ marginTop: 16 }}
        disabled={!valid}
        onClick={() => amount !== null && valid && onContinue(amount)}
      >
        Continue
      </button>
    </div>
  );
}

function ConfirmStep({
  amount,
  swap,
  now,
  onConfirm,
  onBack,
}: {
  amount: number;
  swap: StoredSwap | null;
  now: number;
  onConfirm: () => void;
  onBack: () => void;
}) {
  const expiresAt = swap ? Date.parse(swap.expiresAt) : null;
  return (
    <div className='card' style={{ padding: '20px 18px 18px' }}>
      <h1 style={titleStyle}>{swap ? 'Finish your swap' : 'Check and confirm'}</h1>
      <div className='info-list' style={{ marginTop: 14 }}>
        <div className='info-row'>
          <div>
            <div className='info-row__s'>You give</div>
            <div className='info-row__t'>
              {rand(amount)} of your airtime vouchers ({amount} voucher{amount === 1 ? '' : 's'})
            </div>
          </div>
        </div>
        <div className='info-row'>
          <div>
            <div className='info-row__s'>You get</div>
            <div className='info-row__t'>One {rand(amount)} airtime PIN</div>
          </div>
        </div>
      </div>

      <div role='note' style={{ ...noticeStyle, marginTop: 14 }}>
        <strong>This cannot be undone.</strong> When you confirm, {rand(amount)} of vouchers are used up (burned) and
        leave your wallet for good. A PIN cannot be turned back into vouchers.
      </div>

      {swap && expiresAt !== null && Number.isFinite(expiresAt) && (
        <p className='muted' style={{ fontSize: 14, lineHeight: 1.45, margin: '12px 0 0' }}>
          This swap is open until {clockTime(expiresAt)} ({formatWait((expiresAt - now) / 1000)} left). If you leave it,
          it runs out by itself and nothing is taken.
        </p>
      )}

      <button type='button' className='btn btn--primary btn--block' style={{ marginTop: 16 }} onClick={onConfirm}>
        Confirm and swap {rand(amount)}
      </button>
      <button type='button' className='btn btn--ghost btn--block' style={{ marginTop: 10 }} onClick={onBack}>
        {swap ? 'Not now' : 'Back'}
      </button>
    </div>
  );
}

function PinResult({ pin, swap, onDone }: { pin: SwapPin; swap: StoredSwap; onDone: () => void }) {
  return (
    <>
      {pin.test && (
        <div style={{ marginBottom: 12 }}>
          <TestNotice />
        </div>
      )}
      <div className='card' style={{ padding: '20px 18px 18px' }}>
        <div className='muted' style={{ fontSize: 14, fontWeight: 600 }}>
          Your {rand(pin.valueZar || swap.amount)} airtime PIN
        </div>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 30,
            fontWeight: 800,
            letterSpacing: '0.02em',
            lineHeight: 1.25,
            margin: '6px 0 12px',
            wordBreak: 'break-word',
            userSelect: 'all',
          }}
          aria-label={`PIN ${pin.pin.split('').join(' ')}`}
        >
          {groupPin(pin.pin)}
        </div>
        <CopyButton value={pin.pin} label='Copy PIN' />

        {pin.ussd && (
          <div className='card card--inset' style={{ padding: '12px 14px', marginTop: 16 }}>
            <div className='muted' style={{ fontSize: 13.5, fontWeight: 600 }}>
              Dial this on the phone that should get the airtime
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700, wordBreak: 'break-all' }}>
              {pin.ussd}
            </div>
            <div className='hstack' style={{ gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              <a
                className='btn btn--primary btn--sm'
                style={{ textDecoration: 'none' }}
                href={`tel:${encodeURIComponent(pin.ussd)}`}
              >
                Dial now
              </a>
              <CopyButton value={pin.ussd} label='Copy the code to dial' />
            </div>
          </div>
        )}

        {pin.steps.length > 0 && (
          <ol style={{ margin: '16px 0 0', paddingLeft: 20, fontSize: 15, lineHeight: 1.5 }}>
            {pin.steps.map((step, i) => (
              <li key={i} style={{ marginTop: i === 0 ? 0 : 6, wordBreak: 'break-word' }}>
                {step}
              </li>
            ))}
          </ol>
        )}

        {pin.url && (
          <p style={{ fontSize: 15, margin: '12px 0 0' }}>
            <a href={pin.url} target='_blank' rel='noopener noreferrer' style={{ color: 'var(--green-primary)' }}>
              Open the redeem page
            </a>
          </p>
        )}
      </div>

      <p className='muted' style={{ fontSize: 14, lineHeight: 1.5, margin: '14px 4px 0' }}>
        Keep this PIN to yourself: whoever has it can use the airtime. You can open it again here, under Recent swaps.
      </p>
      <button type='button' className='btn btn--light btn--block' style={{ marginTop: 14 }} onClick={onDone}>
        Done
      </button>
    </>
  );
}

const NEED_LABEL: Record<SwapNeed, { text: string; tone: 'approved' | 'reviewing' | 'muted' }> = {
  pin: { text: 'Show PIN', tone: 'approved' },
  owed: { text: 'On its way', tone: 'reviewing' },
  flagged: { text: 'Being looked at', tone: 'reviewing' },
  burn_sent: { text: 'Check', tone: 'reviewing' },
  ready: { text: 'Not finished', tone: 'reviewing' },
  open_elsewhere: { text: 'Open', tone: 'reviewing' },
  expired: { text: 'Ran out', tone: 'muted' },
};

function RecentSwaps({ swaps, now, onOpen }: { swaps: StoredSwap[]; now: number; onOpen: (id: string) => void }) {
  if (swaps.length === 0) return null;
  return (
    <>
      <div className='section-header'>
        <h2>Recent swaps</h2>
      </div>
      <div className='vstack' style={{ gap: 10 }}>
        {swaps.map((swap) => {
          const need = swapNeed(swap, now);
          const label = NEED_LABEL[need];
          const tappable = need !== 'expired';
          return (
            <button
              key={swap.id}
              type='button'
              className='status-item'
              style={{ width: '100%', border: 0, textAlign: 'left', font: 'inherit', color: 'inherit' }}
              disabled={!tappable}
              onClick={() => onOpen(swap.id)}
            >
              <div className='status-item__body'>
                <div className='status-item__title'>{rand(swap.amount)} airtime</div>
                <div className='status-item__meta'>{dayAndTime(swap.createdAt)}</div>
              </div>
              <div className='status-item__trailing'>
                <span
                  className={label.tone === 'muted' ? 'muted' : label.tone}
                  style={{ fontSize: 13.5, fontWeight: 700 }}
                >
                  {label.text}
                </span>
                {tappable && <ChevronRightIcon size={16} />}
              </div>
            </button>
          );
        })}
      </div>
    </>
  );
}

function Message({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className='card' style={{ padding: '20px 18px 18px' }} role='status'>
      <h1 style={titleStyle}>{title}</h1>
      {children}
    </div>
  );
}

function Refused({
  view,
  now,
  onAmount,
  onRetry,
  onCheck,
  onWallet,
  onVerify,
}: {
  view: Extract<SwapView, { kind: 'refused' }>;
  now: number;
  onAmount: () => void;
  onRetry: (amount: number) => void;
  onCheck: (swap: StoredSwap) => void;
  onWallet: () => void;
  /** To the identity verification screen; `reverify` when they are verified already. */
  onVerify: (reverify: boolean) => void;
}) {
  const { copy, swap, amount, retryAt } = view;
  const waiting = retryAt !== null && retryAt > now;
  const primary = ((): { label: string; run: () => void; disabled?: boolean } | null => {
    const again = () => (amount !== null ? onRetry(amount) : onAmount());
    switch (copy.action as RefusalCopy['action']) {
      case 'resume':
        return swap ? { label: 'Open that swap', run: () => onCheck(swap) } : null;
      case 'wait':
        return {
          label: waiting ? `Try again in ${formatWait((retryAt - now) / 1000)}` : 'Try again',
          run: again,
          disabled: waiting,
        };
      case 'retry':
        return { label: 'Try again', run: again };
      case 'burn_again':
        return swap ? { label: 'Try again', run: () => onCheck(swap) } : { label: 'Start again', run: onAmount };
      case 'amount':
        return { label: 'Choose another amount', run: onAmount };
      case 'check':
        return swap ? { label: 'Check again', run: () => onCheck(swap) } : null;
      case 'verify':
        return { label: 'Verify my identity', run: () => onVerify(copy.reverify === true) };
      default:
        return null;
    }
  })();
  return (
    <Message title={copy.title}>
      <p style={bodyStyle}>{copy.body}</p>
      {swap && copy.action === 'support' && <Reference swap={swap} />}
      {primary && (
        <button
          type='button'
          className='btn btn--primary btn--block'
          style={{ marginTop: 16 }}
          disabled={primary.disabled}
          onClick={primary.run}
        >
          {primary.label}
        </button>
      )}
      <button type='button' className='btn btn--ghost btn--block' style={{ marginTop: 10 }} onClick={onWallet}>
        Back to wallet
      </button>
    </Message>
  );
}

export default function AirtimeSwapScreen() {
  const router = useRouter();
  const now = useNow();
  const { view, info, swaps, vouchers, reload, chooseAmount, toAmount, confirm, check, openSwap } = useAirtimeSwap();
  // Read again whenever the screen changes step: a finished swap has burned vouchers.
  const held = useVoucherBalance(view.kind);
  const toWallet = () => void router.push('/wallet');
  // Where the app verifies identity; `reverify` starts it over for a user who is verified already.
  const toVerify = (reverify: boolean) =>
    void router.push(reverify ? '/profile/credentials/kyc?reverify=1' : '/profile/credentials/kyc');

  let content: ReactNode;
  switch (view.kind) {
    case 'loading':
      content = <Progress step='reading' />;
      break;
    case 'unavailable':
      content = (
        <Message title='Airtime is not available right now'>
          <p style={bodyStyle}>We could not reach the airtime service. Your vouchers are safe.</p>
          <button type='button' className='btn btn--primary btn--block' style={{ marginTop: 16 }} onClick={reload}>
            Try again
          </button>
        </Message>
      );
      break;
    case 'amount':
      content = info ? (
        <>
          <AmountStep info={info} vouchers={vouchers} held={held} onContinue={chooseAmount} />
          <RecentSwaps swaps={swaps} now={now} onOpen={openSwap} />
        </>
      ) : (
        <Progress step='reading' />
      );
      break;
    case 'confirm':
      content = (
        <ConfirmStep
          amount={view.amount}
          swap={view.swap}
          now={now}
          onConfirm={confirm}
          onBack={view.swap ? toWallet : toAmount}
        />
      );
      break;
    case 'working':
      content = <Progress step={view.step} />;
      break;
    case 'pin':
      content = <PinResult pin={view.pin} swap={view.swap} onDone={toWallet} />;
      break;
    case 'owed':
      content = (
        <Message title='Your airtime is owed to you'>
          <p style={bodyStyle}>
            Your vouchers were used and the swap is recorded. The PIN is not ready yet. You do not need to do anything
            else, and you will not be charged again.
          </p>
          {view.message && (
            <div className='card card--inset' style={{ padding: '12px 14px', marginTop: 14 }}>
              <div className='muted' style={{ fontSize: 13.5, fontWeight: 600 }}>
                The airtime service says
              </div>
              <div style={{ fontSize: 15, lineHeight: 1.5 }}>{view.message}</div>
            </div>
          )}
          <Reference swap={view.swap} />
          <button
            type='button'
            className='btn btn--primary btn--block'
            style={{ marginTop: 16 }}
            onClick={() => check(view.swap)}
          >
            Check again
          </button>
          <button type='button' className='btn btn--ghost btn--block' style={{ marginTop: 10 }} onClick={toWallet}>
            Back to wallet
          </button>
        </Message>
      );
      break;
    case 'burn_sent':
      content =
        view.swap.status === 'expired' ? (
          <Message title='We could not confirm this swap'>
            <p style={bodyStyle}>
              This swap ran out before the airtime service saw your vouchers arrive. If {rand(view.swap.amount)} of
              vouchers left your wallet, contact support and quote the reference below. You can also check again.
            </p>
            <Reference swap={view.swap} />
            <button
              type='button'
              className='btn btn--primary btn--block'
              style={{ marginTop: 16 }}
              onClick={() => check(view.swap)}
            >
              Check again
            </button>
            <button type='button' className='btn btn--ghost btn--block' style={{ marginTop: 10 }} onClick={toAmount}>
              Start a new swap
            </button>
          </Message>
        ) : (
          <Message title='Waiting for your vouchers to arrive'>
            <p style={bodyStyle}>
              Your vouchers were sent, and the airtime service cannot see them yet. This usually takes less than a
              minute. Your swap is saved; you will not be asked to send them again.
            </p>
            <button
              type='button'
              className='btn btn--primary btn--block'
              style={{ marginTop: 16 }}
              onClick={() => check(view.swap)}
            >
              Check again
            </button>
            <button type='button' className='btn btn--ghost btn--block' style={{ marginTop: 10 }} onClick={toWallet}>
              Back to wallet
            </button>
          </Message>
        );
      break;
    case 'open_elsewhere': {
      const expiresAt = Date.parse(view.swap.expiresAt);
      content = (
        <Message title='You have a swap open'>
          <p style={bodyStyle}>
            A swap of {rand(view.swap.amount)} was started, but this device cannot finish it. Nothing was taken from
            your vouchers. It runs out by itself
            {Number.isFinite(expiresAt) ? ` at ${clockTime(expiresAt)}` : ' in a few minutes'}, and then you can start a
            new one.
          </p>
          <button
            type='button'
            className='btn btn--primary btn--block'
            style={{ marginTop: 16 }}
            onClick={() => check(view.swap)}
          >
            Check again
          </button>
          <button type='button' className='btn btn--ghost btn--block' style={{ marginTop: 10 }} onClick={toWallet}>
            Back to wallet
          </button>
        </Message>
      );
      break;
    }
    case 'refused':
      content = (
        <Refused
          view={view}
          now={now}
          onAmount={toAmount}
          onRetry={chooseAmount}
          onCheck={check}
          onWallet={toWallet}
          onVerify={toVerify}
        />
      );
      break;
  }

  return (
    <div style={{ position: 'relative', minHeight: '100dvh' }}>
      <Header title='Get airtime' onBack={toWallet} />
      <main
        style={{
          position: 'relative',
          zIndex: 1,
          maxWidth: 'var(--max-width)',
          margin: '0 auto',
          padding: '0 20px var(--dock-clearance)',
          paddingTop: 'calc(var(--header-height) + 8px)',
        }}
      >
        {info?.test && view.kind !== 'pin' && (
          <div role='status' style={{ ...noticeStyle, marginBottom: 12 }}>
            <strong>Test mode.</strong> PINs on this network are not real airtime.
          </div>
        )}
        {content}
      </main>
    </div>
  );
}
