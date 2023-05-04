import { STEP } from './steps';

export type ACTION = {
  id: string;
  name: string;
  description: string;
  steps: STEP[];
  image: string;
};

export type VOTE = {
  address: string;
  amount: number;
  denom: string;
}
