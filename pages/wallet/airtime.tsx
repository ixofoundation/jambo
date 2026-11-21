import { useEffect } from 'react';
import { useRouter } from 'next/router';

import AuthGuard from '@components/AuthGuard';
import { AIRTIME_SWAP_ENABLED } from '@constants/airtimeVoucher';
import AirtimeSwapScreen from 'screens/airtimeSwap';

/** Get airtime. Without `NEXT_PUBLIC_AIRTIME_VOUCHER_URL` the feature does not exist: back to the wallet. */
export default function AirtimeSwapPage() {
  const router = useRouter();

  useEffect(() => {
    if (!AIRTIME_SWAP_ENABLED) void router.replace('/wallet');
  }, [router]);

  if (!AIRTIME_SWAP_ENABLED) return null;

  return (
    <AuthGuard>
      <AirtimeSwapScreen />
    </AuthGuard>
  );
}
