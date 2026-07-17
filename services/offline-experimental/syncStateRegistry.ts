// services/syncStateRegistry.ts

export interface SyncState {
  lastSyncedAt: number;
  syncInProgress: boolean;
  pendingEntities: string[];
  failedEntities: string[];
}

const registry: Record<string, SyncState> = {};

export const getSyncState = (entityType: string): SyncState => {
  return registry[entityType] || { lastSyncedAt: 0, syncInProgress: false, pendingEntities: [], failedEntities: [] };
};

export const updateSyncState = (entityType: string, state: Partial<SyncState>): void => {
  registry[entityType] = { ...getSyncState(entityType), ...state };
};
