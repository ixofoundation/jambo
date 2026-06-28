import AuthGuard from '@components/AuthGuard';
import OfframpScreen from 'screens/offramp';

export default function OfframpPage() {
  return (
    <AuthGuard>
      <OfframpScreen />
    </AuthGuard>
  );
}
