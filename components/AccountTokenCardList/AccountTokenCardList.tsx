import { FC, useContext, useEffect, useState } from 'react';

import utilsStyles from '@styles/utils.module.scss';
import { GradientTokenCard } from '@components/TokenCard/TokenCard';
import Card, { CARD_SIZE } from '@components/Card/Card';
import Loader from '@components/Loader/Loader';
import { groupWalletAssets } from '@utils/wallets';
import { getDenomFromCurrencyToken } from '@utils/currency';
import { WalletContext } from '@contexts/wallet';
import { TOKEN_BALANCE } from 'types/wallet';

type AccountTokenCardListProps = {
  onTokenClick: (denom: string) => void;
};

const AccountTokenCardList: FC<AccountTokenCardListProps> = ({ onTokenClick }) => {
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

  if (!Array.isArray(tokens) || wallet.loading)
    return (
      <div className={utilsStyles.columnCenter}>
        <Loader size={30} />
      </div>
    );

  if (!tokens.length) return <Card size={CARD_SIZE.large}>No Balances to Show</Card>;

  return (
    <>
      {tokens.map(({ token, available, staked, undelegating }) => (
        <GradientTokenCard
          token={token}
          available={available ?? 0}
          staked={staked ?? 0}
          undelegating={undelegating ?? 0}
          key={getDenomFromCurrencyToken(token)}
          onTokenClick={onTokenClick}
        />
      ))}
    </>
  );
};

export default AccountTokenCardList;
