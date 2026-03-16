import { useState, useRef, useEffect } from 'react';
import Button, { BUTTON_BG_COLOR, BUTTON_COLOR, BUTTON_SIZE } from '@components/Button/Button';
import { decrypt } from '@utils/encryption';

interface MatrixPinFormProps {
  encryptedMnemonic?: string;
  onSuccess: (pin: string) => void;
  onError: (error: string) => void;
}

const PIN_LENGTH = 6;

type Step = 'set' | 'confirm';

export default function MatrixPinForm({ encryptedMnemonic, onSuccess, onError }: MatrixPinFormProps) {
  const [step, setStep] = useState<Step>(encryptedMnemonic ? 'confirm' : 'set');
  const [digits, setDigits] = useState<string[]>(Array(PIN_LENGTH).fill(''));
  const [confirmDigits, setConfirmDigits] = useState<string[]>(Array(PIN_LENGTH).fill(''));
  const [focused, setFocused] = useState(false);
  const [storedSafely, setStoredSafely] = useState(false);
  const [error, setError] = useState('');

  const errorCountRef = useRef(0);
  const hiddenInputRef = useRef<HTMLInputElement | null>(null);

  const pin = digits.join('');
  const confirmPin = confirmDigits.join('');
  const pinComplete = pin.length === PIN_LENGTH;

  // Auto-focus the hidden input on mount and when step changes
  useEffect(() => {
    setTimeout(() => hiddenInputRef.current?.focus(), 100);
  }, [step]);

  // For pin-only mode, auto-submit once 6 digits entered (no decryption)
  useEffect(() => {
    if (encryptedMnemonic === 'pin-only' && step === 'confirm' && confirmPin.length === PIN_LENGTH) {
      onSuccess(confirmPin);
    }
  }, [confirmDigits]);

  // For encrypted mnemonic (login) flow, auto-submit once 6 digits entered
  useEffect(() => {
    if (encryptedMnemonic && encryptedMnemonic !== 'pin-only' && step === 'confirm' && confirmPin.length === PIN_LENGTH) {
      handleVerifyExistingPin(confirmPin);
    }
  }, [confirmDigits]);

  // For new pin (register) flow, auto-submit confirm step
  useEffect(() => {
    if (!encryptedMnemonic && step === 'confirm' && confirmPin.length === PIN_LENGTH) {
      handleConfirmNewPin();
    }
  }, [confirmDigits]);

  function getActiveValues(): string[] {
    return step === 'set' ? digits : confirmDigits;
  }

  function setActiveDigits(newDigits: string[]) {
    if (step === 'set') {
      setDigits(newDigits);
    } else {
      setConfirmDigits(newDigits);
    }
  }

  function handleHiddenInput(value: string) {
    const cleaned = value.replace(/[^0-9]/g, '').slice(0, PIN_LENGTH);
    const newDigits = Array(PIN_LENGTH).fill('');
    for (let i = 0; i < cleaned.length; i++) {
      newDigits[i] = cleaned[i];
    }
    setActiveDigits(newDigits);
  }

  function focusHiddenInput() {
    hiddenInputRef.current?.focus();
  }

  function handleContinueToConfirm() {
    setError('');
    setConfirmDigits(Array(PIN_LENGTH).fill(''));
    setStep('confirm');
  }

  function handleBackToSet() {
    setError('');
    setConfirmDigits(Array(PIN_LENGTH).fill(''));
    setStep('set');
  }

  function handleConfirmNewPin() {
    const confirmed = confirmDigits.join('');
    if (confirmed !== pin) {
      setError('PINs do not match. Please try again.');
      setConfirmDigits(Array(PIN_LENGTH).fill(''));
      setTimeout(focusHiddenInput, 50);
      return;
    }
    onSuccess(pin);
  }

  async function handleVerifyExistingPin(enteredPin: string) {
    setError('');
    try {
      if (encryptedMnemonic) {
        const decryptedMnemonic = decrypt(encryptedMnemonic, enteredPin);
        if (!decryptedMnemonic) {
          throw new Error('Incorrect PIN');
        }
      }
      onSuccess(enteredPin);
    } catch (err: any) {
      console.error('Failed to verify pin:', err);
      if (errorCountRef.current < 3) {
        setError(err.message || 'Incorrect PIN. Please try again.');
        errorCountRef.current += 1;
        setConfirmDigits(Array(PIN_LENGTH).fill(''));
        setTimeout(focusHiddenInput, 50);
        return;
      }
      onError(err.message || 'Failed to verify Data Vault PIN.');
      setConfirmDigits(Array(PIN_LENGTH).fill(''));
      setError('');
      errorCountRef.current = 0;
    }
  }

  // --- Render pin boxes (plain function, NOT a component) ---
  function renderPinBoxes(values: string[]) {
    const filledCount = values.filter(Boolean).length;
    const activeIndex = Math.min(filledCount, PIN_LENGTH - 1);

    return (
      <div
        style={{ position: 'relative', marginBottom: '12px', cursor: 'pointer' }}
        onClick={focusHiddenInput}
      >
        {/* Single hidden input that captures all keyboard input */}
        <input
          ref={hiddenInputRef}
          type='text'
          inputMode='numeric'
          value={values.join('')}
          onChange={(e) => handleHiddenInput(e.target.value)}
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
        {/* Visual display boxes */}
        <div style={{ display: 'flex', gap: '8px', pointerEvents: 'none' }}>
          {values.map((digit, i) => {
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
                    ? '2px solid white'
                    : '1px solid rgba(255,255,255,0.3)',
                  backgroundColor: isCurrent
                    ? 'rgba(255,255,255,0.15)'
                    : 'rgba(255,255,255,0.08)',
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
    );
  }

  // ==========================================================================
  // RENDER: Encrypted mnemonic flow (login) — just confirm PIN
  // ==========================================================================
  if (encryptedMnemonic) {
    return (
      <>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ width: '28px' }} />
          <h1 style={{ flex: 1, textAlign: 'center', margin: 0, color: 'white', fontSize: '14px' }}>
            Data Vault
          </h1>
          <div style={{ width: '28px' }} />
        </div>

        {renderPinBoxes(confirmDigits)}

        <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '16px', textAlign: 'center' }}>
          Enter your Data Vault PIN
        </p>

        {error && (
          <p style={{ color: 'red', fontSize: '13px', marginBottom: '12px', textAlign: 'center' }}>{error}</p>
        )}
      </>
    );
  }

  // ==========================================================================
  // RENDER: New PIN flow (register) — set step
  // ==========================================================================
  if (step === 'set') {
    return (
      <>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ width: '28px' }} />
          <h1 style={{ flex: 1, textAlign: 'center', margin: 0, color: 'white', fontSize: '14px' }}>
            Set up Data Vault
          </h1>
          <div style={{ width: '28px' }} />
        </div>

        {renderPinBoxes(digits)}

        <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '16px', textAlign: 'center' }}>
          Set a 6 digit PIN
        </p>

        <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', marginBottom: '16px' }}>
          <span style={{ color: 'var(--warning-color)', fontWeight: 500 }}>WARNING:</span> Your Data Vault is your
          personal data storage. There is no way to retrieve your PIN if you lose it, so store it somewhere safely.
        </p>

        {error && (
          <p style={{ color: 'red', fontSize: '13px', marginBottom: '12px', textAlign: 'center' }}>{error}</p>
        )}

        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            marginBottom: '20px',
            cursor: 'pointer',
            fontSize: '13px',
            color: 'rgba(255,255,255,0.85)',
            padding: '12px',
            borderRadius: '8px',
            backgroundColor: 'rgba(0, 0, 0, 0.05)',
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
              border: storedSafely ? 'none' : '2px solid rgba(255,255,255,0.4)',
              backgroundColor: storedSafely ? 'var(--primary-color)' : 'transparent',
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
          I have stored my Data Vault PIN somewhere safely.
        </label>

        {/* @ts-ignore */}
        <Button
          label='Continue'
          onClick={handleContinueToConfirm}
          disabled={!pinComplete || !storedSafely}
          color={BUTTON_COLOR.primary}
          size={BUTTON_SIZE.mediumLarge}
          bgColor={BUTTON_BG_COLOR.white}
          style={{ width: '100%' }}
        />
      </>
    );
  }

  // ==========================================================================
  // RENDER: New PIN flow (register) — confirm step
  // ==========================================================================
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
        <button
          onClick={handleBackToSet}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '4px',
            fontSize: '20px',
            lineHeight: 1,
            color: 'white',
          }}
        >
          &#8592;
        </button>
        <h1 style={{ flex: 1, textAlign: 'center', margin: 0, color: 'white', fontSize: '14px' }}>
          Set up Data Vault
        </h1>
        <div style={{ width: '28px' }} />
      </div>

      {renderPinBoxes(confirmDigits)}

      <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '16px', textAlign: 'center' }}>
        Confirm your Data Vault PIN
      </p>

      {error && (
        <p style={{ color: 'red', fontSize: '13px', marginBottom: '12px', textAlign: 'center' }}>{error}</p>
      )}
    </>
  );
}
