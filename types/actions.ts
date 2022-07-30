import { STEP } from './steps';

export type ACTION = {
	name: string;
	description: string;
	steps: STEP[];
};
