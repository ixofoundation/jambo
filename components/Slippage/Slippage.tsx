import { FC, useState } from 'react';
import cls from 'classnames';

import utilsStyles from '@styles/utils.module.scss';
import styles from './Slippage.module.scss';
import ButtonRound, { BUTTON_ROUND_COLOR, BUTTON_ROUND_SIZE } from '@components/ButtonRound/ButtonRound';
import Slider from '@components/Slider/Slider';

type SlippageButtonProps = {
  value: number;
  selected: boolean;
  onSelect: (value: number) => (event: any) => void;
};

const SlippageButton: FC<SlippageButtonProps> = ({ value, selected, onSelect }) => {
  return (
    <ButtonRound
      onClick={onSelect(value)}
      size={BUTTON_ROUND_SIZE.mediumLarge}
      className={cls(styles.slippageButton, !!selected && styles.selected)}
      color={!!selected ? BUTTON_ROUND_COLOR.primary : BUTTON_ROUND_COLOR.lightGrey}
    >
      {value}%
    </ButtonRound>
  );
};

const SlippageOptions = [1, 2, 3, 5];
// TODO: extract slippage options to constants or step configs

const Slippage = () => {
  const [slippage, setSlippage] = useState<number>(5);

  console.log({ slippage });

  const changeSlippage = (e: any) => {
    e.preventDefault();
    setSlippage(Number(e.target.value ?? 0));
  };

  const changeSlippageClick = (value: number) => (event: any) => {
    // TODO: remove any types
    event.preventDefault();
    setSlippage(Number(value ?? 0));
  };

  return (
    <>
      <p className={styles.label}>
        Set max slippage to <span className={styles.highlight}>{slippage}%</span>
      </p>
      <div className={utilsStyles.spacer3} />
      <div className={utilsStyles.rowAlignSpaceAround}>
        {SlippageOptions.map((slippageOption) => (
          <SlippageButton
            key={`slippage_button_${slippageOption}`}
            value={slippageOption}
            selected={slippage === slippageOption}
            onSelect={changeSlippageClick}
          />
        ))}
      </div>
      <div className={utilsStyles.spacer1} />
      <Slider max={5} min={0} value={slippage} onChange={changeSlippage} />
    </>
  );
};

export default Slippage;
