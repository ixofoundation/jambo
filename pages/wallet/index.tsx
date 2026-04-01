import AuthGuard from '@components/AuthGuard';
import WalletScreen from 'screens/wallet';

export default function WalletPage() {
  return (
    <AuthGuard>
      <WalletScreen />
    </AuthGuard>
  );
}
