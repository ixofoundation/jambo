import { useEffect, useRef, useState } from 'react';

import { openPinResetFlow } from 'lib/authHub/pinReset';

const PIN_LENGTH = 6;

interface PinModalProps {
  onSuccess: (pin: string) => Promise<void>;
  onCancel: () => void;
  title?: string;
  helper?: string;
}

export default function PinModal({ onSuccess, onCancel, title = 'Data Store', helper = 'Enter your Data Store PIN' }: PinModalProps) {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        zIndex: 2200,
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
          borderRadius: 16,
          padding: '28px 24px',
          backgroundColor: 'var(--bg-secondary)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ width: '28px' }} />
          <h1 style={{ flex: 1, textAlign: 'center', margin: 0, color: 'var(--text-primary)', fontSize: '14px' }}>{title}</h1>
          <button
            onClick={onCancel}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              color: 'var(--text-secondary)',
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
                    border: isCurrent
                      ? '2px solid var(--accent-color)'
                      : '1px solid var(--border-color)',
                    backgroundColor: isCurrent ? 'var(--card-bg-color)' : 'var(--bg-primary)',
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
                        backgroundColor: 'var(--text-primary)',
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
                        backgroundColor: 'var(--text-secondary)',
                        opacity: 0.4,
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px', textAlign: 'center' }}>
          {helper}
        </p>

        {error && (
          <p style={{ color: 'var(--error-color)', fontSize: '13px', marginBottom: '12px', textAlign: 'center' }}>
            {error}
          </p>
        )}

        {loading && (
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', textAlign: 'center' }}>Verifying...</p>
        )}

        <button
          type='button'
          onClick={openPinResetFlow}
          style={{
            display: 'block',
            margin: '4px auto 0',
            background: 'none',
            border: 'none',
            padding: '4px',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: 600,
            color: 'var(--accent-color)',
          }}
        >
          Forgot your PIN? Reset it
        </button>
      </div>
    </div>
  );
}
