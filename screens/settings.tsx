import { useState, useRef, useEffect, useCallback, ReactNode } from 'react';
import { useRouter } from 'next/router';

import Header from '@components/Header/Header';
import { useAuth } from '@hooks/useAuth';
import { secret } from '@utils/secrets';
import { decrypt } from '@utils/encryption';
import {
  generatePassphraseFromMnemonic,
  generatePasswordFromMnemonic,
  generateUserRoomAliasFromAddress,
} from '@utils/matrix';
import { cleanUrlString } from '@utils/url';

type SecretKey = 'password' | 'passphrase';

function shorten(value: string, head = 8, tail = 5) {
  return value.length > head + tail + 3 ? `${value.slice(0, head)}…${value.slice(-tail)}` : value;
}

export default function SettingsScreen() {
  const router = useRouter();
  const { address, did, logout } = useAuth();

  const userId = secret.userId;
  const baseUrl = secret.baseUrl;
  const accessToken = secret.accessToken;

  const goBack = useCallback(() => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      void router.push('/profile');
    }
  }, [router]);

  const [pinModalFor, setPinModalFor] = useState<SecretKey | null>(null);
  const [secrets, setSecrets] = useState<{ password: string; passphrase: string } | null>(null);
  const [revealed, setRevealed] = useState<Record<SecretKey, boolean>>({ password: false, passphrase: false });

  const handlePinSuccess = useCallback(
    async (pin: string) => {
      try {
        if (!baseUrl || !accessToken || !address) throw new Error('Not authenticated');
        const homeServerUrl = baseUrl;
        const roomAlias = generateUserRoomAliasFromAddress(address, homeServerUrl);
        const aliasRes = await fetch(
          cleanUrlString(`${homeServerUrl}/_matrix/client/v3/directory/room/${encodeURIComponent(roomAlias)}`),
          { headers: { Authorization: `Bearer ${accessToken}` } },
        );
        if (!aliasRes.ok) throw new Error('Could not find your data store room');
        const { room_id } = await aliasRes.json();

        const stateRes = await fetch(
          cleanUrlString(
            `${homeServerUrl}/_matrix/client/r0/rooms/${encodeURIComponent(
              room_id,
            )}/state/ixo.room.state.secure/encrypted_mnemonic`,
          ),
          { headers: { Authorization: `Bearer ${accessToken}` } },
        );
        if (!stateRes.ok) throw new Error('Could not fetch encrypted credentials');
        const stateData = await stateRes.json();
        const encryptedMnemonic = stateData.encrypted_mnemonic;
        if (!encryptedMnemonic) throw new Error('No encrypted credentials found');

        const mnemonic = decrypt(encryptedMnemonic, pin);
        if (!mnemonic) throw new Error('Incorrect PIN');

        const password = generatePasswordFromMnemonic(mnemonic);
        const passphrase = generatePassphraseFromMnemonic(mnemonic);
        setSecrets({ password, passphrase });
        if (pinModalFor) setRevealed((prev) => ({ ...prev, [pinModalFor]: true }));
        setPinModalFor(null);
      } catch (err: any) {
        console.error('Credentials fetch failed:', err);
        throw err;
      }
    },
    [address, baseUrl, accessToken, pinModalFor],
  );

  function handleView(key: SecretKey) {
    if (secrets) {
      setRevealed((prev) => ({ ...prev, [key]: true }));
      return;
    }
    setPinModalFor(key);
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header onGradient title='Settings' onBack={goBack} />

      {/* Small green gradient band behind the (fixed) header so its onGradient styles apply. */}
      <div
        style={{
          background: 'radial-gradient(ellipse at top right, var(--green-secondary), var(--green-primary) 70%)',
          height: 'var(--header-height)',
        }}
      />

      <main
        style={{
          width: '100%',
          maxWidth: 'var(--max-width)',
          margin: '0 auto',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
        }}
      >
        <h1
          style={{
            margin: '0 0 8px',
            fontSize: '1.1rem',
            fontWeight: 500,
            color: 'var(--text-primary)',
          }}
        >
          Account
        </h1>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '0 4px', marginBottom: '24px' }}>
          <Row label='Address'>
            {address ? (
              <CopyChip value={address} label={shorten(address)} monospace />
            ) : (
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>—</span>
            )}
          </Row>
          <Row label='DID'>
            {did ? (
              <CopyChip value={did} label={shorten(did)} monospace />
            ) : (
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>—</span>
            )}
          </Row>
        </div>

        <h1
          style={{
            margin: '0 0 8px',
            fontSize: '1.1rem',
            fontWeight: 500,
            color: 'var(--text-primary)',
          }}
        >
          Data Store
        </h1>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '0 4px' }}>
          <Row label='Username'>
            {userId ? (
              <CopyChip value={userId} label={shorten(userId)} monospace />
            ) : (
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>—</span>
            )}
          </Row>
          <Row label='Password'>
            {revealed.password && secrets ? (
              <CopyChip value={secrets.password} label='Copy' />
            ) : (
              <ActionChip label='View' icon={<LockIcon />} onClick={() => handleView('password')} />
            )}
          </Row>
          <Row label='Passphrase'>
            {revealed.passphrase && secrets ? (
              <CopyChip value={secrets.passphrase} label='Copy' />
            ) : (
              <ActionChip label='View' icon={<LockIcon />} onClick={() => handleView('passphrase')} />
            )}
          </Row>
        </div>

        <div style={{ flex: 1 }} />

        <button
          onClick={() => void logout()}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '14px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '14px',
            color: 'var(--error-color)',
            marginTop: '24px',
            marginBottom: '32px',
          }}
        >
          <svg
            width='16'
            height='16'
            viewBox='0 0 24 24'
            fill='none'
            stroke='currentColor'
            strokeWidth='2'
            strokeLinecap='round'
            strokeLinejoin='round'
          >
            <path d='M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4' />
            <polyline points='16 17 21 12 16 7' />
            <line x1='21' y1='12' x2='9' y2='12' />
          </svg>
          <span>Logout</span>
        </button>
      </main>

      {pinModalFor && <PinModal onSuccess={handlePinSuccess} onCancel={() => setPinModalFor(null)} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Row + chip primitives
// ---------------------------------------------------------------------------

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
      }}
    >
      <span style={{ fontSize: '14px', color: 'var(--text-primary)' }}>{label}</span>
      {children}
    </div>
  );
}

const chipBaseStyle = {
  borderRadius: 'var(--card-border-radius)',
  border: 'none',
  background: 'var(--card-bg-color)',
  padding: '5px 12px',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '8px',
  cursor: 'pointer',
  color: 'var(--text-primary)',
} as const;

function ActionChip({ label, icon, onClick }: { label: string; icon?: ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} style={chipBaseStyle}>
      <span style={{ fontSize: '13px', fontWeight: 500 }}>{label}</span>
      {icon}
    </button>
  );
}

function LockIcon() {
  return (
    <svg
      width={14}
      height={14}
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      style={{ flexShrink: 0, opacity: 0.7 }}
    >
      <rect x='3' y='11' width='18' height='11' rx='2' ry='2' />
      <path d='M7 11V7a5 5 0 0 1 10 0v4' />
    </svg>
  );
}

function CopyChip({ value, label, monospace }: { value: string; label: string; monospace?: boolean }) {
  const [copied, setCopied] = useState(false);

  function handleClick() {
    navigator.clipboard
      .writeText(value)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => {});
  }

  return (
    <button onClick={handleClick} style={chipBaseStyle} title='Copy'>
      <span
        style={{
          fontSize: '13px',
          fontFamily: monospace ? 'monospace' : 'inherit',
          fontWeight: monospace ? 400 : 500,
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </span>
      {copied ? (
        <svg
          width={14}
          height={14}
          viewBox='0 0 24 24'
          fill='none'
          stroke='var(--green-primary)'
          strokeWidth='2.5'
          strokeLinecap='round'
          strokeLinejoin='round'
          style={{ flexShrink: 0 }}
        >
          <polyline points='20 6 9 17 4 12' />
        </svg>
      ) : (
        <svg
          width={14}
          height={14}
          viewBox='0 0 24 24'
          fill='none'
          stroke='currentColor'
          strokeWidth='2'
          strokeLinecap='round'
          strokeLinejoin='round'
          style={{ flexShrink: 0, opacity: 0.7 }}
        >
          <rect x='9' y='9' width='13' height='13' rx='2' ry='2' />
          <path d='M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1' />
        </svg>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// PIN Modal — prompts for Data Store PIN, validates via onSuccess
// ---------------------------------------------------------------------------

const PIN_LENGTH = 6;

function PinModal({ onSuccess, onCancel }: { onSuccess: (pin: string) => Promise<void>; onCancel: () => void }) {
  const [digits, setDigits] = useState<string[]>(Array(PIN_LENGTH).fill(''));
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const hiddenInputRef = useRef<HTMLInputElement | null>(null);
  const errorCountRef = useRef(0);

  useEffect(() => {
    setTimeout(() => hiddenInputRef.current?.focus(), 100);
  }, []);

  useEffect(() => {
    const pin = digits.join('');
    if (pin.length === PIN_LENGTH && !loading) {
      handleSubmit(pin);
    }
  }, [digits]);

  async function handleSubmit(pin: string) {
    setError('');
    setLoading(true);
    try {
      await onSuccess(pin);
    } catch (err: any) {
      if (errorCountRef.current < 3) {
        setError(err.message || 'Incorrect PIN. Please try again.');
        errorCountRef.current += 1;
        setDigits(Array(PIN_LENGTH).fill(''));
        setTimeout(() => hiddenInputRef.current?.focus(), 50);
      } else {
        setError('Too many attempts. Please try again later.');
        setTimeout(() => onCancel(), 2000);
      }
    } finally {
      setLoading(false);
    }
  }

  function handleInput(value: string) {
    const cleaned = value.replace(/[^0-9]/g, '').slice(0, PIN_LENGTH);
    const newDigits = Array(PIN_LENGTH).fill('');
    for (let i = 0; i < cleaned.length; i++) {
      newDigits[i] = cleaned[i];
    }
    setDigits(newDigits);
  }

  const filledCount = digits.filter(Boolean).length;
  const activeIndex = Math.min(filledCount, PIN_LENGTH - 1);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(4px)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '340px',
          margin: '0 20px',
          borderRadius: '12px',
          padding: '28px 24px',
          backgroundColor: 'rgba(0, 0, 0, 0.85)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ width: '28px' }} />
          <h1 style={{ flex: 1, textAlign: 'center', margin: 0, color: 'white', fontSize: '14px' }}>Data Store</h1>
          <button
            onClick={onCancel}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              color: 'rgba(255,255,255,0.5)',
              width: '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg
              width='16'
              height='16'
              viewBox='0 0 24 24'
              fill='none'
              stroke='currentColor'
              strokeWidth='2.5'
              strokeLinecap='round'
              strokeLinejoin='round'
            >
              <line x1='18' y1='6' x2='6' y2='18' />
              <line x1='6' y1='6' x2='18' y2='18' />
            </svg>
          </button>
        </div>

        <div
          style={{ position: 'relative', marginBottom: '12px', cursor: 'pointer' }}
          onClick={() => hiddenInputRef.current?.focus()}
        >
          <input
            ref={hiddenInputRef}
            type='text'
            inputMode='numeric'
            value={digits.join('')}
            onChange={(e) => handleInput(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            style={{
              position: 'absolute',
              opacity: 0,
              width: '100%',
              height: '100%',
              top: 0,
              left: 0,
              zIndex: 2,
              cursor: 'pointer',
            }}
            maxLength={PIN_LENGTH}
          />
          <div style={{ display: 'flex', gap: '8px', pointerEvents: 'none' }}>
            {digits.map((digit, i) => {
              const isCurrent = focused && i === activeIndex;
              const hasDot = !!digit;
              return (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    aspectRatio: '1',
                    position: 'relative',
                    borderRadius: '8px',
                    border: isCurrent ? '2px solid white' : '1px solid rgba(255,255,255,0.3)',
                    backgroundColor: isCurrent ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.08)',
                    boxSizing: 'border-box',
                  }}
                >
                  {hasDot && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: '10px',
                        height: '10px',
                        borderRadius: '50%',
                        backgroundColor: 'white',
                      }}
                    />
                  )}
                  {!hasDot && !isCurrent && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        backgroundColor: 'rgba(0,0,0,0.25)',
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '16px', textAlign: 'center' }}>
          Enter your Data Store PIN
        </p>

        {error && <p style={{ color: 'red', fontSize: '13px', marginBottom: '12px', textAlign: 'center' }}>{error}</p>}

        {loading && (
          <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', textAlign: 'center' }}>Verifying...</p>
        )}
      </div>
    </div>
  );
}
