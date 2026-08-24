import AuthGuard from '@components/AuthGuard';
import Deck from 'screens/deck';

export default function HomePage() {
  return (
    <AuthGuard>
      <Deck />
    </AuthGuard>
  );
}
