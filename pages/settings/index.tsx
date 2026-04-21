import AuthGuard from '@components/AuthGuard';
import SettingsScreen from 'screens/settings';

export default function SettingsPage() {
  return (
    <AuthGuard>
      <SettingsScreen />
    </AuthGuard>
  );
}
