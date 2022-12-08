import { useState, useEffect, useContext } from 'react';
import type { GetStaticPaths, NextPage, GetStaticPropsResult, GetStaticPropsContext } from 'next';

import config from '@constants/config.json';
import { StepDataType, STEP, STEPS } from 'types/steps';
import EmptySteps from '@steps/empty';
import ReceiverAddress from '@steps/receiver_address';
import DefineAmountToken from '@steps/define_amount_token';
import DefineAmountDelegate from '@steps/define_amount_delegate';
import ReviewAndSign from '@steps/review_and_sign';
import { backRoute, replaceRoute } from '@utils/router';
import { ACTION } from 'types/actions';
import ValidatorAddress from '@steps/validator_address';
import { WalletContext } from '@contexts/wallet';
import Head from '@components/head/head';
import { VALIDATOR_AMOUNT_CONFIGS, VALIDATOR_CONFIGS } from '@constants/validatorConfigs';
import ValidatorRewards from '@steps/claim_rewards';

type ActionPageProps = {
	actionData: ACTION;
};

const ActionExecution: NextPage<ActionPageProps> = ({ actionData }) => {
	const [count, setCount] = useState(0);
	const [action, setAction] = useState<ACTION | null>(null);
	const { wallet, updateWallet } = useContext(WalletContext);
	const signedIn = wallet.user?.address;

	useEffect(() => {
		setAction(actionData);
		if (!signedIn) updateWallet({ showWalletModal: true });
		// console.log({ id });
		// if (!id) return;
		// const fethedAction = (config as ConfigData).actions.find(a => a.id === id);
		// if (fethedAction) setAction(fethedAction);
	}, [actionData]);

	function handleOnNext<T>(data: StepDataType<T>) {
		setAction((a) =>
			!a ? a : { ...a, steps: a.steps.map((step, index) => (index === count ? { ...step, data } : step)) },
		);
		if (count + 1 === action?.steps.length) return replaceRoute('/');
		setCount((c) => c + 1);
	}

	const handleBack = () => {
		if (count === 0) return backRoute();
		setCount((c) => c - 1);
	};

	const getStepComponent = (step: STEP) => {
		console.log({ step });
		switch (step.id) {
			case STEPS.get_receiver_address:
				return (
					<ReceiverAddress
						onSuccess={handleOnNext<STEPS.get_receiver_address>}
						onBack={handleBack}
						data={step.data as StepDataType<STEPS.get_receiver_address>}
						header={action?.name}
					/>
				);
			case STEPS.get_validator_address:
			case STEPS.get_delegated_validator_undelegate:
			case STEPS.get_delegated_validator_redelegate:
			case STEPS.get_validator_redelegate:
				return (
					<ValidatorAddress
						onSuccess={handleOnNext<STEPS.get_validator_address>}
						onBack={handleBack}
						data={step.data as StepDataType<STEPS.get_validator_address>}
						header={action?.name}
						config={VALIDATOR_CONFIGS[step.id] ?? VALIDATOR_CONFIGS.default}
					/>
				);
			case STEPS.select_token_and_amount:
				return (
					<DefineAmountToken
						onSuccess={handleOnNext<STEPS.select_token_and_amount>}
						onBack={handleBack}
						data={step.data as StepDataType<STEPS.select_token_and_amount>}
						header={action?.name}
					/>
				);
			case STEPS.select_delegate_amount:
			case STEPS.select_undelegate_amount:
			case STEPS.select_redelegate_amount:
				return (
					<DefineAmountDelegate
						onSuccess={handleOnNext<STEPS.select_delegate_amount>}
						onBack={handleBack}
						data={step.data as StepDataType<STEPS.select_delegate_amount>}
						header={action?.name}
						config={VALIDATOR_AMOUNT_CONFIGS[step.id] ?? VALIDATOR_AMOUNT_CONFIGS.default}
						validator={
							(
								action?.steps.find((step) =>
									[
										STEPS.get_validator_address,
										STEPS.get_delegated_validator_undelegate,
										STEPS.get_delegated_validator_redelegate,
									].includes(step.id),
								)?.data as StepDataType<STEPS.get_validator_address>
							)?.validator || null
						}
					/>
				);
			case STEPS.distribution_MsgWithdrawDelegatorReward:
				return (
					<ValidatorRewards
						onSuccess={handleOnNext<STEPS.get_validator_address>}
						onBack={handleBack}
						data={step.data as StepDataType<STEPS.get_validator_address>}
						header={action?.name}
						message={step.id}
					/>
				);
			case STEPS.bank_MsgSend:
			case STEPS.staking_MsgDelegate:
			case STEPS.staking_MsgUndelegate:
			case STEPS.staking_MsgRedelegate:
				return (
					<ReviewAndSign
						onSuccess={handleOnNext<STEPS.review_and_sign>}
						onBack={handleBack}
						steps={action!.steps}
						header={action?.name}
						message={step.id}
					/>
				);
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
