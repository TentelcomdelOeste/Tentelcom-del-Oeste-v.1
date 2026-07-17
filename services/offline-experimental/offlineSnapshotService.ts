// services/offline-experimental/offlineSnapshotService.ts

import { saveEntity, getAllEntities } from '../localRepositories';
import { STORES } from '../localDb';

export const saveSnapshot = async (moduleKey: string, data: any): Promise<void> => {
  await saveEntity(STORES.metadata, { id: `snapshot_${moduleKey}`, data, timestamp: Date.now() });
};

export const getSnapshot = async (moduleKey: string): Promise<any> => {
  const snapshots = await getAllEntities(STORES.metadata);
  const snapshot = snapshots.find(s => s.id === `snapshot_${moduleKey}`);
  return snapshot ? snapshot.data : null;
};
