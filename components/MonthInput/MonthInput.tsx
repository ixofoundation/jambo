import React, { FC } from 'react';
import styles from '../SupaMotoScreens/SupaMotoScreens.module.scss';

type Props = {
    month: any;
    selected: boolean;
    onClick: () => void;
};

const MonthInput: FC<Props> = ({ month, selected, onClick }) => {
    const background = selected ? '#E0A714' : '#FFFFFF';

    return (
        <div
            className={styles.months}
            onClick={onClick}
            style={{ backgroundColor: background }}
        >
            {month}
        </div>
    );
};

export default MonthInput;
