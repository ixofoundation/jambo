import Button, { BUTTON_BG_COLOR, BUTTON_COLOR, BUTTON_SIZE } from '@components/Button/Button';

interface LoginMethodSelectorProps {
  onSelectMethod: (method: 'register' | 'login' | 'mnemonic') => void;
}

function LoginMethodSelector({ onSelectMethod }: LoginMethodSelectorProps) {
  function handleRegisterClick() {
    onSelectMethod('register');
  }

  function handleLoginClick() {
    onSelectMethod('login');
  }

  function handleMnemonicClick() {
    onSelectMethod('mnemonic');
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        padding: '20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '400px',
        }}
      >
        <div
          style={{
            border: '1px solid #e9ecef',
            borderRadius: '8px',
            padding: '24px',
            backgroundColor: 'white',
          }}
        >
          <h2
            style={{
              textAlign: 'center',
              marginBottom: '24px',
            }}
          >
            Select how you would like to continue.
          </h2>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            {/* @ts-ignore */}
            <Button
              label='Register Passkey'
              color={BUTTON_COLOR.white}
              size={BUTTON_SIZE.mediumLarge}
              bgColor={BUTTON_BG_COLOR.primary}
              onClick={handleRegisterClick}
            />
            {/* @ts-ignore */}
            <Button
              label='Login with Passkey'
              color={BUTTON_COLOR.white}
              size={BUTTON_SIZE.mediumLarge}
              bgColor={BUTTON_BG_COLOR.primary}
              onClick={handleLoginClick}
            />
            {/* @ts-ignore */}
            <Button
              label='Login with Mnemonic'
              color={BUTTON_COLOR.white}
              size={BUTTON_SIZE.mediumLarge}
              bgColor={BUTTON_BG_COLOR.primary}
              onClick={handleMnemonicClick}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoginMethodSelector;
