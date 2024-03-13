import { Timestamp } from '@ixo/impactxclient-sdk/types/codegen/google/protobuf/timestamp';

export const timestampToDate = (timestamp: Timestamp): Date | null => {
  if (!timestamp) return null;

  // Extract seconds and nanoseconds from the Timestamp object
  const { seconds, nanos } = timestamp;

  // Convert seconds and nanoseconds to milliseconds
  const milliseconds = seconds.toNumber() * 1000 + nanos / 1000000;

  // Create a Date object using the calculated milliseconds
  return new Date(milliseconds);
};

export const toDate = (input: Date | string | number): Date | null => {
  if (input === undefined || input === null) return null;

  if (input instanceof Date) {
    // If the input is already a Date object, return it as is.
    return input;
  } else if (typeof input === 'string') {
    // If the input is a date string, try to parse it into a Date object.
    const parsedDate = new Date(input);
    if (!isNaN(parsedDate.getTime())) return parsedDate;
  } else if (typeof input === 'number') {
    // If the input is a millisecond number, create a Date object using it.
    return new Date(input);
  }

  // If none of the above conditions are met, return null to indicate an invalid input.
  return null;
};

export const timeAgo = (timestamp: Date | string | number): string => {
  if (timestamp === undefined || timestamp === null) return 'unknown';

  const currentDate = new Date();
  const inputDate = toDate(timestamp);

  if (!inputDate) return 'unknown';

  const millisecondsAgo = currentDate.getTime() - inputDate.getTime();
  const secondsAgo = Math.floor(millisecondsAgo / 1000);
  const minutesAgo = Math.floor(secondsAgo / 60);
  const hoursAgo = Math.floor(minutesAgo / 60);
  const daysAgo = Math.floor(hoursAgo / 24);
  const weeksAgo = Math.floor(daysAgo / 7);

  // Calculate months and years ago
  const currentMonth = currentDate.getMonth() + 1;
  const inputMonth = inputDate.getMonth() + 1;
  const currentYear = currentDate.getFullYear();
  const inputYear = inputDate.getFullYear();
  const monthsAgo = currentMonth - inputMonth + (currentYear - inputYear) * 12;

  if (monthsAgo >= 12) {
    // If more than or equal to 12 months (1 year), return the number of years
    const yearsAgo = Math.floor(monthsAgo / 12);
    return `${yearsAgo} year${yearsAgo > 1 ? 's' : ''} ago`;
  } else if (monthsAgo >= 1) {
    // If more than or equal to 1 month, return the number of months
    return `${monthsAgo} month${monthsAgo > 1 ? 's' : ''} ago`;
  } else if (weeksAgo >= 4) {
    // If more than or equal to 4 weeks, return the number of weeks
    return `${weeksAgo} week${weeksAgo > 1 ? 's' : ''} ago`;
  } else if (weeksAgo >= 1) {
    // If more than or equal to 1 week, return the number of weeks
    return `${weeksAgo} week${weeksAgo > 1 ? 's' : ''} ago`;
  } else if (daysAgo >= 1) {
    // If more than or equal to 1 day, return the number of days
    return `${daysAgo} day${daysAgo > 1 ? 's' : ''} ago`;
  } else if (hoursAgo >= 1) {
    // If more than or equal to 1 hour, return the number of hours
    return `${hoursAgo} hour${hoursAgo > 1 ? 's' : ''} ago`;
  } else if (minutesAgo >= 1) {
    // If more than or equal to 1 minute, return the number of minutes
    return `${minutesAgo} minute${minutesAgo > 1 ? 's' : ''} ago`;
  } else {
    // If less than 1 minute, return the number of seconds
    return `${secondsAgo} second${secondsAgo > 1 ? 's' : ''} ago`;
  }
};

export const calculateTimeRemaining = (targetDate: Date | string | number) => {
  if (targetDate === undefined || targetDate === null)
    return {
      hours: 0,
      minutes: 0,
      seconds: 0,
      isComplete: true,
    };

  const currentDate = new Date();
  const targetDateObj = toDate(targetDate);

  if (!targetDateObj)
    return {
      hours: 0,
      minutes: 0,
      seconds: 0,
      isComplete: true,
    };

  const timeDifference = targetDateObj.getTime() - currentDate.getTime();

  if (timeDifference <= 0)
    return {
      hours: 0,
      minutes: 0,
      seconds: 0,
      isComplete: true,
    };

  const seconds = Math.floor(timeDifference / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  const remainingSeconds = seconds % 60;
  const remainingMinutes = minutes % 60;
  const remainingHours = hours % 24;

  return {
    hours: remainingHours,
    minutes: remainingMinutes,
    seconds: remainingSeconds,
    isComplete: false,
  };
};
