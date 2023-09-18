import React, { useState } from 'react';
import styles from '../SupaMotoScreens/SupaMotoScreens.module.scss';

const DayInput = ({ day }) => {
  const [background, setBackground] = useState('#FFFFFF');

  const handleClick = () => {
    setBackground(background === '#E0A714' ? '#FFFFFF' : '#E0A714');
  };

  return (
    <div
      className={styles.dayz}
      onClick={handleClick}
      style={{ backgroundColor: background }}
    >
      {day}
    </div>
  );
};

export default DayInput;
