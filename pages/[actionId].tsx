import { useState, useEffect, useContext } from 'react';
import type { GetStaticPaths, NextPage, GetStaticPropsResult, GetStaticPropsContext } from 'next';

import config from '@constants/config.json';
import { StepDataType, STEP, STEPS, StepConfigType } from 'types/steps';
import EmptySteps from '@steps/EmptySteps';
import ReceiverAddress from '@steps/ReceiverAddress';
import DefineAmountToken from '@steps/DefineAmountToken';
import DefineAmountDelegate from '@steps/DefineAmountDelegate';
import ReviewAndSign from '@steps/ReviewAndSign';
import { backRoute, replaceRoute } from '@utils/router';
import { ACTION } from 'types/actions';
import ValidatorAddress from '@steps/ValidatorAddress';
import SwapTokens from '@steps/SwapTokens'
import { WalletContext } from '@contexts/wallet';
import Head from '@components/Head/Head';
import { VALIDATOR_AMOUNT_CONFIGS, VALIDATOR_CONFIGS } from '@constants/validatorConfigs';
import ValidatorRewards from '@steps/ClaimRewards';
import { VALIDATOR_AMOUNT_CONFIG } from 'types/validators';
import SelectGovProposal from '@steps/SelectGovProposal';
import ShortTextInput from '@steps/ShortTextInput';
import LongTextInput from '@steps/LongTextInput';
import ProposalDeposit from '@steps/ProposalDeposit';

type ActionPageProps = {
  actionData: ACTION;
};

const ActionExecution: NextPage<ActionPageProps> = ({ actionData }) => {
  const [count, setCount] = useState(0);
  const [action, setAction] = useState<ACTION | null>(null);
  const { wallet } = useContext(WalletContext);
  const signedIn = wallet.user?.address;

  useEffect(() => {
    setAction(actionData);
  }, [actionData]);

  function handleOnNext<T>(data: StepDataType<T>) {
    setAction((a) =>
      !a ? a : { ...a, steps: a.steps.map((step, index) => (index === count ? { ...step, data } : step)) },
    );
    if (count + 1 === action?.steps.length) return replaceRoute('/');
    setCount((c) => c + 1);
  }

  const handleBack = () => {
    if (count === 0) {
      const newActionData = JSON.parse(JSON.stringify(action));
      if (newActionData.steps.find((step: STEP) => step.id === STEPS.get_receiver_address)?.data?.data?.length > 1) {
        newActionData.steps.forEach((step: STEP, index: number) => {
          if (step.id === STEPS.select_token_and_amount || step.id === STEPS.get_receiver_address) {
            newActionData.steps[index].data.data.pop();
            newActionData.steps[index].data.currentIndex = newActionData.steps[index].data.data.length - 1;
          }
        });
        setAction(newActionData);
        return setCount(action?.steps.findIndex((step) => step.id === STEPS.bank_MsgMultiSend) as number);
      } else {
        return backRoute();
      }
    }
    setCount((c) => c - 1);
  };

  const handleNextMultiSend = (nextIndex: number = 0) => {
    const newActionData = JSON.parse(JSON.stringify(action));
    action!.steps!.forEach((step, index) => {
      if (step.id === STEPS.select_token_and_amount || step.id === STEPS.get_receiver_address)
        newActionData.steps[index].data.currentIndex = nextIndex;
    });
    setAction(newActionData);
    setCount((c) => c - 2);
  };

  const handleDeleteMultiSend = (deleteIndex: number = 0) => {
    const newActionData = JSON.parse(JSON.stringify(action));
    if (
      newActionData.steps.find(
        (step: STEP) => step.id === STEPS.select_token_and_amount || step.id === STEPS.get_receiver_address,
      )?.data?.data.length <= 1
    )
      return replaceRoute('/');
    newActionData.steps.forEach((step: STEP, index: number) => {
      if (step.id === STEPS.select_token_and_amount || step.id === STEPS.get_receiver_address) {
        newActionData.steps[index].data.data = [
          ...newActionData.steps[index].data.data.slice(0, deleteIndex),
          ...newActionData.steps[index].data.data.slice(deleteIndex + 1),
        ];
        newActionData.steps[index].data.currentIndex = newActionData.steps[index].data.data.length - 1;
      }
    });
    setAction(newActionData);
  };

  const getStepComponent = (step: STEP) => {
    switch (step?.id) {
      case STEPS.get_receiver_address:
        return (
          <ReceiverAddress
            onSuccess={handleOnNext<STEPS.get_receiver_address>}
            onBack={handleBack}
            data={
              (step.data as StepDataType<STEPS.get_receiver_address>) ?? {
                data: [],
                currentIndex: 0,
              }
            }
            header={action?.name}
          />
        );
      case STEPS.get_validator_delegate:
      case STEPS.get_delegated_validator_undelegate:
      case STEPS.get_delegated_validator_redelegate:
      case STEPS.get_validator_redelegate:
        return (
          <ValidatorAddress
            onSuccess={handleOnNext<STEPS.get_validator_delegate>}
            onBack={handleBack}
            data={step.data as StepDataType<STEPS.get_validator_delegate>}
            header={action?.name}
            config={VALIDATOR_CONFIGS[step.id] ?? VALIDATOR_CONFIGS.default}
            excludeValidators={
              step.id === STEPS.get_validator_redelegate
                ? (
                  action?.steps.find((step) => step.id === STEPS.get_delegated_validator_redelegate)
                    ?.data as StepDataType<STEPS.get_validator_delegate>
                )?.validator?.address || []
                : []
            }
          />
        );
      case STEPS.select_token_and_amount:
        return (
          <DefineAmountToken
            onSuccess={handleOnNext<STEPS.select_token_and_amount>}
            onBack={handleBack}
            header={action?.name}
            config={step.config as StepConfigType<STEPS.select_token_and_amount>}
            data={
              (step.data as StepDataType<STEPS.select_token_and_amount>) ?? {
                data: [],
                currentIndex: 0,
              }
            }
          />
        );
      case STEPS.select_amount_delegate:
      case STEPS.select_amount_undelegate:
      case STEPS.select_amount_redelegate:
        return (
          <DefineAmountDelegate
            onSuccess={handleOnNext<STEPS.select_amount_delegate>}
            onBack={handleBack}
            data={step.data as StepDataType<STEPS.select_amount_delegate>}
            header={action?.name}
            config={(VALIDATOR_AMOUNT_CONFIGS[step.id] ?? VALIDATOR_AMOUNT_CONFIGS.default) as VALIDATOR_AMOUNT_CONFIG}
            validator={
              (
                action?.steps.find(
                  (step) =>
                    step.id === STEPS.get_validator_delegate ||
                    step.id === STEPS.get_delegated_validator_undelegate ||
                    step.id === STEPS.get_delegated_validator_redelegate,
                )?.data as StepDataType<STEPS.get_validator_delegate>
              )?.validator || null
            }
          />
        );
      case STEPS.distribution_MsgWithdrawDelegatorReward:
        return (
          <ValidatorRewards
            onSuccess={handleOnNext<STEPS.review_and_sign>}
            onBack={handleBack}
            data={step.data as StepDataType<STEPS.get_validator_delegate>}
            header={action?.name}
            message={step.id}
          />
        );
      case STEPS.select_proposal:
        return (
          <SelectGovProposal
            onSuccess={handleOnNext<STEPS.select_proposal>}
            onBack={handleBack}
            header={action?.name}
          />
        );
      case STEPS.define_proposal_title:
        return (
          <ShortTextInput
            onSuccess={handleOnNext<STEPS.define_proposal_title>}
            onBack={handleBack}
            header={action?.name}
            data={step.data as StepDataType<STEPS.define_proposal_title>}
          />
        );
      case STEPS.define_proposal_description:
        return (
          <LongTextInput
            onSuccess={handleOnNext<STEPS.define_proposal_description>}
            onBack={handleBack}
            header={action?.name}
            data={step.data as StepDataType<STEPS.define_proposal_description>}
          />
        );
      case STEPS.define_proposal_deposit:
        return (
          <ProposalDeposit
            onSuccess={handleOnNext<STEPS.define_proposal_deposit>}
            onBack={handleBack}
            header={action?.name}
            data={step.data as StepDataType<STEPS.define_proposal_deposit>}
          />
        );
      case STEPS.gov_MsgVote:
      case STEPS.gov_MsgSubmitProposal:
      case STEPS.bank_MsgSend:
      case STEPS.bank_MsgMultiSend:
      case STEPS.staking_MsgDelegate:
      case STEPS.staking_MsgUndelegate:
      case STEPS.staking_MsgRedelegate:
        return (
          <ReviewAndSign
            onSuccess={handleOnNext<STEPS.review_and_sign>}
            handleNextMultiSend={handleNextMultiSend}
            deleteMultiSend={handleDeleteMultiSend}
            onBack={handleBack}
            steps={action!.steps}
            header={action?.name}
            message={step.id}
          />
        );
      case STEPS.swap_tokens:
        return (
          <SwapTokens
            onSuccess={handleOnNext<STEPS.swap_tokens>}
            onBack={handleBack}
            data={step.data as StepDataType<STEPS.swap_tokens>}
            header={action?.name}
            // config={step.config as StepConfigType<STEPS.swap_tokens>}
          />
        )  
      default:
        return <EmptySteps loading={true} />;
    }
  };

  return (
    <>
      <Head title={actionData.name} description={actionData.description} />

      {!signedIn ? (
        <EmptySteps signedIn={false} />
      ) : (action?.steps?.length ?? 0) < 1 ? (
        <EmptySteps />
      ) : (
        getStepComponent(action!.steps[count])
      )}
    </>
  );
};

export default ActionExecution;

type PathsParams = {
  actionId: string;
};

export const getStaticPaths: GetStaticPaths<PathsParams> = async () => {
  const paths = config.actions.map((a) => ({ params: { actionId: a.id } }));

  return {
    paths,
    fallback: false,
  };
};

export const getStaticProps = async ({
  params,
}: GetStaticPropsContext<PathsParams>): Promise<GetStaticPropsResult<ActionPageProps>> => {
  const actionData = config.actions.find((a) => params!.actionId == a.id);

  return {
    props: {
      actionData: actionData as ACTION,
    },
  };
};
