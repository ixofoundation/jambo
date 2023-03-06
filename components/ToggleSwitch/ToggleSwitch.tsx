import { ChangeEvent, HTMLAttributes } from 'react';

import styles from './ToggleSwitch.module.scss';

type ToggleSwitchProps = {
  name: string;
  toggled: boolean;
  onToggle: (e: ChangeEvent<HTMLInputElement>) => void;
} & HTMLAttributes<HTMLInputElement>;

const ToggleSwitch = ({ name, toggled, onToggle }: ToggleSwitchProps) => {
  return (
    <label className={styles.toggleSwitch}>
      <input type='checkbox' checked={toggled} onChange={onToggle} />
      <span className={styles.switch} />
    </label>
  );
};

export default ToggleSwitch;
