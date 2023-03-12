import { ChainContext } from '@contexts/chain';
import { TOKEN_ASSET } from '@utils/currency';
import { getErrorMessage } from '@utils/misc';
import { useContext, useEffect, useState } from 'react';
import { DELEGATION, DELEGATION_REWARDS, UNBONDING_DELEGATION } from 'types/validators';
import { CURRENCY_TOKEN } from 'types/wallet';
import { QUERY_CLIENT } from 'types/query';

const defaultData = {
  loading: false,
  error: undefined,
  data: undefined,
};

type FetchWalletData = (
  queryClient: QUERY_CLIENT,
  chain: string,
  address: string,
  stakeCurrency: TOKEN_ASSET,
) => Promise<CURRENCY_TOKEN[] | DELEGATION[] | DELEGATION_REWARDS | UNBONDING_DELEGATION[] | undefined>;

type UseWalletData = {
  loading?: boolean;
  error?: string;
  data?: CURRENCY_TOKEN[] | DELEGATION[] | DELEGATION_REWARDS | UNBONDING_DELEGATION[];
};

type UseWalletDataReturn = [UseWalletData, () => void, () => void];

const useWalletData = (fetchData: FetchWalletData, address: string | undefined): UseWalletDataReturn => {
  const [data, setData] = useState<UseWalletData>(defaultData);

  const { chainInfo, queryClient } = useContext(ChainContext);

  const fetch = async () => {
    if (!queryClient || !address || !chainInfo) return;

    setData((prevState) => ({ ...prevState, loading: true, error: undefined }));
    try {
      const result = await fetchData(queryClient!, chainInfo?.chainName!, address, chainInfo?.stakeCurrency);
      setData((prevState) => ({ ...prevState, loading: false, data: result }));
    } catch (error) {
      setData((prevState) => ({ ...prevState, loading: false, error: getErrorMessage(error) }));
      console.error('useWalletData error::', error);
    }
  };

  const clear = () => setData(defaultData);

  useEffect(() => {
    if (!queryClient || !address || !chainInfo) setData({ loading: false, error: undefined, data: undefined });
    else fetch();
  }, [queryClient, address, chainInfo?.chainId]);

  return [data, fetch, clear];
};

export default useWalletData;
