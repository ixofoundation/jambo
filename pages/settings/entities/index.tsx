import AuthGuard from '@components/AuthGuard';
import AdminGuard from '@components/AdminGuard';
import SettingsEntitiesScreen from 'screens/settingsEntities';

export default function SettingsEntitiesPage() {
  return (
    <AuthGuard>
      <AdminGuard>
        <SettingsEntitiesScreen />
      </AdminGuard>
    </AuthGuard>
  );
}
