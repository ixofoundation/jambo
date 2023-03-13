import { useContext, useEffect, useState } from 'react';

import { WalletContext } from '@contexts/wallet';
import Loader from '@components/Loader/Loader';
import TokenCard from '@components/TokenCard/TokenCard';
import { groupWalletAssets } from '@utils/wallets';
import Card, { CARD_SIZE } from '@components/Card/Card';
import { TOKEN_BALANCE } from 'types/wallet';
import {
  getCoinImageUrlFromCurrencyToken,
  getDenomFromCurrencyToken,
  getDisplayDenomFromCurrencyToken,
  getTokenTypeFromCurrencyToken,
} from '@utils/currency';

type TokenListProps = {
  displayGradient?: boolean;
  onTokenClick: (denom: string) => void;
  filter?: (asset: TOKEN_BALANCE) => boolean;
};

const TokenList = ({ displayGradient, filter = () => true, onTokenClick }: TokenListProps) => {
  const [tokens, setTokens] = useState<TOKEN_BALANCE[] | undefined>();
  const { wallet } = useContext(WalletContext);

  useEffect(() => {
    const assets = groupWalletAssets(
      wallet.balances?.data ?? [],
      wallet.delegations?.data ?? [],
      wallet.unbondingDelegations?.data ?? [],
    );
    setTokens(assets);
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
