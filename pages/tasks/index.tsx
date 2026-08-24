import AuthGuard from '@components/AuthGuard';
import Tasks from 'screens/tasks';

export default function TasksPage() {
  return (
    <AuthGuard>
      <Tasks />
    </AuthGuard>
  );
}
