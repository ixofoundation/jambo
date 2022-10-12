import { useState } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import Image from 'next/image';
import 'swiper/css';

import styles from './swiper.module.scss';
import { ACTION } from 'types/actions';
import { pushNewRoute } from '@utils/router';

type SwipersProps = {
	actions: ACTION[];
};

const CustomSwiper = ({ actions }: SwipersProps) => {
	const [active, setActive] = useState(0);

	const selectedAction = actions[active];

	return (
		<div onClick={() => pushNewRoute(`/${actions[active].id}`)}>
			<Swiper spaceBetween={20} slidesPerView="auto" onSlideChange={s => setActive(s.activeIndex)} centeredSlides className={styles.swiper}>
				{actions.map((action, i) => (
					<SwiperSlide className={styles.swiperSlide} key={action.id}>
						{action.image ? <Image src={action.image} layout="fill" className={styles.actionImage} /> : <div className={styles.actionImage} />}
					</SwiperSlide>
				))}
				<div className={styles.leftGradient} />
				<div className={styles.rightGradient} />
			</Swiper>
			<h2 className={styles.actionName}>{selectedAction?.name}</h2>
			<p className={styles.actionDescription}>{selectedAction?.description}</p>
		</div>
	);
};

export default CustomSwiper;
