import React, { useState } from 'react';
import styles from './FilterButton.module.scss';

const FilterButton = () => {
    const [filterStatus, setFilterStatus] = useState("all");

    const handleFilterButtonClick = () => {
        switch (filterStatus) {
            case "all":
                setFilterStatus("deposit");
                break;
            case "deposit":
                setFilterStatus("voting");
                break;
            case "voting":
                setFilterStatus("passed");
                break;
            case "passed":
                setFilterStatus("rejected");
                break;
            case "rejected":
                setFilterStatus("failed");
                break;
            case "failed":
                setFilterStatus("unrecognized");
                break;
            case "unrecognized":
                setFilterStatus("all");
                break;
        }
    };


    return (
        <div>
            <div className={styles.container} >
                <button className={styles.button} onClick={handleFilterButtonClick}>Filter</button>
            </div>
        </div>
    )
}

export default FilterButton