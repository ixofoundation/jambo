import { useState, useRef } from 'react';
import Button, { BUTTON_BG_COLOR, BUTTON_COLOR, BUTTON_SIZE } from '@components/Button/Button';
import { decrypt } from '@utils/encryption';

interface MatrixPinFormProps {
  encryptedMnemonic?: string;
  onSuccess: (pin: string) => void;
  onError: (error: string) => void;
}

export default function MatrixPinForm({ encryptedMnemonic, onSuccess, onError }: MatrixPinFormProps) {
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const errorCountRef = useRef(0);

  function handleBack() {
    setPin('');
    setError('');
    errorCountRef.current = 0;
  }

  async function handleVerifyPin() {
    if (!pin || pin.length !== 6 || Number.isNaN(Number(pin))) {
      setError('Please enter a valid 6-digit pin');
      return;
    }

    setLoading(true);
    setError('');

    try {
      if (encryptedMnemonic) {
        const decryptedMnemonic = decrypt(encryptedMnemonic, pin);
        if (!decryptedMnemonic) {
          throw new Error('Incorrect pin');
        }
      }

      onSuccess(pin);
    } catch (err: any) {
      console.error('Failed to verify pin:', err);
      setError(err.message || 'Failed to verify pin. Please try again.');
      if (errorCountRef.current < 3) {
        setError(err.message || 'Failed to verify pin. Please try again.');
        errorCountRef.current += 1;
        return;
      }
      onError(err.message || 'Failed to verify matrix encryption pin.');
      setPin('');
      setError('');
      errorCountRef.current = 0;
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <p style={{ marginBottom: '16px' }}>
        {encryptedMnemonic
          ? 'Please enter your 6-digit pin to recover your matrix account.'
          : 'Please enter a new 6-digit pin to secure your matrix account.'}
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
          Matrix Pin
        </label>
        <input
          type='text'
          placeholder='Enter 6-digit pin'
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
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

      <p style={{ fontSize: '12px' }}>
        <span style={{ color: 'var(--warning-color)', fontWeight: 500 }}>Warning:</span>{' '}
        {encryptedMnemonic
          ? 'This pin is the only way to recover your matrix account.'
          : 'You must store your pin somewhere safe and never share it with anyone.'}
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
          label={loading ? 'Validating...' : 'Next'}
          onClick={handleVerifyPin}
          disabled={loading || !pin || pin.length < 6}
          color={BUTTON_COLOR.white}
          size={BUTTON_SIZE.mediumLarge}
          bgColor={BUTTON_BG_COLOR.primary}
        />
      </div>

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
