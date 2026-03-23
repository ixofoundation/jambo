import { CSSProperties, useState } from 'react';
import Button, { BUTTON_BG_COLOR, BUTTON_COLOR, BUTTON_SIZE } from '@components/Button/Button';

interface SecretPhraseStepProps {
  mnemonic: string;
  error?: string | null;
  onBack: () => void;
  onContinue: () => void;
}

const actionButtonBase: CSSProperties = {
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '6px',
  border: 'none',
  borderRadius: '6px',
  cursor: 'pointer',
  fontSize: '14px',
  fontWeight: 500,
  padding: '10px 12px',
  color: 'var(--text-primary)',
};

export default function SecretPhraseStep({ mnemonic, error, onBack, onContinue }: SecretPhraseStepProps) {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const [storedSafely, setStoredSafely] = useState(false);

  const words = mnemonic ? mnemonic.split(' ') : [];

  function handleCopy() {
    navigator.clipboard.writeText(mnemonic);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  }

  return (
    <>
      {/* Header with back arrow and centered title */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
        <button
          onClick={onBack}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '4px',
            fontSize: '20px',
            lineHeight: 1,
            color: 'var(--text-primary)',
          }}
        >
          &#8592;
        </button>
        <h1 style={{ flex: 1, textAlign: 'center', margin: 0, color: 'var(--text-primary)', fontSize: '14px' }}>
          Secret Phrase
        </h1>
        {/* Spacer to balance the back arrow */}
        <div style={{ width: '28px' }} />
      </div>

      {/* Word grid with overlay */}
      <div style={{ position: 'relative', marginBottom: '16px' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '8px',
          }}
        >
          {words.map((word, i) => (
            <div
              key={i}
              style={{
                backgroundColor: 'var(--bg-primary)',
                borderRadius: '6px',
                padding: '10px 6px',
                textAlign: 'center',
                fontSize: '13px',
                color: visible ? 'var(--text-primary)' : 'transparent',
                userSelect: visible ? 'text' : 'none',
              }}
            >
              {visible ? word : '\u00A0'}
            </div>
          ))}
        </div>
        {/* Password-hidden icon overlay */}
        {!visible && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
            }}
          >
            <svg
              width='40'
              height='40'
              viewBox='0 0 24 24'
              fill='none'
              stroke='var(--text-secondary)'
              strokeWidth='2'
              strokeLinecap='round'
              strokeLinejoin='round'
            >
              <path d='M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94' />
              <path d='M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19' />
              <path d='M14.12 14.12a3 3 0 1 1-4.24-4.24' />
              <line x1='1' y1='1' x2='23' y2='23' />
            </svg>
          </div>
        )}
      </div>

      {/* Show/Hide and Copy action buttons */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <button
          onClick={() => setVisible((v) => !v)}
          style={{
            ...actionButtonBase,
            backgroundColor: visible ? 'var(--bg-primary)' : 'transparent',
          }}
        >
          {/* Eye / Eye-off icon */}
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
            {visible ? (
              <>
                <path d='M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94' />
                <path d='M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19' />
                <path d='M14.12 14.12a3 3 0 1 1-4.24-4.24' />
                <line x1='1' y1='1' x2='23' y2='23' />
              </>
            ) : (
              <>
                <path d='M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z' />
                <circle cx='12' cy='12' r='3' />
              </>
            )}
          </svg>
          {visible ? 'Hide' : 'Show'}
        </button>
        <button
          onClick={handleCopy}
          style={{
            ...actionButtonBase,
            backgroundColor: copied ? 'var(--bg-primary)' : 'transparent',
          }}
        >
          {/* Copy / Check icon */}
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
            {copied ? (
              <polyline points='20 6 9 17 4 12' />
            ) : (
              <>
                <rect x='9' y='9' width='13' height='13' rx='2' ry='2' />
                <path d='M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1' />
              </>
            )}
          </svg>
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>

      {/* Warning */}
      <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
        <span style={{ color: 'var(--yellow-primary)', fontWeight: 500 }}>WARNING:</span> Your Secret Phrase is the key
        to your account and your backup. Store this phrase somewhere safe (offline) and don&apos;t share it with anyone.
      </p>

      {error && <p style={{ color: 'red', fontSize: '14px', marginBottom: '16px' }}>{error}</p>}

      {/* Checkbox */}
      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          marginBottom: '20px',
          cursor: 'pointer',
          fontSize: '13px',
          color: 'var(--text-primary)',
          padding: '12px',
          borderRadius: '12px',
          backgroundColor: 'var(--bg-primary)',
          transition: 'border-color 0.2s',
        }}
      >
        <input
          type='checkbox'
          checked={storedSafely}
          onChange={(e) => setStoredSafely(e.target.checked)}
          style={{ display: 'none' }}
        />
        <div
          style={{
            width: '20px',
            height: '20px',
            minWidth: '20px',
            borderRadius: '4px',
            border: storedSafely ? 'none' : '2px solid var(--border-color)',
            backgroundColor: storedSafely ? 'var(--accent-color)' : 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background-color 0.2s, border 0.2s',
          }}
        >
          {storedSafely && (
            <svg
              width='12'
              height='12'
              viewBox='0 0 24 24'
              fill='none'
              stroke='white'
              strokeWidth='3'
              strokeLinecap='round'
              strokeLinejoin='round'
            >
              <polyline points='20 6 9 17 4 12' />
            </svg>
          )}
        </div>
        I have stored my Secret Phrase somewhere safely.
      </label>

      {/* Continue button */}
      {/* @ts-ignore */}
      <Button
        label='Continue'
        onClick={onContinue}
        disabled={!storedSafely}
        color={BUTTON_COLOR.white}
        size={BUTTON_SIZE.mediumLarge}
        bgColor={BUTTON_BG_COLOR.primary}
        style={{ width: '100%' }}
      />
    </>
  );
}
