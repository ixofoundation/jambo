import AuthGuard from '@components/AuthGuard';
import PiiDetailScreen from 'screens/piiDetail';

export default function PiiDetailPage() {
  return (
    <AuthGuard>
      <PiiDetailScreen />
    </AuthGuard>
  );
}
