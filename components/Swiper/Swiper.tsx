import { useState, MouseEvent } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import Image from 'next/image';
import 'swiper/css';
import cls from 'classnames';

import styles from './Swiper.module.scss';
import { ACTION } from 'types/actions';
import { pushNewRoute } from '@utils/router';
import { shimmerDataUrl } from '@utils/image';

type SwiperProps = {
	actions: ACTION[];
	swiper?: boolean;
};

const CustomSwiper = ({ actions, swiper = true }: SwiperProps) => {
	const [active, setActive] = useState(0);

	const selectedAction = actions[active];

	const onNavigate = (e: MouseEvent<HTMLDivElement>) => {
		e.stopPropagation();
		pushNewRoute(`/${actions[active].id}`);
	};

	return (
		<div>
			{swiper ? (
				<Swiper
					spaceBetween={20}
					slidesPerView="auto"
					onSlideChange={(s) => setActive(s.activeIndex)}
					centeredSlides
					className={styles.swiper}
					initialSlide={0}
				>
					{actions.map((action, i) => (
						<SwiperSlide className={styles.swiperSlide} key={action.id} onClick={onNavigate}>
							{action.image ? (
								<Image
									src={`/images/actions/${action.image}`}
									alt={action.name}
									layout="fill"
									className={styles.actionImage}
								/>
							) : (
								<div className={styles.actionImage} />
							)}
						</SwiperSlide>
					))}
					<div className={styles.leftGradient} />
					<div className={styles.rightGradient} />
				</Swiper>
			) : (
				actions.map((action, i) => (
					<div className={cls(styles.swiperSlide, styles.center)} key={action.id} onClick={onNavigate}>
						{action.image ? (
							<Image
								src={`/images/actions/${action.image}`}
								alt={action.name}
								layout="fill"
								className={styles.actionImage}
								placeholder="blur"
								blurDataURL={shimmerDataUrl()}
							/>
						) : (
							<div className={styles.actionImage} />
						)}
					</div>
				))
			)}
			<h2 className={styles.actionName}>{selectedAction?.name}</h2>
			<p className={styles.actionDescription}>{selectedAction?.description}</p>
		</div>
	);
};

export default CustomSwiper;
