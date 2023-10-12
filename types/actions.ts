import { PROPOSAL_DATA } from './proposals';
import { STEP } from './steps';

export type ACTION = {
  id: string;
  name: string;
  description: string;
  steps: STEP[];
  image: string;
};

export type PROPOSALS = {
  data: PROPOSALS;
  proposal: PROPOSAL_DATA;
};
