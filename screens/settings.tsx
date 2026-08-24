import { useState, useCallback, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/router';

import Header from '@components/Header/Header';
import GradientBand from '@components/GradientBand/GradientBand';
import PinModal from '@components/PinModal/PinModal';
import EmailNotifier from '@components/EmailNotifier/EmailNotifier';
import {
  BadgeCheckIcon,
  ChevronRightIcon,
  CopyIcon,
  FingerprintIcon,
  KeyRoundIcon,
  LogOutIcon,
  ShieldCheckIcon,
  UserRoundIcon,
  WalletIcon,
} from '@components/Icons/icons';
import { openPinResetFlow } from 'lib/authHub/pinReset';
import { useAuth } from '@hooks/useAuth';
import useIsAdmin from '@hooks/useIsAdmin';
import { secret } from '@utils/secrets';
import { decryptEncryptedMnemonic } from '@utils/roomBotMnemonic';
import {
  generatePassphraseFromMnemonic,
  generatePasswordFromMnemonic,
  generateUserRoomAliasFromAddress,
} from '@utils/matrix';
import { cleanUrlString } from '@utils/url';
import { getCachedLink, type YomaLinkState } from '@utils/yomaLink';

type SecretKey = 'password' | 'passphrase';

function shorten(value: string, head = 8, tail = 5) {
  return value.length > head + tail + 3 ? `${value.slice(0, head)}…${value.slice(-tail)}` : value;
}

export default function SettingsScreen() {
  const router = useRouter();
  const { address, did, logout } = useAuth();
  const { isAdmin } = useIsAdmin();

  const userId = secret.userId;
  const baseUrl = secret.baseUrl;
  const accessToken = secret.accessToken;

  // Populated by the root YomaLinkProvider's silent check; storage is
  // browser-only, so read after mount to keep SSR/hydration happy.
  const [yomaLink, setYomaLink] = useState<YomaLinkState | null>(null);
  useEffect(() => {
    if (did) setYomaLink(getCachedLink(did));
  }, [did]);

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

        // Throws "Incorrect PIN. Please try again." on a wrong PIN — shown
        // verbatim by PinModal.
        const mnemonic = decryptEncryptedMnemonic(encryptedMnemonic, pin);

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
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <GradientBand variant='yellow' />
      <Header onGradient title='Settings' onBack={goBack} />

      <main
        style={{
          position: 'relative',
          zIndex: 1,
          width: '100%',
          maxWidth: 'var(--max-width)',
          margin: '0 auto',
          padding: '0 20px var(--dock-clearance)',
          paddingTop: 'calc(var(--header-height) + 4px)',
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
        }}
      >
        {/* Admin-only entry point. Hidden unless the worker confirms the user is a whitelisted admin. */}
        {isAdmin && (
          <button
            className='status-item'
            style={{ width: '100%', marginBottom: 6 }}
            onClick={() => void router.push('/settings/entities')}
          >
            <span className='status-item__body'>
              <span className='status-item__title' style={{ display: 'block', fontSize: 15.5 }}>Admin Configuration</span>
              <span className='status-item__meta' style={{ display: 'block' }}>
                Manage entity whitelist and collection blacklist
              </span>
            </span>
            <ChevronRightIcon size={18} color='var(--text-secondary)' />
          </button>
        )}

        <Group title='Account' hint='Your account on the ixo network that identifies your transactions.'>
          <Row label='Address' icon={<WalletIcon size={20} />}>
            {address ? (
              <CopyChip value={address} label={shorten(address)} monospace />
            ) : (
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>—</span>
            )}
          </Row>
          <Row label='DID' icon={<BadgeCheckIcon size={20} />}>
            {did ? (
              <CopyChip value={did} label={shorten(did)} monospace />
            ) : (
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>—</span>
            )}
          </Row>
        </Group>

        <Group
          title='Data Store'
          hint='Credentials for your encrypted data store, where your claims, credentials and personal data are securely stored.'
        >
          <Row label='Username' icon={<UserRoundIcon size={20} />}>
            {userId ? (
              <CopyChip value={userId} label={shorten(userId)} monospace />
            ) : (
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>—</span>
            )}
          </Row>
          <Row label='Password' icon={<KeyRoundIcon size={20} />}>
            {revealed.password && secrets ? (
              <CopyChip value={secrets.password} label='Copy' />
            ) : (
              <ActionChip label='View' icon={<LockIcon />} onClick={() => handleView('password')} />
            )}
          </Row>
          <Row label='Passphrase' icon={<ShieldCheckIcon size={20} />}>
            {revealed.passphrase && secrets ? (
              <CopyChip value={secrets.passphrase} label='Copy' />
            ) : (
              <ActionChip label='View' icon={<LockIcon />} onClick={() => handleView('passphrase')} />
            )}
          </Row>
          <Row label='Access Token' icon={<CopyIcon size={20} />}>
            {accessToken ? (
              <CopyChip value={accessToken} label={shorten(accessToken)} monospace />
            ) : (
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>—</span>
            )}
          </Row>
          {/* PIN reset lives on the auth hub: fresh email sign-in there, new
              PIN chosen there — no old PIN needed (designer's "PIN Code" row). */}
          <Row label='PIN Code' icon={<FingerprintIcon size={20} />}>
            <ActionChip label='Reset' onClick={openPinResetFlow} />
          </Row>
        </Group>

        <Group title='Yoma Account'>
          <div style={{ padding: '12px 4px' }}>
            {yomaLink?.yomaId ? (
              <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                <span style={{ color: 'var(--green-primary)', fontWeight: 700 }}>Connected</span> — your completions
                count towards your Yoma rewards.
                {yomaLink.email ? (
                  <>
                    {' '}
                    Linked email: <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{yomaLink.email}</span>
                  </>
                ) : null}
              </p>
            ) : yomaLink?.email ? (
              <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Your email <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{yomaLink.email}</span> is
                verified, but no Yoma account with this email is linked yet. Make sure your Yoma account uses the same
                email.
              </p>
            ) : (
              <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Not connected to a Yoma account.
              </p>
            )}
          </div>
        </Group>

        <Group title='Email Notifications'>
          <div style={{ padding: '6px 4px' }}>
            <EmailNotifier />
          </div>
        </Group>

        <div style={{ flex: 1 }} />

        <button
          onClick={() => void logout()}
          className='btn btn--ghost btn--block'
          style={{ color: 'var(--error-color)', marginTop: 28, marginBottom: 8 }}
        >
          <LogOutIcon size={17} />
          <span>Logout</span>
        </button>
      </main>

      {pinModalFor && <PinModal onSuccess={handlePinSuccess} onCancel={() => setPinModalFor(null)} />}
    </div>
  );
}

function Group({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <div style={{ marginTop: 18 }}>
      <p className='muted' style={{ fontSize: 14, fontWeight: 600, margin: '0 0 6px 4px' }}>{title}</p>
      {hint && (
        <p className='muted' style={{ fontSize: 13, margin: '0 0 8px 4px', lineHeight: 1.5 }}>
          {hint}
        </p>
      )}
      <div className='card card--inset' style={{ padding: '4px 14px' }}>{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Row + chip primitives
// ---------------------------------------------------------------------------

function Row({ label, icon, children }: { label: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        padding: '12px 0',
      }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 12 }}>
        {icon && <span style={{ display: 'inline-flex', color: 'var(--text-primary)' }}>{icon}</span>}
        <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>{label}</span>
      </span>
      {children}
    </div>
  );
}

const chipBaseStyle = {
  borderRadius: '8px',
  border: 'none',
  background: 'var(--surface-2)',
  padding: '7px 12px',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '8px',
  cursor: 'pointer',
  color: 'var(--text-primary)',
  boxShadow: 'var(--shadow-soft)',
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
          fontFamily: monospace ? 'var(--font-mono)' : 'inherit',
          fontWeight: monospace ? 400 : 600,
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
