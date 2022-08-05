import { useEffect, useState } from 'react';
import type { NextPage } from 'next';
import Head from 'next/head';
import cls from 'classnames';
import { DndContext, DragEndEvent } from '@dnd-kit/core';

import utilsStyles from '@styles/utils.module.scss';
import styles from '@styles/loginPage.module.scss';
import Header from '@components/header/header';
import Footer from '@components/footer/footer';
import { pushNewRoute } from '@utils/router';
import Draggable from '@components/drag-and-drop/draggable';
import Droppable from '@components/drag-and-drop/droppable';

const words = ['List', 'Football', 'Vehicle', 'Lounge', 'Guitar', 'Name', 'Chair', 'Autumn', 'Keyboard', 'Superconductor', 'Good', 'Girl'];

const ConfirmMnemonic: NextPage = () => {
	const [mount, setMount] = useState(false);
	const [selectedWords, setSelectedWords] = useState(getRandomArrayItems(words));
	const [dragWords, setDragWords] = useState([...selectedWords]);

	useEffect(() => {
		setMount(true);
	}, []);

	const onNext = dragWords.length > 0 ? null : () => pushNewRoute('/login/set-wallet');

	function handleDragEnd({ over, active }: DragEndEvent) {
		const droppableWord = over?.data.current?.word;
		const draggableWord = active.data.current?.word;
		if (droppableWord && droppableWord === draggableWord) {
			setDragWords(dragWords.filter(word => word !== draggableWord));
		}
	}

	return (
		<>
			<Head>
				<title>EarthDay</title>
				<meta name="description" content="EarthDay" />
			</Head>

			<Header pageTitle="Create new mnemonic" />

			<DndContext onDragEnd={handleDragEnd}>
				<main className={cls(utilsStyles.main, utilsStyles.columnSpaceEvenlyCentered)}>
					<div className={styles.mnemonicsWrapper}>
						<h2 className={styles.mnemonicTitle}>Confirm mnemonic phrase:</h2>
						<div className={styles.mnemonics}>
							{mount &&
								words.map((word, i) => {
									if (dragWords.includes(word)) return <Droppable key={word + i} id={word + i} data={{ word: word, index: i }} className={styles.emptyMnemonic} isOverStyle={{ backgroundColor: '#ccc' }}></Droppable>;
									if (selectedWords.includes(word))
										return (
											<Draggable key={word + i} id={word + i} data={{ word: word, index: i }} className={styles.mnemonic}>
												{word}
											</Draggable>
										);
									return (
										<div key={word + i} className={styles.mnemonic}>
											{word}
										</div>
									);
								})}
						</div>
						<div className={styles.copyContainer}>
							<p>Drag to correct position</p>
						</div>
						<div className={styles.mnemonics}>
							{mount &&
								dragWords.map((word, i) => (
									<Draggable key={word + i} id={word + i} data={{ word: word, index: i }} className={styles.mnemonic}>
										{word}
									</Draggable>
								))}
						</div>
					</div>
				</main>
			</DndContext>

			<Footer onBackUrl="/login/create-wallet/new-mnemonic" onForward={onNext} />
		</>
	);
};

export default ConfirmMnemonic;

const getRandomArrayItems = (originalList: string[]) => {
	var list = [...originalList];
	var selectedList = [];
	for (let i in [1, 2, 3, 4]) {
		const item = list[(list.length * Math.random()) | 0];
		selectedList.push(item);
		list = list.filter(k => k !== item);
	}
	return selectedList;
};
