import { ChangeEvent, useContext, useState } from 'react';
import type { NextPage } from 'next';
import Head from 'next/head';

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
import { sep } from 'path';
import { searchInput } from '@components/search-input/search-input.module.scss';

const CreateAction: NextPage = () => {
	const [showModal, setShowModal] = useState(false);
	const [stepsSearch, setStepsSearch] = useState('');
	const [steps, setSteps] = useState<Array<STEP>>([]);
	const { updateConfig } = useContext(ConfigContext);

	const handleSearchChange = (e: ChangeEvent<HTMLInputElement>) => {
		setStepsSearch(e.target.value);
	};

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
					<Input placeholder="Action name" className={styles.actionName} />
					<FormTextArea placeholder="Add a short description" className={styles.actionDescription} rows={3} maxLength={140} />
				</div>

				<h2 className={styles.title}>Steps:</h2>
				<Card className={styles.stepsCard}>
					{steps.map((step, i) => (
						<Card key={step.name + i} className={styles.stepCard}>
							{step.name}
						</Card>
					))}
					<ButtonRound onClick={() => setShowModal(true)}>
						<Plus width="22px" height="22px" />
					</ButtonRound>
				</Card>
			</main>

			<Footer onBackUrl="/set-actions/new-action" onCorrect={null} />

			{showModal && (
				<Modal onClose={() => setShowModal(false)} title="Steps library" className={styles.stepsModal}>
					<SearchInput value={stepsSearch} onChange={handleSearchChange} className={styles.stepsSearchInput} />
					{Object.entries(allSteps).map(
						([stepEnum, step], i) =>
							step.name.toLocaleLowerCase().includes(stepsSearch.toLocaleLowerCase()) && (
								<Card key={step.name + i} className={styles.stepCard} onClick={() => setSteps([...steps, step])}>
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
