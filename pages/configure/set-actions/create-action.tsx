import { ChangeEvent, useContext, useState } from 'react';
import type { NextPage } from 'next';
import Head from 'next/head';
import cls from 'classnames';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, MouseSensor, TouchSensor, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { restrictToFirstScrollableAncestor, restrictToVerticalAxis } from '@dnd-kit/modifiers';

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
import Sortable from '@components/drag-and-drop/sortable';

const CreateAction: NextPage = () => {
	const [action, setAction] = useState<Partial<ACTION>>({ steps: [] });
	const [showModal, setShowModal] = useState(false);
	const [stepsSearch, setStepsSearch] = useState('');
	const { updateConfig, config } = useContext(ConfigContext);

	const handleSearchChange = (e: ChangeEvent<HTMLInputElement>) => setStepsSearch(e.target.value);
	const handleNameChange = (e: ChangeEvent<HTMLInputElement>) => setAction(currentAction => ({ ...currentAction, name: e.target.value }));
	const handleDescriptionChange = (e: ChangeEvent<HTMLTextAreaElement>) => setAction(currentAction => ({ ...currentAction, description: e.target.value }));
	const handleAddStep = (step: STEP) => setAction(currentAction => ({ ...currentAction, steps: [...currentAction.steps!, step] }));
	const handleRemoveStep = (index: number) => setAction(currentAction => ({ ...currentAction, steps: currentAction.steps!.filter((s, i) => i != index) }));

	const checkActionSaveable =
		action.name && action.name.trim().length > 0 && action.description && action.description.trim().length > 0 && action.steps && action.steps.length > 0
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
					<ImageInput placeholder="Tap to upload image" className={styles.actionImage} />
					<Input placeholder="Action name" className={styles.actionName} onChange={handleNameChange} />
					<FormTextArea placeholder="Add a short description" className={styles.actionDescription} rows={3} maxLength={140} onChange={handleDescriptionChange} />
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
