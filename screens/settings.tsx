import { useState, useCallback, ReactNode } from 'react';
import { useRouter } from 'next/router';

import Header from '@components/Header/Header';
import PinModal from '@components/PinModal/PinModal';
import EmailNotifier from '@components/EmailNotifier/EmailNotifier';
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

        <p style={{ margin: '0 0 12px', padding: '0 4px', fontSize: '13px', color: 'var(--text-secondary)' }}>
          Your account on the ixo network that identifies your transactions.
        </p>

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

        <p style={{ margin: '0 0 12px', padding: '0 4px', fontSize: '13px', color: 'var(--text-secondary)' }}>
          Credentials for your encrypted data store, where your claims, credentials and personal data are securely
          stored.
        </p>

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
          <Row label='Access Token'>
            {accessToken ? (
              <CopyChip value={accessToken} label={shorten(accessToken)} monospace />
            ) : (
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>—</span>
            )}
          </Row>
        </div>

        <h1
          style={{
            margin: '24px 0 8px',
            fontSize: '1.1rem',
            fontWeight: 500,
            color: 'var(--text-primary)',
          }}
        >
          Email Notifications
        </h1>

        <EmailNotifier />

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
