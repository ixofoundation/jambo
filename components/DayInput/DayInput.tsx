import React, { FC, useState } from 'react';
import styles from '../SupaMotoScreens/SupaMotoScreens.module.scss';

type Props = {
  day: any,
  selected: boolean;
  onClick: () => void,
}

const DayInput: FC<Props> = ({ day, selected ,onClick }) => {
  const background = selected ? '#E0A714' : '#FFFFFF';

  return (
    <div
      className={styles.dayz}
      onClick={onClick}
      style={{ backgroundColor: background }}
    >
      {day}
    </div>
  );
};

export default DayInput;
