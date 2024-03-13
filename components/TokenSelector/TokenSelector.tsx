import { ChangeEvent, useEffect, useState } from 'react';

import BottomSheet from '@components/BottomSheet/BottomSheet';
import Card, { CARD_BG_COLOR, CARD_SIZE } from '@components/Card/Card';
import ColoredIcon, { ICON_COLOR } from '@components/ColoredIcon/ColoredIcon';
import ImageWithFallback from '@components/ImageFallback/ImageFallback';
import InputWithSuffixIcon from '@components/InputWithSuffixIcon/InputWithSuffixIcon';
import TokenList from '@components/TokenList/TokenList';
import useModalState from '@hooks/useModalState';
import ChevronDown from '@icons/chevron_down.svg';
import Search from '@icons/search.svg';
import { getDenomFromCurrencyToken, getDisplayDenomFromCurrencyToken } from '@utils/currency';
import { CURRENCY_TOKEN } from 'types/wallet';

import styles from './TokenSelector.module.scss';

type TokenSelectorProps = {
  value?: CURRENCY_TOKEN;
  options: CURRENCY_TOKEN[];
  displaySwapOptions?: boolean;
  onChange: (token: CURRENCY_TOKEN) => void;
};

const TokenSelector = ({ value, options, displaySwapOptions, onChange }: TokenSelectorProps) => {
  const [search, setSearch] = useState<string>('');
  const [tokenSelectVisible, showTokenSelect, hideTokenSelect] = useModalState(false);

  useEffect(() => {
    if (!value && options.length) onChange(options[0]);
  }, []);

  const handleSearchChange = (event: ChangeEvent<HTMLInputElement>) => {
    event?.preventDefault();
    setSearch(event.target.value);
  };

  const handleTokenSelect = (denom: string) => {
    const token = options.find((token) => getDenomFromCurrencyToken(token) === denom);
    if (token) onChange(token);
    hideTokenSelect();
    // TODO: add error handling
  };

  return (
    <>
      <Card onClick={showTokenSelect} className={styles.dropdown} rounded size={CARD_SIZE.medium}>
        <ImageWithFallback
          src={value?.token?.coinImageUrl ?? '/images/chain-logos/fallback.png'}
          alt={getDisplayDenomFromCurrencyToken(value)}
          fallbackSrc='/images/chain-logos/fallback.png'
          width={28}
          height={28}
        />
        <p>{getDisplayDenomFromCurrencyToken(value)}</p>
        <ColoredIcon icon={ChevronDown} size={24} color={ICON_COLOR.primary} />
      </Card>
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
          <TokenList
            filter={(asset) => asset.denom.includes(search)}
            onTokenClick={handleTokenSelect}
            displaySwapOptions={displaySwapOptions}
            options={options}
          />
        </BottomSheet>
      )}
    </>
  );
};

export default TokenSelector;
