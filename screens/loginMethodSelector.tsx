import { useRouter } from 'next/router';
import Button, { BUTTON_BG_COLOR, BUTTON_COLOR, BUTTON_SIZE } from '@components/Button/Button';

function LoginMethodSelector() {
  const router = useRouter();

  function handleRegisterClick() {
    router.push('/auth/register');
  }

  function handleLoginClick() {
    router.push('/auth/login');
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
            borderRadius: '8px',
            padding: '20px',
            backgroundColor: 'rgba(0, 0, 0, 0.2)',
          }}
        >
          <h1
            style={{
              textAlign: 'center',
              marginBottom: '20px',
              color: 'white',
            }}
          >
            Welcome
          </h1>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            {/* @ts-ignore */}
            <Button
              label='Use Passkey'
              textCentered
              color={BUTTON_COLOR.primary}
              size={BUTTON_SIZE.mediumLarge}
              bgColor={BUTTON_BG_COLOR.white}
              onClick={handleLoginClick}
            />
            {/* @ts-ignore */}
            <Button
              label='Register Passkey'
              textCentered
              color={BUTTON_COLOR.primary}
              size={BUTTON_SIZE.mediumLarge}
              bgColor={BUTTON_BG_COLOR.white}
              onClick={handleRegisterClick}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoginMethodSelector;
