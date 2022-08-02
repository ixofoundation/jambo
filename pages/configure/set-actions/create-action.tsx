import { ChangeEvent, useContext, useState } from 'react';
import type { NextPage } from 'next';
import Head from 'next/head';
import cls from 'classnames';

import utilsStyles from '@styles/utils.module.scss';
import styles from '@styles/actionsPage.module.scss';
import Header from '@components/header/header';
import Footer from '@components/footer/footer';
import Plus from '@icons/plus.svg';
import { ConfigContext } from '@contexts/config';
import ButtonRound from '@components/button-round/button-round';
import Input from '@components/input/input';
import ImageInput from '@components/image-input/image-input';
import FormTextArea from '@components/text-area/text-area';
import Card from '@components/card/card';
import Modal from '@components/modal/modal';
import { STEP, steps as allSteps } from 'types/steps';
import SearchInput from '@components/search-input/search-input';
import Cross from '@icons/cross.svg';
import { ACTION } from 'types/actions';
import { pushNewRoute } from '@utils/router';

const CreateAction: NextPage = () => {
	const [action, setAction] = useState<Partial<ACTION>>({ steps: [] });
	const [showModal, setShowModal] = useState(false);
	const [stepsSearch, setStepsSearch] = useState('');
	const { updateConfig, config } = useContext(ConfigContext);

	const handleSearchChange = (e: ChangeEvent<HTMLInputElement>) => setStepsSearch(e.target.value);
	const handleNameChange = (e: ChangeEvent<HTMLInputElement>) => setAction({ ...action, name: e.target.value });
	const handleDescriptionChange = (e: ChangeEvent<HTMLTextAreaElement>) => setAction({ ...action, description: e.target.value });
	const handleAddStep = (step: STEP) => setAction({ ...action, steps: [...action.steps!, step] });
	const handleRemoveStep = (index: number) => setAction({ ...action, steps: action.steps!.filter((s, i) => i != index) });

	const checkActionSaveable =
		action.name && action.name.trim().length > 0 && action.description && action.description.trim().length > 0 && action.steps && action.steps.length > 0
			? () => {
					updateConfig({ actions: [...config.actions, action as ACTION] });
					pushNewRoute('/configure/set-actions');
			  }
			: null;

	return (
		<>
			<Head>
				<title>EarthDay: Configure</title>
				<meta name="description" content="EarthDay configuration" />
			</Head>

			<Header pageTitle="Create a new action" />

			<main className={utilsStyles.main}>
				<div className={styles.actionCard}>
					<ImageInput placeholder="Tap to upload image" className={styles.actionImage} />
					<Input placeholder="Action name" className={styles.actionName} onChange={handleNameChange} />
					<FormTextArea placeholder="Add a short description" className={styles.actionDescription} rows={3} maxLength={140} onChange={handleDescriptionChange} />
				</div>

				<h2 className={styles.title}>Steps:</h2>
				<Card className={styles.stepsCard}>
					{action.steps?.map((step, i) => (
						<Card key={step.name + i} className={cls(styles.stepCard, styles.stepCardRow)}>
							{step.name}
							<Cross color="white" onClick={() => handleRemoveStep(i)} />
						</Card>
					))}
					<ButtonRound onClick={() => setShowModal(true)}>
						<Plus width="22px" height="22px" />
					</ButtonRound>
				</Card>
			</main>

			<Footer onBackUrl="/configure/set-actions/new-action" onCorrect={checkActionSaveable} />

			{showModal && (
				<Modal onClose={() => setShowModal(false)} title="Steps library" className={styles.stepsModal}>
					<SearchInput value={stepsSearch} onChange={handleSearchChange} className={styles.stepsSearchInput} />
					{Object.entries(allSteps).map(
						([stepEnum, step], i) =>
							step.name.toLocaleLowerCase().includes(stepsSearch.toLocaleLowerCase()) && (
								<Card key={step.name + i} className={styles.stepCard} onClick={() => handleAddStep(step)}>
									{step.name}
								</Card>
							),
					)}
				</Modal>
			)}
		</>
	);
};

export default CreateAction;
