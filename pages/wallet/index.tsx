import AuthGuard from '@components/AuthGuard';
import Wallet from 'screens/wallet';

export default function WalletPage() {
  return (
    <AuthGuard>
      <Wallet />
    </AuthGuard>
  );
}
