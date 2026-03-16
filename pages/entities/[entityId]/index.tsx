import AuthGuard from '@components/AuthGuard';
import Dashboard from 'screens/dashboard';

export default function EntityPage() {
  return (
    <AuthGuard>
      <Dashboard />
    </AuthGuard>
  );
}
