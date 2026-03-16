import GuestGuard from '@components/GuestGuard';
import ColorBlobBackground from '@components/ColorBlobBackground/ColorBlobBackground';
import LoginPasskey from 'screens/loginPasskey';

export default function AuthLoginPage() {
  return (
    <GuestGuard>
      <ColorBlobBackground style={{ minHeight: '100vh' }}>
        <LoginPasskey />
      </ColorBlobBackground>
    </GuestGuard>
  );
}
