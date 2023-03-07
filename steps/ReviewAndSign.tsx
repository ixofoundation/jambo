import { FC, useContext, useEffect, useState } from 'react';
import cls from 'classnames';

import utilsStyles from '@styles/utils.module.scss';
import styles from '@styles/stepsPages.module.scss';
import Button, { BUTTON_BG_COLOR, BUTTON_BORDER_COLOR, BUTTON_SIZE } from '@components/Button/Button';
import ValidatorListItem from '@components/ValidatorListItem/ValidatorListItem';
import AmountAndDenom from '@components/AmountAndDenom/AmountAndDenom';
import IconText from '@components/IconText/IconText';
import Header from '@components/Header/Header';
import Footer from '@components/Footer/Footer';
import Loader from '@components/Loader/Loader';
import Input from '@components/Input/Input';
import Anchor from '@components/Anchor/Anchor';
import Success from '@icons/success.svg';
import { ReviewStepsTypes, STEP, StepDataType, STEPS } from 'types/steps';
import { KEPLR_CHAIN_INFO_TYPE } from 'types/chain';
import { VALIDATOR } from 'types/validators';
import { TRX_MSG } from 'types/transactions';
import { getDisplayDenomFromCurrencyToken } from '@utils/currency';
import { broadCastMessages } from '@utils/wallets';
import { getMicroAmount } from '@utils/encoding';
import {
  defaultTrxFeeOption,
  generateBankSendTrx,
  generateDelegateTrx,
  generateRedelegateTrx,
  generateUndelegateTrx,
} from '@utils/transactions';
import { WalletContext } from '@contexts/wallet';
import { ChainContext } from '@contexts/chain';
import { CURRENCY_TOKEN } from 'types/wallet';

type ReviewAndSignProps = {
  onSuccess: (data: StepDataType<STEPS.review_and_sign>) => void;
  onBack?: () => void;
  steps: STEP[];
  header?: string;
  message: ReviewStepsTypes;
};

const ReviewAndSign: FC<ReviewAndSignProps> = ({ onSuccess, onBack, steps, header, message }) => {
  const { wallet } = useContext(WalletContext);
  const [successHash, setSuccessHash] = useState<string | undefined>();
  const [loading, setLoading] = useState<boolean>(false);
  const [amount, setAmount] = useState<number>(0);
  const [token, setToken] = useState<CURRENCY_TOKEN | undefined>();
  const [dstAddress, setDstAddress] = useState<string>(''); // destination address
  const [srcAddress, setSrcAddress] = useState<string>(''); // source address
  const [dstValidator, setDstValidator] = useState<VALIDATOR | undefined>(); // destination validator
  const [srcValidator, setSrcValidator] = useState<VALIDATOR | undefined>(); // source validator
  const { chainInfo } = useContext(ChainContext);

  useEffect(() => {
    steps.forEach((s) => {
      if (
        s.id === STEPS.select_token_and_amount ||
        s.id === STEPS.select_amount_delegate ||
        s.id === STEPS.select_amount_undelegate ||
        s.id === STEPS.select_amount_redelegate
      ) {
        setAmount((s.data as StepDataType<STEPS.select_token_and_amount>)?.amount ?? 0);
        setToken((s.data as StepDataType<STEPS.select_token_and_amount>)?.token);
      }
      if (s.id === STEPS.get_receiver_address) {
        setDstAddress((s.data as StepDataType<STEPS.get_receiver_address>)?.address ?? '');
      }
      if (
        s.id === STEPS.get_validator_delegate ||
        s.id === STEPS.get_delegated_validator_undelegate ||
        s.id === STEPS.get_validator_redelegate
      ) {
        setDstAddress((s.data as StepDataType<STEPS.get_validator_delegate>)?.validator?.address ?? '');
        setDstValidator((s.data as StepDataType<STEPS.get_validator_delegate>)?.validator);
      }
      if (s.id === STEPS.get_delegated_validator_redelegate) {
        setSrcAddress((s.data as StepDataType<STEPS.get_validator_delegate>)?.validator?.address ?? '');
        setSrcValidator((s.data as StepDataType<STEPS.get_validator_delegate>)?.validator);
      }
    });
  }, [steps]);

  const signTX = async (): Promise<void> => {
    setLoading(true);
    let trx: TRX_MSG;
    switch (message) {
      case STEPS.bank_MsgSend:
        trx = generateBankSendTrx({
          fromAddress: wallet.user!.address,
          toAddress: dstAddress,
          denom: token?.denom ?? '',
          amount: getMicroAmount(amount.toString()),
        });
        break;
      case STEPS.staking_MsgDelegate:
        trx = generateDelegateTrx({
          delegatorAddress: wallet.user!.address,
          validatorAddress: dstAddress,
          denom: token?.denom ?? '',
          amount: getMicroAmount(amount.toString()),
        });
        break;
      case STEPS.staking_MsgUndelegate:
        trx = generateUndelegateTrx({
          delegatorAddress: wallet.user!.address,
          validatorAddress: dstAddress,
          denom: token?.denom ?? '',
          amount: getMicroAmount(amount.toString()),
        });
        break;
      case STEPS.staking_MsgRedelegate:
        trx = generateRedelegateTrx({
          delegatorAddress: wallet.user!.address,
          validatorSrcAddress: srcAddress,
          validatorDstAddress: dstAddress,
          denom: token?.denom ?? '',
          amount: getMicroAmount(amount.toString()),
        });
        break;
      default:
        throw new Error('Unsupported review type');
    }
    const hash = await broadCastMessages(
      wallet,
      [trx],
      undefined,
      defaultTrxFeeOption,
      token?.denom ?? '',
      chainInfo as KEPLR_CHAIN_INFO_TYPE,
    );
    if (hash) setSuccessHash(hash);
    setLoading(false);
  };

  if (successHash)
    return (
      <>
        <Header header={header} />

        <main className={cls(utilsStyles.main, utilsStyles.columnJustifyCenter, styles.stepContainer)}>
          <IconText title='Your transaction was successful!' Img={Success} imgSize={50}>
            {chainInfo?.txExplorer && (
              <Anchor active openInNewTab href={`${chainInfo.txExplorer.txUrl.replace(/\${txHash}/i, successHash)}`}>
                <Button
                  label={`View on ${chainInfo.txExplorer.name}`}
                  size={BUTTON_SIZE.mediumLarge}
                  rounded
                  bgColor={BUTTON_BG_COLOR.lightGrey}
                  borderColor={BUTTON_BORDER_COLOR.lightGrey}
                />
              </Anchor>
            )}
          </IconText>
        </main>

        <Footer showAccountButton={!!successHash} showActionsButton={!!successHash} />
      </>
    );

  return (
    <>
      <Header header={header} />

      <main className={cls(utilsStyles.main, utilsStyles.columnJustifyCenter, styles.stepContainer)}>
        {loading ? (
          <Loader />
        ) : message === STEPS.bank_MsgSend ? (
          <form className={styles.stepsForm} autoComplete='none'>
            <p className={utilsStyles.label}>I am sending</p>
            <AmountAndDenom amount={amount} denom={getDisplayDenomFromCurrencyToken(token!)} microUnits={0} />
            <br />
            <p className={utilsStyles.label}>to the address:</p>
            <Input name='address' required value={dstAddress} className={styles.stepInput} align='center' disabled />
          </form>
        ) : message === STEPS.staking_MsgDelegate ? (
          <form className={styles.stepsForm} autoComplete='none'>
            {message === STEPS.staking_MsgDelegate && <p>Delegating</p>}
            <AmountAndDenom amount={amount} denom={getDisplayDenomFromCurrencyToken(token!)} microUnits={0} />
            <br />
            {message === STEPS.staking_MsgDelegate && <p>to the validator</p>}

            <ValidatorListItem validator={dstValidator!} onClick={() => () => {}} />
          </form>
        ) : message === STEPS.staking_MsgUndelegate ? (
          <form className={styles.stepsForm} autoComplete='none'>
            {message === STEPS.staking_MsgUndelegate && <p>Undelegate</p>}
            <AmountAndDenom amount={amount} denom={getDisplayDenomFromCurrencyToken(token!)} microUnits={0} />
            <br />
            {message === STEPS.staking_MsgUndelegate && <p>from the validator</p>}

            <ValidatorListItem validator={dstValidator!} onClick={() => () => {}} />
          </form>
        ) : message === STEPS.staking_MsgRedelegate ? (
          <form className={styles.stepsForm} autoComplete='none'>
            <p>Redelegate</p>
            <AmountAndDenom amount={amount} denom={getDisplayDenomFromCurrencyToken(token!)} microUnits={0} />
            <br />
            <p>from</p>
            <ValidatorListItem validator={srcValidator!} onClick={() => () => {}} />
            <p>to</p>
            <ValidatorListItem validator={dstValidator!} onClick={() => () => {}} />
          </form>
        ) : (
          <p>Unsupported review type</p>
        )}
      </main>

      <Footer
        onBack={loading || successHash ? null : onBack}
        onBackUrl={onBack ? undefined : ''}
        onCorrect={loading || !!successHash ? null : signTX}
        correctLabel={loading ? 'Signing' : !successHash ? 'Sign' : undefined}
      />
    </>
  );
};

export default ReviewAndSign;
