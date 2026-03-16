import { useState, useRef, useEffect, useCallback } from 'react';

import Header from '@components/Header/Header';
import { useAuth } from '@hooks/useAuth';
import { useRouter } from 'next/router';
import { useAppSelector } from '@store/hooks';
import { secret } from '@utils/secrets';
import { decrypt } from '@utils/encryption';
import {
  generatePassphraseFromMnemonic,
  generatePasswordFromMnemonic,
  generateUserRoomAliasFromAddress,
} from '@utils/matrix';
import { cleanUrlString } from '@utils/url';

type CredentialsState = 'hidden' | 'pin' | 'revealed';

export default function ProfileScreen() {
  const router = useRouter();
  const { address, did, logout } = useAuth();
  const matrixProfile = useAppSelector((state) => state.matrixProfile);

  const displayName = matrixProfile?.displayName || address || null;

  const [credentialsState, setCredentialsState] = useState<CredentialsState>('hidden');
  const [matrixPassword, setMatrixPassword] = useState('');
  const [matrixPassphrase, setMatrixPassphrase] = useState('');

  const userId = secret.userId;
  const baseUrl = secret.baseUrl;
  const accessToken = secret.accessToken;

  function handleCredentialsPress() {
    setCredentialsState('pin');
  }

  const handlePinSuccess = useCallback(
    async (pin: string) => {
      try {
        if (!baseUrl || !accessToken || !address) {
          throw new Error('Not authenticated');
        }

        const homeServerUrl = baseUrl;
        const roomAlias = generateUserRoomAliasFromAddress(address, homeServerUrl);
        const aliasRes = await fetch(
          cleanUrlString(`${homeServerUrl}/_matrix/client/v3/directory/room/${encodeURIComponent(roomAlias)}`),
          { headers: { Authorization: `Bearer ${accessToken}` } },
        );
        if (!aliasRes.ok) throw new Error('Could not find your data vault room');
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
        setMatrixPassword(password);
        setMatrixPassphrase(passphrase);
        setCredentialsState('revealed');
      } catch (err: any) {
        console.error('Credentials fetch failed:', err);
        throw err;
      }
    },
    [address, baseUrl, accessToken],
  );

  function handleHideCredentials() {
    setCredentialsState('hidden');
    setMatrixPassword('');
    setMatrixPassphrase('');
  }

  return (
    <>
      <Header />
      <main
        style={{
          maxWidth: 'var(--max-width)',
          margin: '0 auto',
          padding: '16px',
          paddingTop: 'calc(var(--header-height) + 20px)',
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column' as const,
        }}
      >
        {/* Profile section */}
        <section style={{ marginBottom: '24px' }}>
          <div
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '16px 0' }}
          >
            {matrixProfile?.avatarUrl ? (
              <img
                src={matrixProfile.avatarUrl}
                alt=''
                style={{ width: '72px', height: '72px', borderRadius: '50%', objectFit: 'cover' }}
              />
            ) : (
              <div
                style={{
                  width: '72px',
                  height: '72px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--primary-color)',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '28px',
                  fontWeight: 500,
                }}
              >
                {displayName ? displayName.charAt(0).toUpperCase() : '?'}
              </div>
            )}
            <p style={{ margin: 0, fontSize: '18px', fontWeight: 500, color: 'var(--main-font-color)' }}>
              {displayName || 'Unknown'}
            </p>
          </div>
        </section>

        {/* Divider */}
        <div style={{ height: '1px', backgroundColor: 'var(--border-color)', margin: '0 0 24px' }} />

        {/* Account info */}
        <section style={{ marginBottom: '24px' }}>
          <h3
            style={{
              margin: '0 0 16px',
              fontSize: '13px',
              fontWeight: 600,
              color: 'var(--muted-font-color)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            Account Information
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {userId && <InfoRow label='Matrix ID' value={userId} />}
            {did && <InfoRow label='Profile DID' value={did} />}
            {address && <InfoRow label='Impact Hub Address' value={address} />}
          </div>
        </section>

        {/* Divider */}
        <div style={{ height: '1px', backgroundColor: 'var(--border-color)', margin: '0 0 24px' }} />

        {/* Credentials */}
        <section>
          <h3
            style={{
              margin: '0 0 16px',
              fontSize: '13px',
              fontWeight: 600,
              color: 'var(--muted-font-color)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            Credentials
          </h3>

          {credentialsState === 'hidden' && (
            <button
              onClick={handleCredentialsPress}
              style={{
                width: '100%',
                padding: '14px 16px',
                borderRadius: '10px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--card-bg-color)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                color: 'var(--main-font-color)',
                fontSize: '14px',
              }}
            >
              <span>View credentials</span>
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
                <rect x='3' y='11' width='18' height='11' rx='2' ry='2' />
                <path d='M7 11V7a5 5 0 0 1 10 0v4' />
              </svg>
            </button>
          )}

          {credentialsState === 'revealed' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div
                style={{
                  padding: '16px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--card-bg-color)',
                }}
              >
                <p
                  style={{
                    margin: '0 0 8px',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: 'var(--muted-font-color)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  Matrix Password
                </p>
                <CredentialValue value={matrixPassword} />
              </div>

              <div
                style={{
                  padding: '16px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--card-bg-color)',
                }}
              >
                <p
                  style={{
                    margin: '0 0 8px',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: 'var(--muted-font-color)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  Recovery Phrase
                </p>
                <CredentialValue value={matrixPassphrase} />
              </div>

              <button
                onClick={handleHideCredentials}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'transparent',
                  cursor: 'pointer',
                  fontSize: '14px',
                  color: 'var(--main-font-color)',
                }}
              >
                Hide credentials
              </button>
            </div>
          )}
        </section>

        {/* Spacer to push logout to bottom */}
        <div style={{ flex: 1 }} />

        {/* Logout */}
        <button
          onClick={() => void logout()}
          style={{
            width: '100%',
            padding: '14px',
            borderRadius: '10px',
            border: '1px solid var(--border-color)',
            background: 'none',
            cursor: 'pointer',
            fontSize: '14px',
            color: 'var(--error-color)',
            marginTop: '24px',
            marginBottom: '32px',
          }}
        >
          Logout
        </button>
      </main>

      {/* PIN Modal */}
      {credentialsState === 'pin' && (
        <PinModal onSuccess={handlePinSuccess} onCancel={() => setCredentialsState('hidden')} />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Copy button with temporary green checkmark feedback
// ---------------------------------------------------------------------------

function CopyButton({ text, size = 14 }: { text: string; size?: number }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => {});
  }

  if (copied) {
    return (
      <button
        style={{
          background: 'none',
          border: 'none',
          padding: '2px',
          color: 'var(--success-color)',
          flexShrink: 0,
          cursor: 'default',
        }}
      >
        <svg
          width={size}
          height={size}
          viewBox='0 0 24 24'
          fill='none'
          stroke='currentColor'
          strokeWidth='2.5'
          strokeLinecap='round'
          strokeLinejoin='round'
        >
          <polyline points='20 6 9 17 4 12' />
        </svg>
      </button>
    );
  }

  return (
    <button
      onClick={handleCopy}
      style={{
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: '2px',
        color: 'var(--muted-font-color)',
        flexShrink: 0,
      }}
      title='Copy'
    >
      <svg
        width={size}
        height={size}
        viewBox='0 0 24 24'
        fill='none'
        stroke='currentColor'
        strokeWidth='2'
        strokeLinecap='round'
        strokeLinejoin='round'
      >
        <rect x='9' y='9' width='13' height='13' rx='2' ry='2' />
        <path d='M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1' />
      </svg>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Account info row — full value, copy button with checkmark feedback
// ---------------------------------------------------------------------------

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <span style={{ fontSize: '12px', color: 'var(--muted-font-color)', fontWeight: 500 }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
        <span
          style={{
            fontSize: '13px',
            color: 'var(--main-font-color)',
            fontFamily: 'monospace',
            wordBreak: 'break-all',
            lineHeight: 1.4,
            flex: 1,
          }}
        >
          {value}
        </span>
        <CopyButton text={value} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Credential value with copy button
// ---------------------------------------------------------------------------

function CredentialValue({ value }: { value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
      <code
        style={{ flex: 1, fontSize: '13px', color: 'var(--main-font-color)', wordBreak: 'break-all', lineHeight: 1.5 }}
      >
        {value}
      </code>
      <CopyButton text={value} size={16} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// PIN Modal — matches the registration confirm PIN UI styling
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
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ width: '28px' }} />
          <h1 style={{ flex: 1, textAlign: 'center', margin: 0, color: 'white', fontSize: '14px' }}>Data Vault</h1>
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

        {/* PIN boxes */}
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
          Enter your Data Vault PIN
        </p>

        {error && <p style={{ color: 'red', fontSize: '13px', marginBottom: '12px', textAlign: 'center' }}>{error}</p>}

        {loading && (
          <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', textAlign: 'center' }}>Verifying...</p>
        )}
      </div>
    </div>
  );
}
