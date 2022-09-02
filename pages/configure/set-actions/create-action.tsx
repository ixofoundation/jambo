import { ChangeEvent, useContext, useEffect, useState } from 'react';
import type { NextPage } from 'next';
import Head from 'next/head';
import cls from 'classnames';
import { DndContext, closestCenter, KeyboardSensor, useSensor, useSensors, MouseSensor, TouchSensor, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { restrictToFirstScrollableAncestor, restrictToVerticalAxis } from '@dnd-kit/modifiers';
import shortUUID from 'short-uuid';
import { useRouter } from 'next/router';

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
import Cross from '@icons/cross.svg';
import { ACTION } from 'types/actions';
import { pushNewRoute } from '@utils/router';
import Sortable from '@components/drag-and-drop/sortable';
import InputWithSufficIcon from '@components/input-with-suffix-icon/input-with-suffix-icon';
import Search from '@icons/search.svg';

const CreateAction: NextPage = () => {
	const [action, setAction] = useState<Partial<ACTION>>({ id: shortUUID.generate(), steps: [] });
	const [showModal, setShowModal] = useState(false);
	const [stepsSearch, setStepsSearch] = useState('');
	const { updateConfig, config } = useContext(ConfigContext);
	const router = useRouter();
	const { id } = router.query;

	useEffect(() => {
		if (!id) return;
		const fetchAction = config.actions.find(a => a.id === id);
		if (fetchAction) setAction(fetchAction);
	}, [id]);
	console.log({ action });

	const handleSearchChange = (e: ChangeEvent<HTMLInputElement>) => setStepsSearch(e.target.value);
	const handleImageChange = (image: string) => setAction(currentAction => ({ ...currentAction, image }));
	const handleNameChange = (e: ChangeEvent<HTMLInputElement>) => setAction(currentAction => ({ ...currentAction, name: e.target.value }));
	const handleDescriptionChange = (e: ChangeEvent<HTMLTextAreaElement>) => setAction(currentAction => ({ ...currentAction, description: e.target.value }));
	const handleAddStep = (step: STEP) => setAction(currentAction => ({ ...currentAction, steps: [...currentAction.steps!, step] }));
	const handleRemoveStep = (index: number) => setAction(currentAction => ({ ...currentAction, steps: currentAction.steps!.filter((s, i) => i != index) }));

	const checkActionSaveable =
		action.name && action.name.trim().length > 0 && action.description && action.description.trim().length > 0 && action.steps && action.steps.length > 0 && !!action.image
			? () => {
					updateConfig({ actions: [...config.actions, action as ACTION] });
					pushNewRoute('/configure/set-actions');
			  }
			: null;

	const sensors = useSensors(
		useSensor(MouseSensor, { activationConstraint: { distance: 10 } }),
		useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
		useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
	);

	function handleDragEnd(event: DragEndEvent) {
		const { active, over } = event;

		if (over?.id && active.id !== over.id)
			setAction(currentAction => ({
				...currentAction,
				steps: arrayMove(currentAction.steps!, Number.parseInt(active.id.toString()), Number.parseInt(over.id.toString())),
			}));
	}

	return (
		<>
			<Head>
				<title>EarthDay: Configure</title>
				<meta name="description" content="EarthDay configuration" />
			</Head>

			<Header pageTitle="Create a new action" />

			<main className={utilsStyles.main}>
				<div className={styles.actionCard}>
					<ImageInput placeholder="Tap to upload image" className={styles.actionImage} onImageUploaded={handleImageChange} image={action.image} />
					<Input placeholder="Action name" className={styles.actionName} onChange={handleNameChange} value={action.name ?? ''} />
					<FormTextArea placeholder="Add a short description" className={styles.actionDescription ?? ''} rows={3} maxLength={140} onChange={handleDescriptionChange} value={action.description} />
				</div>

				<h2 className={styles.title}>Steps:</h2>

				<DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd} modifiers={[restrictToVerticalAxis, restrictToFirstScrollableAncestor]}>
					<SortableContext items={action.steps?.map((s, i) => i.toString()) ?? []} strategy={verticalListSortingStrategy}>
						<Card className={styles.stepsCard}>
							{action.steps?.map((step, i) => (
								<Sortable key={step.name + i} id={i.toString()}>
									<Card className={cls(styles.stepCard, styles.stepCardRow)}>
										{step.name}
										<Cross color="white" onClick={() => handleRemoveStep(i)} />
									</Card>
								</Sortable>
							))}
							<ButtonRound onClick={() => setShowModal(true)}>
								<Plus width="22px" height="22px" />
							</ButtonRound>
						</Card>
					</SortableContext>
				</DndContext>
			</main>

			<Footer onBackUrl="/configure/set-actions/new-action" onCorrect={checkActionSaveable} />

			{showModal && (
				<Modal onClose={() => setShowModal(false)} title="Steps library" className={styles.stepsModal}>
					<InputWithSufficIcon name="search" required onChange={handleSearchChange} value={stepsSearch} Icon={Search} className={styles.stepsSearchInput} />
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
