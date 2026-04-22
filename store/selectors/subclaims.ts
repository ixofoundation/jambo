import type { RootState } from '../index';

export function selectAllowedSubcollectionsFor(state: RootState, parentCollectionId: string): string[] | undefined {
  return state.subclaims.allowedSubcollectionsByParent[parentCollectionId];
}

export function selectParentOfSubcollection(state: RootState, subCollectionId: string): string | null {
  const map = state.subclaims.allowedSubcollectionsByParent;
  for (const parentId of Object.keys(map)) {
    if (map[parentId]?.includes(subCollectionId)) return parentId;
  }
  return null;
}

export function selectClaimsWithSubclaims(state: RootState, parentCollectionId: string): string[] | undefined {
  return state.subclaims.claimsWithSubclaimsByParent[parentCollectionId];
}
