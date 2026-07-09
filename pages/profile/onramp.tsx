import AuthGuard from '@components/AuthGuard';
import OnrampScreen from 'screens/onramp';

export default function OnrampPage() {
  return (
    <AuthGuard>
      <OnrampScreen />
    </AuthGuard>
  );
}
