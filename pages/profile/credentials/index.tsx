import AuthGuard from '@components/AuthGuard';
import CredentialsListScreen from 'screens/credentialsList';

export default function CredentialsListPage() {
  return (
    <AuthGuard>
      <CredentialsListScreen />
    </AuthGuard>
  );
}
