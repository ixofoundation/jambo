import { useContext, useState } from 'react';
import type { NextPage } from 'next';
import Head from 'next/head';

import utilsStyles from '@styles/utils.module.scss';
import styles from '@styles/actionsPage.module.scss';
import Header from '@components/header/header';
import Footer from '@components/footer/footer';
import Plus from '@icons/plus.svg';
import { ConfigContext } from '@contexts/config';
import ButtonRound from '@components/button-round/button-round';
import FormInput from '@components/form-input/form-input';
import ImageInput from '@components/image-input/image-input';
import FormTextArea from '@components/form-text-area/form-text-area';
import Card from '@components/card/card';
import Modal from '@components/modal/modal';
import { STEP, steps as allSteps } from 'types/steps';

const CreateAction: NextPage = () => {
	const [showModal, setShowModal] = useState(false);
	const [steps, setSteps] = useState<Array<STEP>>([]);
	const { updateConfig } = useContext(ConfigContext);

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
					<FormInput placeholder="Action name" className={styles.actionName} />
					<FormTextArea placeholder="Add a short description" className={styles.actionDescription} rows={3} maxLength={140} />
				</div>

				<h2>Steps:</h2>
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
					{/* <FormInput value={siteName} onChange={handleNameChange} maxLength={20} /> */}
					{Object.entries(allSteps).map(([stepEnum, step], i) => (
						<Card key={step.name + i} className={styles.stepCard} onClick={() => setSteps([...steps, step])}>
							{step.name}
						</Card>
					))}
				</Modal>
			)}
		</>
	);
};

export default CreateAction;
