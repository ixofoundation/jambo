import React from 'react';
import styles from './GovProposals.module.scss';

interface VoteBtnProps {
    backgroundColor: string;
    children: React.ReactNode;
    onClick: () => void
}

const VoteBtn = ({ backgroundColor, children, onClick }: VoteBtnProps) => {
    const VoteBtnsStyle = {
        backgroundColor: backgroundColor,
    }
    return (
        <button
            className={styles.voteBtnStyles}
            style={VoteBtnsStyle}
            onClick={onClick} >
            {children}
        </button>
    )
}

export default VoteBtn