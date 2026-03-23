import GuestGuard from '@components/GuestGuard';
import LoginPasskey from 'screens/loginPasskey';

export default function AuthLoginPage() {
  return (
    <GuestGuard>
      <LoginPasskey />
    </GuestGuard>
  );
}
