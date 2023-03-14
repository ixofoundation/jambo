import { ChangeEvent, FC, useEffect, useState } from 'react';

import styles from './TokenSelector.module.scss';
import InputWithSuffixIcon from '@components/InputWithSuffixIcon/InputWithSuffixIcon';
import ColoredIcon, { ICON_COLOR } from '@components/ColoredIcon/ColoredIcon';
import ImageWithFallback from '@components/ImageFallback/ImageFallback';
import Card, { CARD_BG_COLOR, CARD_SIZE } from '@components/Card/Card';
import BottomSheet from '@components/BottomSheet/BottomSheet';
import TokenList from '@components/TokenList/TokenList';
import ChevronDown from '@icons/chevron_down.svg';
import Search from '@icons/search.svg';
import { getDenomFromCurrencyToken, getDisplayDenomFromCurrencyToken } from '@utils/currency';
import useModalState from '@hooks/useModalState';
import { CURRENCY_TOKEN } from 'types/wallet';

type TokenSelectorProps = {
  // showDropdown?: boolean;
  value?: CURRENCY_TOKEN;
  tokens: CURRENCY_TOKEN[];
  onTokenSelect: (token: CURRENCY_TOKEN) => void;
};

const TokenSelector: FC<TokenSelectorProps> = ({ value, tokens, onTokenSelect }) => {
  const [search, setSearch] = useState<string>('');
  const [tokenSelectVisible, showTokenSelect, hideTokenSelect] = useModalState(false);

  useEffect(() => {
    if (!value && tokens.length) onTokenSelect(tokens[0]);
  }, []);

  const handleSearchChange = (event: ChangeEvent<HTMLInputElement>) => {
    event?.preventDefault();
    setSearch(event.target.value);
  };

  const handleTokenSelect = (denom: string) => {
    const token = tokens.find((token) => getDenomFromCurrencyToken(token) === denom);
    if (token) onTokenSelect(token);
    hideTokenSelect();
    // TODO: add error handling
  };

  const handleFilter = (asset: CURRENCY_TOKEN) =>
    getDenomFromCurrencyToken(asset).includes(search) || getDisplayDenomFromCurrencyToken(asset).includes(search);

  return (
    <>
      <TokenSelectorButton token={value} showDropdown onTokenClick={showTokenSelect} />
      {tokenSelectVisible && (
        <BottomSheet onClose={hideTokenSelect}>
          <InputWithSuffixIcon
            name='address'
            onChange={handleSearchChange}
            value={search}
            icon={Search}
            bgColor={CARD_BG_COLOR.background}
          />
          <br />
          <TokenList filter={handleFilter} onTokenClick={handleTokenSelect} emptyMessage='No tokens' tokens={tokens} />
        </BottomSheet>
      )}
    </>
  );
};

type TokenSelectorButtonProps = {
  token?: CURRENCY_TOKEN;
  showDropdown?: boolean;
  onTokenClick?: () => void;
};

const TokenSelectorButton: FC<TokenSelectorButtonProps> = ({
  token,
  showDropdown = false,
  onTokenClick = () => {},
}) => {
  return (
    <Card onClick={onTokenClick} className={styles.dropdown} rounded size={CARD_SIZE.medium}>
      <ImageWithFallback
        src={token?.token?.coinImageUrl ?? '/images/chain-logos/fallback.png'}
        alt={getDisplayDenomFromCurrencyToken(token)}
        fallbackSrc='/images/chain-logos/fallback.png'
        width={28}
        height={28}
      />
      <p>{getDisplayDenomFromCurrencyToken(token)}</p>
      {showDropdown && <ColoredIcon icon={ChevronDown} size={24} color={ICON_COLOR.primary} />}
    </Card>
  );
};

export default TokenSelector;

// type WalletTokenSelectorProps = {
//   showDropdown?: boolean;
//   value?: CURRENCY_TOKEN;
//   options: CURRENCY_TOKEN[];
//   onTokenSelect: (token: CURRENCY_TOKEN) => void;
// };

// const WalletTokenSelector: FC<WalletTokenSelectorProps> = ({ value, options, showDropdown, onTokenSelect }) => {
//   const [tokens, setTokens] = useState<TOKEN_BALANCE[] | undefined>();
//   const [search, setSearch] = useState<string>('');
//   const [tokenSelectVisible, showTokenSelect, hideTokenSelect] = useModalState(false);
//   const { wallet } = useContext(WalletContext);

//   useEffect(() => {
//     if (!value && options.length) onTokenSelect(options[0]);
//   }, []);

//   useEffect(() => {
//     const assets = groupWalletAssets(
//       wallet.balances?.data ?? [],
//       wallet.delegations?.data ?? [],
//       wallet.unbondingDelegations?.data ?? [],
//     );
//     setTokens(assets);
//   }, [wallet.loading]);

//   const handleSearchChange = (event: ChangeEvent<HTMLInputElement>) => {
//     event?.preventDefault();
//     setSearch(event.target.value);
//   };

//   const handleTokenSelect = (denom: string) => {
//     const token = options.find((token) => getDenomFromCurrencyToken(token) === denom);
//     if (token) onTokenSelect(token);
//     hideTokenSelect();
//     // TODO: add error handling
//   };

//   return (
//     <>
//       <TokenSelectorButton token={value} showDropdown onTokenClick={showTokenSelect} />
//       {tokenSelectVisible && (
//         <BottomSheet onClose={hideTokenSelect}>
//           <InputWithSuffixIcon
//             name='address'
//             onChange={handleSearchChange}
//             value={search}
//             icon={Search}
//             bgColor={CARD_BG_COLOR.background}
//           />
//           <br />
//           <TokenCardList
//             tokens={tokens ?? []}
//             loading={!Array.isArray(tokens)}
//             displayGradient={displayGradient}
//             filter={(asset) => asset.denom.includes(search)}
//             emptyMessage='No Balances to Show'
//             onTokenClick={handleTokenSelect}
//           />
//           {/* <TokenList filter={(asset) => asset.denom.includes(search)} onTokenClick={handleTokenSelect} /> */}
//         </BottomSheet>
//       )}
//     </>
//   );
// };

// type TokenSelectorButtonProps = {
//   token?: CURRENCY_TOKEN;
//   showDropdown?: boolean;
//   onTokenClick?: () => void;
// };

// const TokenSelectorButton: FC<TokenSelectorButtonProps> = ({
//   token,
//   showDropdown = false,
//   onTokenClick = () => {},
// }) => {
//   return (
//     <Card onClick={onTokenClick} className={styles.dropdown} rounded size={CARD_SIZE.medium}>
//       <ImageWithFallback
//         src={token?.token?.coinImageUrl ?? '/images/chain-logos/fallback.png'}
//         alt={getDisplayDenomFromCurrencyToken(token)}
//         fallbackSrc='/images/chain-logos/fallback.png'
//         width={28}
//         height={28}
//       />
//       <p>{getDisplayDenomFromCurrencyToken(token)}</p>
//       {showDropdown && <ColoredIcon icon={ChevronDown} size={24} color={ICON_COLOR.primary} />}
//     </Card>
//   );
// };

// export default WalletTokenSelector;
