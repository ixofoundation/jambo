import { useRouter } from 'next/router';
import Button, { BUTTON_BG_COLOR, BUTTON_COLOR, BUTTON_SIZE } from '@components/Button/Button';
import GradientBand from '@components/GradientBand/GradientBand';
import AuthHeader from '@components/AuthHeader/AuthHeader';
import { GRADIENT_COLORS } from '@constants/gradientColors';

function LoginMethodSelector() {
  const router = useRouter();

  function handleLoginClick() {
    router.push('/auth/passkey');
  }

  return (
    <div
      style={{
        position: 'relative',
        minHeight: '100vh',
        padding: '20px',
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      <GradientBand {...GRADIENT_COLORS.auth} fullScreen />
      <AuthHeader />
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          width: '100%',
          maxWidth: '400px',
          marginTop: 'calc(30vh - 50px)',
        }}
      >
        <div
          style={{
            borderRadius: '12px',
            padding: '20px',
            backgroundColor: 'var(--bg-secondary)',
          }}
        >
          <h1
            style={{
              textAlign: 'center',
              marginBottom: '20px',
              color: 'var(--text-primary)',
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
              label='Connect'
              textCentered
              color={BUTTON_COLOR.white}
              size={BUTTON_SIZE.mediumLarge}
              bgColor={BUTTON_BG_COLOR.primary}
              onClick={handleLoginClick}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoginMethodSelector;
