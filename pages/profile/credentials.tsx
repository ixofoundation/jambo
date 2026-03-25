import AuthGuard from '@components/AuthGuard';
import YomaCredentialsScreen from 'screens/yomaCredentials';

export default function YomaCredentialsPage() {
  return (
    <AuthGuard>
      <YomaCredentialsScreen />
    </AuthGuard>
  );
}
