import AuthGuard from '@components/AuthGuard';
import ProjectList from 'screens/projectList';

export default function EntitiesPage() {
  return (
    <AuthGuard>
      <ProjectList />
    </AuthGuard>
  );
}
