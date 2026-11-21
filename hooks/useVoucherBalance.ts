import { useEffect, useState } from 'react';

import { AIRTIME_SWAP_ENABLED, AIRTIME_VOUCHER_URL } from '@constants/airtimeVoucher';
import { useAuth } from '@hooks/useAuth';
import { getVoucherBalance } from 'lib/airtimeVoucher/balance';

/**
 * The signed-in holder's airtime vouchers, in rand, for display. Null until
 * the first good read, and it keeps the last good read when a later one
 * fails: unknown is never shown as zero. `refresh` re-reads when it changes.
 */
export default function useVoucherBalance(refresh: unknown = 0): number | null {
  const { address } = useAuth();
  const [held, setHeld] = useState<{ address: string; rand: number } | null>(null);

  useEffect(() => {
    if (!AIRTIME_SWAP_ENABLED || !address) return;
    let cancelled = false;
    void getVoucherBalance(AIRTIME_VOUCHER_URL, address).then((rand) => {
      if (!cancelled && rand !== null) setHeld({ address, rand });
    });
    return () => {
      cancelled = true;
    };
  }, [address, refresh]);

  return held && held.address === address ? held.rand : null;
}
