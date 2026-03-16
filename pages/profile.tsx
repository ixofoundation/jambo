import AuthGuard from '@components/AuthGuard';
import ProfileScreen from 'screens/profile';

export default function ProfilePage() {
  return (
    <AuthGuard>
      <ProfileScreen />
    </AuthGuard>
  );
}
