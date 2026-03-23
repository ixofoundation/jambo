import GuestGuard from '@components/GuestGuard';
import RegisterPasskey from 'screens/registerPasskey';

export default function AuthRegisterPage() {
  return (
    <GuestGuard>
      <RegisterPasskey />
    </GuestGuard>
  );
}
