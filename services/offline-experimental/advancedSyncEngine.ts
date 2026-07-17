// services/offline-experimental/advancedSyncEngine.ts

import { getAllEntities, saveEntity } from '../localRepositories';
import { STORES } from '../localDb';
import { reconcile } from './reconciliationManager';
import { updateSyncState } from './syncStateRegistry';

export const syncEntityStore = async (
  storeName: keyof typeof STORES,
  remoteFetcher: () => Promise<any[]>
): Promise<void> => {
  updateSyncState(storeName, { syncInProgress: true });
  
  try {
    const localData = await getAllEntities(storeName);
    const remoteData = await remoteFetcher();
    
    const { toUpdate, toCreate } = reconcile(localData, remoteData);
    
    // Applying reconciliation
    for (const item of [...toUpdate, ...toCreate]) {
      await saveEntity(storeName, item);
    }
    
    updateSyncState(storeName, { lastSyncedAt: Date.now(), syncInProgress: false });
    console.log(`[AdvancedSync] Successfully synced ${storeName}`);
  } catch (err) {
    console.error(`[AdvancedSync] Error syncing ${storeName}:`, err);
    updateSyncState(storeName, { syncInProgress: false });
  }
};
