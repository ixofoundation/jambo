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
