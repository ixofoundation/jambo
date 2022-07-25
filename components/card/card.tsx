import { HTMLAttributes } from 'react';

import styles from './card.module.scss';

type CardProps = {
	label?: string;
	successMark?: boolean;
} & HTMLAttributes<HTMLDivElement>;

const Card = ({ children, ...other }: CardProps) => {
	return (
		<div className={styles.card} {...other}>
			{children}
		</div>
	);
};

export default Card;
