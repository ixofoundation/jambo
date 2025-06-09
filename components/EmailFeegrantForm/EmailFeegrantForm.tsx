import { useState, useEffect, useRef } from 'react';
import Button, { BUTTON_BG_COLOR, BUTTON_COLOR, BUTTON_SIZE } from '@components/Button/Button';
import { requestOTP, verifyOTP, queryOTPStatus } from '@utils/emailOtp';

interface EmailFeegrantFormProps {
  address: string;
  onSuccess: () => void;
  onError: (error: string) => void;
}

export default function EmailFeegrantForm({ address, onSuccess, onError }: EmailFeegrantFormProps) {
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [error, setError] = useState('');

  const errorCountRef = useRef(0);

  useEffect(
    function () {
      let timer: NodeJS.Timeout;
      if (countdown > 0) {
        timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      }
      return () => clearTimeout(timer);
    },
    [countdown],
  );

  function handleBack() {
    if (!otpSent) {
      onError('Cancelled email verification');
    } else {
      setOtpSent(false);
      setOtp('');
      setError('');
      errorCountRef.current = 0;
    }
  }

  async function handleRequestOTP() {
    if (!email) {
      setError('Please enter your email address');
      return;
    }

    if (!email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await requestOTP({
        email,
        ixoAddress: address,
      });

      setOtpSent(true);
      setCountdown(60); // 60 second cooldown
    } catch (err: any) {
      console.error('Failed to request OTP:', err);
      setError(err.message || 'Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOTP() {
    if (!otp) {
      setError('Please enter the OTP code');
      return;
    }

    if (otp.length !== 6) {
      setError('OTP must be 6 digits');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await verifyOTP({
        email,
        ixoAddress: address,
        otp,
      });

      console.log('OTP verified successfully:', response.message);
      onSuccess();
    } catch (err: any) {
      console.error('Failed to verify OTP:', err);
      if (errorCountRef.current < 3) {
        setError(err.message || 'Failed to verify OTP. Please try again.');
        errorCountRef.current += 1;
        return;
      }
      setOtpSent(false);
      setOtp('');
      setEmail('');
      setError('');
      errorCountRef.current = 0;
    } finally {
      setLoading(false);
    }
  }

  async function handleResendOTP() {
    if (countdown > 0) return;
    await handleRequestOTP();
  }

  return (
    <div>
      {!otpSent ? (
        <>
          <p style={{ marginBottom: '16px' }}>
            Please enter your email to receive a fee grant, which allows for limited free transactions, and enjoy
            exclusive community benefits.
          </p>

          <div style={{ marginBottom: '16px' }}>
            <label
              style={{
                display: 'block',
                marginBottom: '4px',
                fontSize: '14px',
                fontWeight: '500',
              }}
            >
              Email Address
            </label>
            <input
              type='email'
              placeholder='Enter your email address'
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #ced4da',
                borderRadius: '4px',
                fontSize: '14px',
              }}
              disabled={loading}
            />
          </div>

          <p style={{ fontSize: '12px' }}>
            <span style={{ color: 'var(--warning-color)', fontWeight: 500 }}>Note:</span> This is required to help you
            effortlessly set up your profile. Alternatively you can cover the gas fees by sending IXO tokens to your
            account (<strong>{address}</strong>).
          </p>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            {/* @ts-ignore */}
            <Button
              label='Back'
              color={BUTTON_COLOR.primary}
              size={BUTTON_SIZE.mediumLarge}
              bgColor={BUTTON_BG_COLOR.white}
              onClick={handleBack}
            />
            {/* @ts-ignore */}
            <Button
              label={loading ? 'Sending OTP...' : 'Next'}
              onClick={handleRequestOTP}
              disabled={loading || !email}
              color={BUTTON_COLOR.white}
              size={BUTTON_SIZE.mediumLarge}
              bgColor={BUTTON_BG_COLOR.primary}
            />
          </div>
        </>
      ) : (
        <>
          <div style={{ marginBottom: '16px' }}>
            <p style={{ marginBottom: '16px' }}>
              To prove you are the owner of this email, please enter the 6-digit code sent to <strong>{email}</strong>
            </p>
            <label
              style={{
                display: 'block',
                marginBottom: '4px',
                fontSize: '14px',
                fontWeight: '500',
              }}
            >
              Verification Code
            </label>
            <input
              type='text'
              placeholder='Enter 6-digit code'
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #ced4da',
                borderRadius: '4px',
                fontSize: '14px',
                textAlign: 'center',
                letterSpacing: '2px',
              }}
              disabled={loading}
              maxLength={6}
            />
          </div>

          <div style={{ marginBottom: '16px', alignItems: 'center' }}>
            {/* @ts-ignore */}
            <p
              style={{
                textAlign: 'center',
                marginBottom: '8px',
                color: countdown > 0 ? 'var(--text-color)' : 'var(--primary-color)',
              }}
              onClick={countdown > 0 ? undefined : handleResendOTP}
            >
              {countdown > 0 ? `Resend in ${countdown}s` : 'Resend Code'}
            </p>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            {/* @ts-ignore */}
            <Button
              label='Back'
              color={BUTTON_COLOR.primary}
              size={BUTTON_SIZE.mediumLarge}
              bgColor={BUTTON_BG_COLOR.white}
              onClick={handleBack}
            />
            {/* @ts-ignore */}
            <Button
              label={loading ? 'Verifying...' : 'Next'}
              onClick={handleVerifyOTP}
              disabled={loading || otp.length !== 6}
              color={BUTTON_COLOR.white}
              size={BUTTON_SIZE.mediumLarge}
              bgColor={BUTTON_BG_COLOR.primary}
            />
          </div>
        </>
      )}

      {error && (
        <p
          style={{
            color: 'red',
            fontSize: '14px',
            marginTop: '12px',
          }}
        >
          {error}
        </p>
      )}
    </div>
  );
}
