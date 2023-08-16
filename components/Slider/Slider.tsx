import React, { useState } from "react";
import ButtonRound, { BUTTON_ROUND_COLOR, BUTTON_ROUND_SIZE } from "@components/ButtonRound/ButtonRound";
import styles from './Slider.module.scss'

const Slider = () => {
    const [slippage, setSlippage] = useState(1);
    const handleSlippageChange = (event: { target: { value: string; }; }) => {
        const newSlippage = parseInt(event.target.value);
        setSlippage(newSlippage);
    };

    const handleButtonClick = (value: React.SetStateAction<number>) => {
        setSlippage(value);
    };

    return (
        <div>
            <div className={styles.containerA} >
                <p>Set max slippage to <span style={{ color: "#1DB3D3" }} >{slippage}%</span></p>
            </div>
            <div className={styles.container}>
                <ButtonRound
                    color={slippage === 1 ? BUTTON_ROUND_COLOR.primary : BUTTON_ROUND_COLOR.grey}
                    size={BUTTON_ROUND_SIZE.large}
                    onClick={() => handleButtonClick(1)}
                >1%</ButtonRound>
                <ButtonRound
                    color={slippage === 2 ? BUTTON_ROUND_COLOR.primary : BUTTON_ROUND_COLOR.grey}
                    size={BUTTON_ROUND_SIZE.large}
                    onClick={() => handleButtonClick(2)}
                >2%</ButtonRound>
                <ButtonRound
                    color={slippage === 3 ? BUTTON_ROUND_COLOR.primary : BUTTON_ROUND_COLOR.grey}
                    size={BUTTON_ROUND_SIZE.large}
                    onClick={() => handleButtonClick(3)}
                >3%</ButtonRound>
                <ButtonRound
                    color={slippage === 5 ? BUTTON_ROUND_COLOR.primary : BUTTON_ROUND_COLOR.grey}
                    size={BUTTON_ROUND_SIZE.large}
                    onClick={() => handleButtonClick(5)}
                >5%</ButtonRound>
            </div>
            <input
                className={styles.slider}
                type="range"
                id="slippageSlider"
                min={1}
                max={5}
                step={1}
                value={slippage}
                onChange={handleSlippageChange}
            />
        </div>
    )
}

export default Slider;