import type { RootState } from '../index';

export function selectClaimsWithSubclaims(state: RootState, parentCollectionId: string): string[] | undefined {
  return state.subclaims.claimsWithSubclaimsByParent[parentCollectionId];
}
