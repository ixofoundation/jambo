import { FC } from 'react';

import utilsStyles from '@styles/utils.module.scss';
import TokenCard from '@components/TokenCard/TokenCard';
import Card, { CARD_SIZE } from '@components/Card/Card';
import Loader from '@components/Loader/Loader';
import { getDenomFromCurrencyToken } from '@utils/currency';
import { CURRENCY_TOKEN } from 'types/wallet';

type TokenCardListProps = {
  loading?: boolean;
  emptyMessage: string;
  tokens: CURRENCY_TOKEN[];
  onTokenClick: (denom: string) => void;
  filter?: (asset: CURRENCY_TOKEN) => boolean;
};

const TokenCardList: FC<TokenCardListProps> = ({
  tokens,
  loading,
  filter = () => true,
  onTokenClick,
  emptyMessage,
}) => {
  if (loading)
    return (
      <div className={utilsStyles.columnCenter}>
        <Loader size={30} />
      </div>
    );

  if (!tokens.length) return <Card size={CARD_SIZE.large}>{emptyMessage ?? 'No tokens available'}</Card>;

  return (
    <>
      {tokens.filter(filter).map((token) => (
        <TokenCard token={token} onTokenClick={onTokenClick} key={getDenomFromCurrencyToken(token)} />
      ))}
    </>
  );
};

export default TokenCardList;
