import { useContext, useEffect, useState } from 'react';
import Image from 'next/image';
import cls from 'classnames';

import utilsStyles from '@styles/utils.module.scss';
import styles from './ChainSelector.module.scss';
import BottomSheet from '@components/BottomSheet/BottomSheet';
import { ChainContext } from '@contexts/chain';
import Card, { CARD_SIZE } from '@components/Card/Card';
import useModalState from '@hooks/modalState';
import Loader from '@components/Loader/Loader';
import ImageWithFallback from '@components/ImageFallback/ImageFallback';

type ChainSelectorProps = {
	username?: string;
};

const ChainSelector = ({ username }: ChainSelectorProps) => {
	const [currentChainId, setCurrentChainId] = useState<string | undefined>();
	const [chainSelectVisible, showChainSelect, hideChainSelect] = useModalState(false);
	const { chains, chainInfo, chain, updateChainId } = useContext(ChainContext);

	useEffect(() => {
		if (chainInfo?.chainId && !chain.chainLoading && chainInfo?.chainId !== currentChainId)
			setCurrentChainId(chainInfo.chainId);
		else setCurrentChainId(undefined);
	}, [chainInfo, chain.chainLoading]);

	useEffect(() => {
		console.log({ currentChainId });
		if (currentChainId) {
			hideChainSelect();
		}
	}, [currentChainId]);

	const onChainClick = (chainId: string) => () => {
		if (chainInfo?.chainId !== chainId) {
			setCurrentChainId(undefined);
			updateChainId(chainId);
		}
	};

	return (
		<>
			<ChainSelectorButton username={username} chainImg={chainInfo?.chainSymbolImageUrl} onClick={showChainSelect} />
			{chainSelectVisible && (
				<BottomSheet dismissable={!!currentChainId} onClose={hideChainSelect} title="Select a Chain">
					{chains.map((chainOption) => (
						<Card
							className={cls(styles.chainWrapper)}
							key={chainOption.chainId}
							onClick={onChainClick(chainOption.chainId)}
							size={CARD_SIZE.small}
						>
							<div className={utilsStyles.rowAlignCenter}>
								{chainOption?.chainSymbolImageUrl && (
									<div className={styles.chainImage}>
										<Image src={chainOption.chainSymbolImageUrl} alt={chainOption.chainName} height={32} width={32} />
									</div>
								)}
								<p className={styles.chainName}>{chainOption.chainName}</p>
							</div>
							{chainInfo?.chainId === chainOption.chainId && chain.chainLoading && <Loader size={30} />}
						</Card>
					))}
				</BottomSheet>
			)}
		</>
	);
};

export default ChainSelector;

type ChainSelectorButtonProps = {
	username?: string;
	chainImg?: string;
	onClick?: () => void;
};

export const ChainSelectorButton = ({ onClick, chainImg, username }: ChainSelectorButtonProps) => {
	const clickable = !!onClick;

	return (
		<div className={cls(utilsStyles.rowAlignCenter, clickable && styles.clickable)} onClick={onClick}>
			{chainImg && (
				<div className={styles.chainImage}>
					<ImageWithFallback
						fallbackSrc={'/images/chain-logos/fallback.png'}
						src={chainImg}
						width={32}
						height={32}
						alt="Chain Selector"
					/>
				</div>
			)}
			<h3 className={styles.userName}>{username ?? 'Hi'}</h3>
		</div>
	);
};
