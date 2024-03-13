import { calculateTimeRemaining, timeAgo } from '@utils/timestamp';
import React, { useState, useEffect, HTMLAttributes } from 'react';

type CountdownTimerProps = {
  targetDate: Date | string | number;
} & HTMLAttributes<HTMLParagraphElement>;

const CountdownTimer = ({ targetDate, ...otherProps }: CountdownTimerProps) => {
  const [timeRemaining, setTimeRemaining] = useState(calculateTimeRemaining(targetDate));

  useEffect(() => {
    const intervalId = setInterval(() => {
      setTimeRemaining(calculateTimeRemaining(targetDate));
    }, 1000);

    return () => {
      clearInterval(intervalId);
    };
  }, []);

  if (timeRemaining.isComplete) return <p {...otherProps}>{timeAgo(targetDate)}</p>;

  return (
    <p {...otherProps}>
      {timeRemaining.hours.toString().padStart(2, '0')}:{timeRemaining.minutes.toString().padStart(2, '0')}:
      {timeRemaining.seconds.toString().padStart(2, '0')}
    </p>
  );
};

export default CountdownTimer;
