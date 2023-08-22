import React from 'react';

import ButtonRound, { BUTTON_ROUND_COLOR, BUTTON_ROUND_SIZE } from '@components/ButtonRound/ButtonRound';

import styles from './Slider.module.scss';

type SliderProps = {
  value: number;
  onChange: (value: number) => void;
};

const Slider = ({ value, onChange }: SliderProps) => {
  const handleSlippageChange = (event: { target: { value: string } }) => {
    const newSlippage = parseInt(event.target.value);
    onChange(newSlippage);
  };

  const handleButtonClick = (value: number) => {
    onChange(value);
  };

  return (
    <div>
      <div className={styles.containerA}>
        <p>
          Set max slippage to <span style={{ color: '#1DB3D3' }}>{value}%</span>
        </p>
      </div>
      <div className={styles.container}>
        <ButtonRound
          color={value === 1 ? BUTTON_ROUND_COLOR.primary : BUTTON_ROUND_COLOR.lightGrey}
          size={BUTTON_ROUND_SIZE.large}
          onClick={() => handleButtonClick(1)}
        >
          1%
        </ButtonRound>
        <ButtonRound
          color={value === 2 ? BUTTON_ROUND_COLOR.primary : BUTTON_ROUND_COLOR.lightGrey}
          size={BUTTON_ROUND_SIZE.large}
          onClick={() => handleButtonClick(2)}
        >
          2%
        </ButtonRound>
        <ButtonRound
          color={value === 3 ? BUTTON_ROUND_COLOR.primary : BUTTON_ROUND_COLOR.lightGrey}
          size={BUTTON_ROUND_SIZE.large}
          onClick={() => handleButtonClick(3)}
        >
          3%
        </ButtonRound>
        <ButtonRound
          color={value === 5 ? BUTTON_ROUND_COLOR.primary : BUTTON_ROUND_COLOR.lightGrey}
          size={BUTTON_ROUND_SIZE.large}
          onClick={() => handleButtonClick(5)}
        >
          5%
        </ButtonRound>
      </div>
      <input
        className={styles.slider}
        type='range'
        id='slippageSlider'
        min={1}
        max={5}
        step={1}
        value={value}
        onChange={handleSlippageChange}
      />
    </div>
  );
};

export default Slider;
