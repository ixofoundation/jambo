import { useContext, useEffect, useState } from 'react';

import { WalletContext } from '@contexts/wallet';
import { ChainContext } from '@contexts/chain';
import Loader from '@components/Loader/Loader';
import TokenCard from '@components/TokenCard/TokenCard';
import { groupWalletAssets } from '@utils/wallets';
import { extractStakingTokenDenomFromChainInfo } from '@utils/chains';
import Card, { CARD_SIZE } from '@components/Card/Card';
import { TOKEN_BALANCE } from 'types/wallet';
import { getTokenTypeFromCurrencyToken } from '@utils/currency';

type TokenListProps = {
  filter?: (asset: TOKEN_BALANCE) => boolean;
  onTokenClick: (denom: string) => void;
};

const TokenList = ({ filter = () => true, onTokenClick }: TokenListProps) => {
  const [tokens, setTokens] = useState<TOKEN_BALANCE[] | undefined>();
  const { wallet } = useContext(WalletContext);
  const { chainInfo } = useContext(ChainContext);

  useEffect(() => {
    const assets = groupWalletAssets(
      wallet.balances?.balances ?? [],
      wallet.delegations?.delegations ?? [],
      wallet.unbonding?.unbonding ?? [],
      extractStakingTokenDenomFromChainInfo(chainInfo) || '',
    );
    setTokens(assets);
  }, [wallet.balances?.loading, wallet.delegations?.loading, wallet.unbonding?.loading]);

  return (
    <>
      {!Array.isArray(tokens) ? (
        <Loader size={30} />
      ) : tokens.length ? (
        tokens
          .filter(filter)
          .map((token) => (
            <TokenCard
              displayGradient
              denom={token.denom}
              image={token.token.token?.coinImageUrl}
              displayDenom={token?.token?.token?.coinDenom ?? token.token.denom ?? token.denom}
              available={token.available}
              staked={token.staked}
              undelegating={token.undelegating}
              type={getTokenTypeFromCurrencyToken(token.token, chainInfo?.chainName)}
              key={token.denom}
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
