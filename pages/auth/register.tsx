import GuestGuard from '@components/GuestGuard';
import ColorBlobBackground from '@components/ColorBlobBackground/ColorBlobBackground';
import RegisterPasskey from 'screens/registerPasskey';

export default function AuthRegisterPage() {
  return (
    <GuestGuard>
      <ColorBlobBackground style={{ minHeight: '100vh' }}>
        <RegisterPasskey />
      </ColorBlobBackground>
    </GuestGuard>
  );
}
