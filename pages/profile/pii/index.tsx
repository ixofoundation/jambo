import AuthGuard from '@components/AuthGuard';
import PiiListScreen from 'screens/piiList';

export default function PiiListPage() {
  return (
    <AuthGuard>
      <PiiListScreen />
    </AuthGuard>
  );
}
