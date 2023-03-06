import { DELEGATION, DELEGATION_REWARD, VALIDATOR } from 'types/validators';

export const linkDelegationsAndRewards = (
  validators: VALIDATOR[] = [],
  delegations: DELEGATION[] = [],
  rewards: DELEGATION_REWARD[] = [],
): VALIDATOR[] | undefined => {
  if (!validators) return;
  const validatorDelegationMap = new Map<string, DELEGATION>();
  const validatorRewardsMap = new Map<string, DELEGATION_REWARD>();
  const result: VALIDATOR[] = [];
  for (const delegation of delegations) {
    validatorDelegationMap.set(delegation.validatorAddress, delegation);
  }
  for (const reward of rewards) {
    validatorRewardsMap.set(reward.validatorAddress, reward);
  }
  for (const validator of validators) {
    const validatorDelegation = validatorDelegationMap.get(validator.address);
    const validatorRewards = validatorRewardsMap.get(validator.address);
    result.push({ ...validator, delegation: validatorDelegation, rewards: validatorRewards?.rewards });
  }
  return result;
};
