import { FC, useContext, useEffect } from 'react';
import Image from 'next/image';
import axios from 'axios';
import cls from 'classnames';

import styles from './ValidatorListItem.module.scss';
import Card from '@components/Card/Card';
import {
  formatTokenAmount,
  getAmountFromCurrencyToken,
  getDecimalsFromCurrencyToken,
  getDisplayDenomFromCurrencyToken,
} from '@utils/currency';
import { WalletContext } from '@contexts/wallet';
import { VALIDATOR } from 'types/validators';

type ValidatorListItemProps = {
  validator: VALIDATOR;
  onClick?: (validator: VALIDATOR) => () => void;
};

const fetchValidatorAvatar = async (identity: string, onComplete: (url: string) => void): Promise<void> => {
  try {
    const response = await axios.post('/api/validators/getValidatorAvatar', { identity });
    const { url } = response.data;
    if (url) onComplete(url);
  } catch (error) {
    console.error(error);
  }
};

const ValidatorListItem: FC<ValidatorListItemProps> = ({ validator, onClick }) => {
  const delegated = !!validator?.delegation?.shares;

  const { updateValidatorAvatar } = useContext(WalletContext);

  useEffect(() => {
    if (validator?.identity && typeof validator.avatarUrl !== 'string')
      fetchValidatorAvatar(validator.identity, (url) => updateValidatorAvatar(validator.address, url));
  }, []);

  if (!validator?.address) {
    return null;
  }

  return (
    <Card
      key={validator.address}
      rounded={!delegated}
      className={cls(styles.validatorWrapper, onClick && styles.clickable, delegated && styles.delegatedValidator)}
      onClick={onClick ? onClick(validator) : () => {}}
    >
      <div className={styles.row}>
        <div className={styles.validatorRank}>{validator.votingRank}</div>
        <div className={styles.validatorAvatar}>
          {!!validator.avatarUrl && (
            <Image src={validator.avatarUrl} alt={`${validator.moniker} avatar`} layout='fill' objectFit='contain' />
          )}
        </div>
        <div className={styles.validatorMoniker}>{validator.moniker} </div>
        <div className={styles.validatorCommission}>{validator.commission}%</div>
      </div>
      {delegated && (
        <div className={styles.row}>
          <div className={styles.validatorText}>My stake:</div>
          <div className={styles.validatorText}>
            {formatTokenAmount(
              getAmountFromCurrencyToken(validator.delegation?.balance),
              getDecimalsFromCurrencyToken(validator.delegation?.balance),
            )}{' '}
            {getDisplayDenomFromCurrencyToken(validator.delegation?.balance)}
          </div>
        </div>
      )}
    </Card>
  );
};

export default ValidatorListItem;
