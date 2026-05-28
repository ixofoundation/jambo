import AuthGuard from '@components/AuthGuard';
import CredentialDetailScreen from 'screens/credentialDetail';

export default function CredentialDetailPage() {
  return (
    <AuthGuard>
      <CredentialDetailScreen />
    </AuthGuard>
  );
}
