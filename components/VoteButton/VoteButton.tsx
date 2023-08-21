import React from "react";
import styles from './VoteButton.module.scss'

interface VoteBtnProps {
    backgroundColor: string;
    children: React.ReactNode;
    onClick: () => void
}

const VoteButton = ({ backgroundColor, children, onClick }: VoteBtnProps) => {
    const VoteBtnsStyle = {
        backgroundColor: backgroundColor,
    }

    return (
        <button className={styles.button} onClick={onClick} style={VoteBtnsStyle} >
            {children}
        </button>
    )
}

export default VoteButton;