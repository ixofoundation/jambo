import { utils } from '@ixo/impactxclient-sdk';
import { Timestamp } from '@ixo/impactxclient-sdk/types/codegen/google/protobuf/timestamp';

/**
 * Converts a timestamp object to a timestamp
 * @param timestamp - The timestamp object to convert
 * @returns The timestamp
 */
export function convertTimestampObjectToTimestamp(timestamp: Timestamp): number | undefined {
  try {
    const date = utils.proto.fromTimestamp(timestamp);

    return date.getTime();
  } catch (error) {
    return undefined;
  }
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function minDelay(p: Promise<any>, ms: number) {
  const [res] = await Promise.all([p, delay(ms)]);
  return res;
}

export async function maxDelay<T>(p: Promise<T>, ms: number): Promise<[boolean, T | undefined]> {
  const timeout = new Promise<[boolean, T | undefined]>((resolve) => setTimeout(() => resolve([false, undefined]), ms));

  const result = await Promise.race([p.then<[boolean, T | undefined]>((value) => [true, value]), timeout]);

  return result;
}

export async function waitUntil(
  interval: number,
  maxAttempts: number,
  condition: () => boolean | Promise<boolean>,
): Promise<boolean> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const conditionMet = await condition(); // Handle async/sync conditions
    if (conditionMet) {
      return true; // Condition met
    }
    await delay(interval); // Wait for the specified interval
  }
  return false; // Condition not met within the allowed time
}

export const addDays = (date: Date, days: number) => {
  var result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};
