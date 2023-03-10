import { FC, useContext, useEffect, useState } from 'react';
import cls from 'classnames';

import utilsStyles from '@styles/utils.module.scss';
import styles from '@styles/stepsPages.module.scss';
import Button, { BUTTON_BG_COLOR, BUTTON_BORDER_COLOR, BUTTON_SIZE } from '@components/Button/Button';
import MultiSendCard from '@components/MultiSendCard/MultiSendCard';
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
import { getDenomFromCurrencyToken, getDisplayDenomFromCurrencyToken } from '@utils/currency';
import { broadCastMessages } from '@utils/wallets';
import { getMicroAmount } from '@utils/encoding';
import {
  defaultTrxFeeOption,
  generateBankMultiSendTrx,
  generateBankSendTrx,
  generateDelegateTrx,
  generateRedelegateTrx,
  generateUndelegateTrx,
} from '@utils/transactions';
import { WalletContext } from '@contexts/wallet';
import { ChainContext } from '@contexts/chain';
import { CURRENCY_TOKEN } from 'types/wallet';
import ButtonRound, { BUTTON_ROUND_COLOR, BUTTON_ROUND_SIZE } from '@components/ButtonRound/ButtonRound';
import Plus from '@icons/plus.svg';
import BottomSheet from '@components/BottomSheet/BottomSheet';
import { shortenAddress } from '../utils/wallets';
import MultiSendContent from '../components/BottomSheetContent/MultiSendContent';

type ReviewAndSignProps = {
  onSuccess: (data: StepDataType<STEPS.review_and_sign>) => void;
  onBack?: () => void;
  handleNextMultiSend?: (nextIndex: number) => void;
  deleteMultiSend?: (deleteIndex: number) => void;
  steps: STEP[];
  header?: string;
  message: ReviewStepsTypes;
};

const ReviewAndSign: FC<ReviewAndSignProps> = ({
  onSuccess,
  onBack,
  handleNextMultiSend,
  deleteMultiSend,
  steps,
  header,
  message,
}) => {
  const { wallet } = useContext(WalletContext);
  const [successHash, setSuccessHash] = useState<string | undefined>();
  const [loading, setLoading] = useState<boolean>(false);
  const [amount, setAmount] = useState<number | number[]>(0);
  const [token, setToken] = useState<CURRENCY_TOKEN | CURRENCY_TOKEN[] | undefined>();
  const [dstAddress, setDstAddress] = useState<string | string[]>(''); // destination address
  const [srcAddress, setSrcAddress] = useState<string>(''); // source address
  const [dstValidator, setDstValidator] = useState<VALIDATOR | undefined>(); // destination validator
  const [srcValidator, setSrcValidator] = useState<VALIDATOR | undefined>(); // source validator
  const { chainInfo } = useContext(ChainContext);
  const [trxCancelId, setTrxCancelId] = useState<number | undefined>();

  const showCancelTransactionModal = (index: number) => () => {
    setTrxCancelId(index);
  };

  const hideCancelTransactionModal = () => setTrxCancelId(undefined);

  const addingNewTransaction = (e: Event | any) => {
    e.preventDefault();
    if (handleNextMultiSend)
      handleNextMultiSend(
        steps.find(
          (step) => step.id === STEPS.select_token_and_amount || step.id === STEPS.get_receiver_address,
          // @ts-ignore
        )?.data?.data?.length,
      );
  };

  const handleDeleteMultiSend = () => {
    if (deleteMultiSend) deleteMultiSend(trxCancelId!);
    hideCancelTransactionModal();
  };

  useEffect(() => {
    steps.forEach((s) => {
      if (s.id === STEPS.select_token_and_amount) {
        setAmount((s.data as StepDataType<STEPS.select_token_and_amount>)?.data.map((v) => v.amount) ?? []);
        setToken((s.data as StepDataType<STEPS.select_token_and_amount>)?.data.map((v) => v.token) ?? []);
      }
      if (
        s.id === STEPS.select_amount_delegate ||
        s.id === STEPS.select_amount_undelegate ||
        s.id === STEPS.select_amount_redelegate
      ) {
        setAmount((s.data as StepDataType<STEPS.select_amount_delegate>)?.amount ?? 0);
        setToken((s.data as StepDataType<STEPS.select_amount_delegate>)?.token);
      }
      if (s.id === STEPS.get_receiver_address) {
        setDstAddress((s.data as StepDataType<STEPS.get_receiver_address>)?.data.map((v) => v.address) ?? []);
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
          toAddress: dstAddress[0] as string,
          denom: token ? token[0]?.value : '',
          amount: getMicroAmount(amount.toString()),
        });
      case STEPS.bank_MsgMultiSend:
        trx = generateBankMultiSendTrx({
          fromAddress: wallet.user!.address,
          toAddresses: dstAddress as string[],
          denoms: (token as CURRENCY_TOKEN[]).map((token) => token.denom),
          amounts: (amount as number[]).map((a) => getMicroAmount(a.toString())),
        });
        break;
      case STEPS.staking_MsgDelegate:
        trx = generateDelegateTrx({
          delegatorAddress: wallet.user!.address,
          validatorAddress: dstAddress as string,
          denom: getDenomFromCurrencyToken(token as CURRENCY_TOKEN),
          amount: getMicroAmount(amount.toString()),
        });
        break;
      case STEPS.staking_MsgUndelegate:
        trx = generateUndelegateTrx({
          delegatorAddress: wallet.user!.address,
          validatorAddress: dstAddress as string,
          denom: getDenomFromCurrencyToken(token as CURRENCY_TOKEN),
          amount: getMicroAmount(amount.toString()),
        });
        break;
      case STEPS.staking_MsgRedelegate:
        trx = generateRedelegateTrx({
          delegatorAddress: wallet.user!.address,
          validatorSrcAddress: srcAddress,
          validatorDstAddress: dstAddress as string,
          denom: getDenomFromCurrencyToken(token as CURRENCY_TOKEN),
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
      (Array.isArray(token) ? token[0]?.denom : token?.denom) ?? '',
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
            <AmountAndDenom
              amount={(Array.isArray(amount) ? amount[0] ?? '' : amount) ?? ''}
              denom={getDisplayDenomFromCurrencyToken(
                Array.isArray(token) ? (token[0] as CURRENCY_TOKEN) : (token as CURRENCY_TOKEN),
              )}
              microUnits={0}
            />
            <br />
            <p className={utilsStyles.label}>to the address:</p>
            <Input name='address' required value={dstAddress} className={styles.stepInput} align='center' disabled />
          </form>
        ) : message === STEPS.bank_MsgMultiSend ? (
          <form className={styles.stepsForm} autoComplete='none'>
            <p className={utilsStyles.label}>Confirm to Send</p>
            <div>
              {Array.isArray(dstAddress) &&
                dstAddress.map((address, index) => {
                  const addressAmount = amount![index];
                  const addressToken = token![index];
                  return (
                    <MultiSendCard
                      address={shortenAddress(address)}
                      token={addressToken}
                      amount={addressAmount}
                      onDeleteClick={showCancelTransactionModal(index)}
                      key={`${address}_${index}`}
                    />
                  );
                })}
            </div>
            <ButtonRound size={BUTTON_ROUND_SIZE.mediumLarge} onClick={addingNewTransaction}>
              <Plus className={styles.plusIcon} />
            </ButtonRound>
            {typeof trxCancelId === 'number' && (
              <BottomSheet onClose={hideCancelTransactionModal}>
                <MultiSendContent
                  onDeleteMsgClicked={handleDeleteMultiSend}
                  onCloseBottomSheet={hideCancelTransactionModal}
                />
              </BottomSheet>
            )}
          </form>
        ) : message === STEPS.staking_MsgDelegate ? (
          <form className={styles.stepsForm} autoComplete='none'>
            {message === STEPS.staking_MsgDelegate && <p>Delegating</p>}
            <AmountAndDenom
              amount={amount as number}
              denom={getDisplayDenomFromCurrencyToken(token as CURRENCY_TOKEN)}
              microUnits={0}
            />
            <br />
            {message === STEPS.staking_MsgDelegate && <p>to the validator</p>}

            <ValidatorListItem validator={dstValidator!} onClick={() => () => {}} />
          </form>
        ) : message === STEPS.staking_MsgUndelegate ? (
          <form className={styles.stepsForm} autoComplete='none'>
            {message === STEPS.staking_MsgUndelegate && <p>Undelegate</p>}
            <AmountAndDenom
              amount={(Array.isArray(amount) ? amount[0] : amount) ?? ''}
              denom={getDisplayDenomFromCurrencyToken(token as CURRENCY_TOKEN)}
              microUnits={0}
            />
            <br />
            {message === STEPS.staking_MsgUndelegate && <p>from the validator</p>}

            <ValidatorListItem validator={dstValidator!} onClick={() => () => {}} />
          </form>
        ) : message === STEPS.staking_MsgRedelegate ? (
          <form className={styles.stepsForm} autoComplete='none'>
            <p>Redelegate</p>
            <AmountAndDenom
              amount={(Array.isArray(amount) ? amount[0] : amount) ?? ''}
              denom={getDisplayDenomFromCurrencyToken(token as CURRENCY_TOKEN)}
              microUnits={0}
            />
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
