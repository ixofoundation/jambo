import { useEffect, useRef, useCallback, useMemo } from 'react';
import { useAppSelector, useAppDispatch } from '@store/hooks';
import { fetchAllCollectionData } from '@store/thunks/dataThunks';

export interface ProtocolCollection {
  collectionId: string;
  protocolDid: string;
  entity: string;
  admin: string;
  state?: number;
  count?: number;
  quota?: number;
  evaluated?: number;
  approved?: number;
  rejected?: number;
  disputed?: number;
  startDate?: string;
  endDate?: string;
  formName?: string;
}

function selectAllProtocolCollections(state: {
  collections: { byId: Record<string, any> };
  protocols: { formNames: Record<string, string> };
}): ProtocolCollection[] {
  const { byId } = state.collections;
  const { formNames } = state.protocols;

  return Object.values(byId).map((c: any) => ({
    collectionId: c.id,
    protocolDid: c.protocol,
    entity: c.entity,
    admin: c.admin,
    state: Number(c.state) || undefined,
    count: Number(c.count) || 0,
    quota: Number(c.quota) || 0,
    evaluated: Number(c.evaluated) || 0,
    approved: Number(c.approved) || 0,
    rejected: Number(c.rejected) || 0,
    disputed: Number(c.disputed) || 0,
    startDate: c.startDate,
    endDate: c.endDate,
    formName: formNames[c.protocol],
  }));
}

export function useProtocolCollections(entityDid?: string) {
  const dispatch = useAppDispatch();
  const collectionsById = useAppSelector((state) => state.collections.byId);
  const collectionIdsByEntity = useAppSelector((state) => state.collections.byEntityDid);
  const formNames = useAppSelector((state) => state.protocols.formNames);
  const loading = useAppSelector((state) => state.collections.loading);
  const entities = useAppSelector((state) => state.entities.byId);
  const fetchedEntityRef = useRef<string | undefined>();

  const collections = useMemo(() => {
    // If entityDid is provided, only return collections belonging to that entity
    if (entityDid) {
      const ids = collectionIdsByEntity[entityDid] ?? [];
      const filtered: Record<string, any> = {};
      for (const id of ids) {
        if (collectionsById[id]) filtered[id] = collectionsById[id];
      }
      return selectAllProtocolCollections({ collections: { byId: filtered }, protocols: { formNames } });
    }
    return selectAllProtocolCollections({ collections: { byId: collectionsById }, protocols: { formNames } });
  }, [collectionsById, collectionIdsByEntity, formNames, entityDid]);

  const protocolEntities = useMemo(() => {
    const map = new Map<string, any>();
    for (const [id, entity] of Object.entries(entities)) {
      map.set(id, entity);
    }
    return map;
  }, [entities]);

  const fetchAll = useCallback(() => {
    if (entityDid) {
      dispatch(fetchAllCollectionData({ entityDid }));
    }
  }, [dispatch, entityDid]);

  const refresh = useCallback(() => {
    if (entityDid) {
      // Don't clear state — fetched data atomically replaces the old dataset
      // so the UI keeps showing cached data until the new data arrives
      dispatch(fetchAllCollectionData({ entityDid, force: true }));
    }
  }, [dispatch, entityDid]);

  useEffect(() => {
    if (entityDid && fetchedEntityRef.current !== entityDid) {
      fetchedEntityRef.current = entityDid;
      fetchAll();
    }
  }, [entityDid, fetchAll]);

  return { collections, protocolEntities, loading, error: null, refresh };
}
