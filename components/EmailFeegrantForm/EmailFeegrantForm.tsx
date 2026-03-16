import { useState, useEffect, useRef, CSSProperties, KeyboardEvent } from 'react';
import Button, { BUTTON_BG_COLOR, BUTTON_COLOR, BUTTON_SIZE } from '@components/Button/Button';
import Loader from '@components/Loader/Loader';
import { requestOTP, verifyOTP } from '@utils/emailOtp';

type Step = 'email' | 'sendingOtp' | 'otpInput' | 'verifyingOtp';

interface EmailFeegrantFormProps {
  address: string;
  onSuccess: () => void;
  onError: (error: string) => void;
}

const OTP_LENGTH = 6;

export default function EmailFeegrantForm({ address, onSuccess, onError }: EmailFeegrantFormProps) {
  const [email, setEmail] = useState('');
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const [step, setStep] = useState<Step>('email');
  const [countdown, setCountdown] = useState(0);
  const [error, setError] = useState('');

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const errorCountRef = useRef(0);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  // Auto-submit when all 6 digits entered
  useEffect(() => {
    const otp = digits.join('');
    if (otp.length === OTP_LENGTH && step === 'otpInput') {
      handleVerifyOTP(otp);
    }
  }, [digits]);

  function handleBack() {
    if (step === 'email') {
      onError('Cancelled email verification');
    } else if (step === 'otpInput') {
      setStep('email');
      setDigits(Array(OTP_LENGTH).fill(''));
      setError('');
      errorCountRef.current = 0;
    }
  }

  async function handleRequestOTP() {
    if (!email || !isValidEmail) return;

    setStep('sendingOtp');
    setError('');

    try {
      await requestOTP({ email, ixoAddress: address });
      setStep('otpInput');
      setCountdown(60);
      // Focus first input after render
      setTimeout(() => inputRefs.current[0]?.focus(), 50);
    } catch (err: any) {
      console.error('Failed to request OTP:', err);
      setError(err.message || 'Failed to send OTP. Please try again.');
      setStep('email');
    }
  }

  async function handleVerifyOTP(otp: string) {
    setStep('verifyingOtp');
    setError('');

    try {
      const response = await verifyOTP({ email, ixoAddress: address, otp });
      console.log('OTP verified successfully:', response.message);
      onSuccess();
    } catch (err: any) {
      console.error('Failed to verify OTP:', err);
      if (errorCountRef.current < 3) {
        setError(err.message || 'Failed to verify OTP. Please try again.');
        errorCountRef.current += 1;
        setStep('otpInput');
        setDigits(Array(OTP_LENGTH).fill(''));
        setTimeout(() => inputRefs.current[0]?.focus(), 50);
        return;
      }
      setStep('email');
      setDigits(Array(OTP_LENGTH).fill(''));
      setEmail('');
      setError('');
      errorCountRef.current = 0;
    }
  }

  async function handleResendOTP() {
    if (countdown > 0) return;
    setDigits(Array(OTP_LENGTH).fill(''));
    setStep('sendingOtp');
    setError('');

    try {
      await requestOTP({ email, ixoAddress: address });
      setStep('otpInput');
      setCountdown(60);
      setTimeout(() => inputRefs.current[0]?.focus(), 50);
    } catch (err: any) {
      console.error('Failed to resend OTP:', err);
      setError(err.message || 'Failed to resend OTP. Please try again.');
      setStep('otpInput');
    }
  }

  function handleDigitChange(index: number, value: string) {
    const digit = value.replace(/[^0-9]/g, '').slice(-1);
    const newDigits = [...digits];
    newDigits[index] = digit;
    setDigits(newDigits);

    if (digit && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleDigitKeyDown(index: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  function handleDigitPaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pasted = e.clipboardData
      .getData('text')
      .replace(/[^0-9]/g, '')
      .slice(0, OTP_LENGTH);
    if (!pasted) return;
    const newDigits = [...digits];
    for (let i = 0; i < pasted.length; i++) {
      newDigits[i] = pasted[i];
    }
    setDigits(newDigits);
    const nextIndex = Math.min(pasted.length, OTP_LENGTH - 1);
    inputRefs.current[nextIndex]?.focus();
  }

  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  // --- Shared header component ---
  function Header({ title, onBack: onBackClick }: { title: string; onBack: () => void }) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
        <button
          onClick={onBackClick}
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
        <h1 style={{ flex: 1, textAlign: 'center', margin: 0, color: 'white', fontSize: '14px' }}>{title}</h1>
        <div style={{ width: '28px' }} />
      </div>
    );
  }

  // --- Loading screen ---
  function LoadingScreen({ text }: { text: string }) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '40px 0',
        }}
      >
        {/* @ts-ignore */}
        <Loader />
        <p style={{ marginTop: '16px', color: 'rgba(255,255,255,0.7)', fontSize: '14px', textAlign: 'center' }}>
          {text}
        </p>
      </div>
    );
  }

  // ==========================================================================
  // RENDER
  // ==========================================================================

  // Step: Sending OTP loading
  if (step === 'sendingOtp') {
    return (
      <div>
        <LoadingScreen text='Sending verification code to your email...' />
      </div>
    );
  }

  // Step: Verifying OTP loading
  if (step === 'verifyingOtp') {
    return (
      <div>
        <Header title='Creating new account' onBack={handleBack} />
        <LoadingScreen text='Requesting fee grant...' />
      </div>
    );
  }

  // Step: OTP input
  if (step === 'otpInput') {
    const otpBoxBase: CSSProperties = {
      width: '100%',
      aspectRatio: '1',
      textAlign: 'center',
      fontSize: '20px',
      fontWeight: 600,
      color: 'white',
      border: '1px solid rgba(255,255,255,0.3)',
      borderRadius: '8px',
      backgroundColor: 'rgba(255,255,255,0.08)',
      outline: 'none',
      boxSizing: 'border-box',
      caretColor: 'transparent',
    };

    return (
      <div>
        <Header title='Get a Fee Grant' onBack={handleBack} />

        <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.8)', marginBottom: '20px' }}>
          Your confirmation code has been sent to <strong style={{ color: 'white' }}>{email}</strong>
        </p>

        {/* OTP boxes */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          {digits.map((digit, i) => {
            const isFocused = focusedIndex === i;
            const isEmpty = !digit;

            return (
              <div key={i} style={{ flex: 1, position: 'relative' }}>
                <input
                  ref={(el) => {
                    inputRefs.current[i] = el;
                  }}
                  type='text'
                  inputMode='numeric'
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleDigitChange(i, e.target.value)}
                  onKeyDown={(e) => handleDigitKeyDown(i, e)}
                  onPaste={i === 0 ? handleDigitPaste : undefined}
                  onFocus={() => setFocusedIndex(i)}
                  onBlur={() => setFocusedIndex(null)}
                  style={{
                    ...otpBoxBase,
                    borderColor: isFocused ? 'white' : 'rgba(255,255,255,0.3)',
                    borderWidth: isFocused ? '2px' : '1px',
                    backgroundColor: isFocused ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.08)',
                  }}
                />
                {/* Empty indicator dot */}
                {isEmpty && !isFocused && (
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
                      pointerEvents: 'none',
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>

        <p
          style={{
            fontSize: '12px',
            textAlign: 'center',
            color: 'rgba(255,255,255,0.5)',
            marginBottom: '16px',
          }}
        >
          Enter your confirmation code
        </p>

        {error && <p style={{ color: 'red', fontSize: '13px', marginBottom: '12px', textAlign: 'center' }}>{error}</p>}

        {/* Resend button */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <button
            onClick={countdown > 0 ? undefined : handleResendOTP}
            disabled={countdown > 0}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '13px',
              padding: '8px 16px',
              cursor: countdown > 0 ? 'default' : 'pointer',
              color: countdown > 0 ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.8)',
              textDecoration: countdown > 0 ? 'none' : 'underline',
            }}
          >
            {countdown > 0 ? `Resend in ${countdown}s` : 'Resend code'}
          </button>
        </div>
      </div>
    );
  }

  // Step: Email input (default)
  return (
    <div>
      <Header title='Get a Fee Grant' onBack={handleBack} />

      <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.8)', marginBottom: '12px' }}>
        Every blockchain transaction takes a tiny amount of fees. We are making the onboarding for our users easier by
        providing a Fee Grant, that makes your blockchain transactions free.
      </p>

      <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.8)', marginBottom: '20px' }}>
        Please provide a valid email address, where you will receive a confirmation code to activate your fee grant. We
        do not use the email address for anything else.
      </p>

      <div style={{ marginBottom: '20px' }}>
        <input
          type='email'
          placeholder='Email address'
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{
            width: '100%',
            padding: '12px 14px',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '8px',
            fontSize: '14px',
            backgroundColor: 'rgba(0, 0, 0, 0.2)',
            color: 'white',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
      </div>

      {error && <p style={{ color: 'red', fontSize: '13px', marginBottom: '12px' }}>{error}</p>}

      {/* @ts-ignore */}
      <Button
        label='Continue'
        onClick={handleRequestOTP}
        disabled={!isValidEmail}
        color={BUTTON_COLOR.primary}
        size={BUTTON_SIZE.mediumLarge}
        bgColor={BUTTON_BG_COLOR.white}
        style={{ width: '100%' }}
      />
    </div>
  );
}
