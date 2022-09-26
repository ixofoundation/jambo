import { useState, useEffect, Suspense } from 'react';
import type { NextPage } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';

import config from '@constants/config.json';
import { StepDataType, STEP, STEPS } from 'types/steps';
import EmptySteps from '@steps/empty';
import ReceiverAddress from '@steps/receiver_address';
import DefineAmountToken from '@steps/define_amount_token';
import ReviewAndSign from '@steps/review_and_sign';
import { backRoute, replaceRoute } from '@utils/router';
import { ACTION } from 'types/actions';
import { ConfigData } from 'types/config';

const ActionExecution: NextPage = () => {
	const [count, setCount] = useState(0);
	const [action, setAction] = useState<ACTION | null>(null);
	const router = useRouter();
	const id = router.query.action;

	useEffect(() => {
		if (!id) return;
		const fethedAction = (config as ConfigData).actions.find(a => a.id === id);
		// console.log({ fethedAction });
		if (fethedAction) setAction(fethedAction);
	}, [id]);

	function handleOnNext<T>(data: StepDataType<T>) {
		setAction(a => (!a ? a : { ...a, steps: a.steps.map((step, index) => (index === count ? { ...step, data } : step)) }));
		if (count + 1 === action?.steps.length) return replaceRoute('/');
		setCount(c => c + 1);
	}

	const handleBack = () => {
		if (count === 0) return backRoute();
		setCount(c => c - 1);
	};

	const getStepComponent = (step: STEP) => {
		switch (step.id) {
			case STEPS.get_receiver_address:
				return <ReceiverAddress onSuccess={handleOnNext<STEPS.get_receiver_address>} onBack={handleBack} data={step.data as StepDataType<STEPS.get_receiver_address>} header={action?.name} />;
			case STEPS.select_token_and_amount:
				return <DefineAmountToken onSuccess={handleOnNext<STEPS.select_token_and_amount>} onBack={handleBack} data={step.data as StepDataType<STEPS.select_token_and_amount>} header={action?.name} />;
			case STEPS.review_and_sign:
				return <ReviewAndSign onSuccess={handleOnNext<STEPS.review_and_sign>} onBack={handleBack} steps={action!.steps} header={action?.name} />;
			default:
				return <EmptySteps loading={true} />;
		}
	};

	return (
		<>
			<Head>
				<title>EarthDay</title>
				<meta name="description" content="EarthDay" />
			</Head>

			<Suspense fallback={<EmptySteps loading={true} />}>{(action?.steps?.length ?? 0) < 1 ? <EmptySteps loading={!id} /> : getStepComponent(action!.steps[count])}</Suspense>
		</>
	);
};

export default ActionExecution;
