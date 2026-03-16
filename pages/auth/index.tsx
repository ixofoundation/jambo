import GuestGuard from '@components/GuestGuard';
import ColorBlobBackground from '@components/ColorBlobBackground/ColorBlobBackground';
import LoginMethodSelector from 'screens/loginMethodSelector';

export default function AuthPage() {
  return (
    <GuestGuard>
      <ColorBlobBackground style={{ minHeight: '100vh' }}>
        <LoginMethodSelector />
      </ColorBlobBackground>
    </GuestGuard>
  );
}
