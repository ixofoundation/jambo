import { useContext, useEffect, useState } from 'react';

import Card, { CARD_SIZE } from '@components/Card/Card';
import Loader from '@components/Loader/Loader';
import TokenCard from '@components/TokenCard/TokenCard';
import { WalletContext } from '@contexts/wallet';
import {
  getCoinImageUrlFromCurrencyToken,
  getDenomFromCurrencyToken,
  getDisplayDenomFromCurrencyToken,
  getTokenTypeFromCurrencyToken,
} from '@utils/currency';
import { groupWalletAssets, groupWalletSwapAssets } from '@utils/wallets';
import { CURRENCY_TOKEN, TOKEN_BALANCE } from 'types/wallet';

type TokenListProps = {
  displayGradient?: boolean;
  displaySwapOptions?: boolean;
  includeNonNativeTokens?: boolean;
  onTokenClick: (denom: string) => void;
  filter?: (asset: TOKEN_BALANCE) => boolean;
  options?: CURRENCY_TOKEN[];
};

const TokenList = ({
  displayGradient,
  displaySwapOptions,
  filter = () => true,
  onTokenClick,
  options,
  includeNonNativeTokens = false,
}: TokenListProps) => {
  const [tokens, setTokens] = useState<TOKEN_BALANCE[] | undefined>();
  const { wallet } = useContext(WalletContext);

  useEffect(() => {
    const balances = wallet.balances?.data ?? [];
    const assets = displaySwapOptions
      ? groupWalletSwapAssets(balances, wallet.tokenBalances?.data ?? [])
      : groupWalletAssets(
          balances,
          wallet.delegations?.data ?? [],
          wallet.unbondingDelegations?.data ?? [],
          includeNonNativeTokens ? wallet.tokenBalances?.data : [],
        );
    const optionDenoms = options?.map((option) => option.denom);
    setTokens(optionDenoms && optionDenoms.length ? assets.filter((a) => optionDenoms?.includes(a.denom)) : assets);
  }, [wallet.loading]);

  return (
    <>
      {!Array.isArray(tokens) || wallet.loading ? (
        <Loader size={30} />
      ) : tokens.length ? (
        tokens
          .filter(filter)
          .map(({ token, available, staked, undelegating }) => (
            <TokenCard
              displayGradient={displayGradient}
              denom={getDenomFromCurrencyToken(token)}
              image={getCoinImageUrlFromCurrencyToken(token)}
              displayDenom={getDisplayDenomFromCurrencyToken(token)}
              available={available}
              staked={staked}
              undelegating={undelegating}
              type={getTokenTypeFromCurrencyToken(token, token.chain)}
              key={getDenomFromCurrencyToken(token)}
              onTokenClick={onTokenClick}
            />
          ))
      ) : (
        <Card size={CARD_SIZE.large}>No Balances to Show</Card>
      )}
    </>
  );
};

export default TokenList;
