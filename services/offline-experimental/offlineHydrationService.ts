// services/offline-experimental/offlineHydrationService.ts

import { saveEntity } from '../localRepositories';
import { STORES } from '../localDb';

export const hydrateInitialData = async (storeName: keyof typeof STORES, fetchFn: () => Promise<any[]>): Promise<void> => {
  try {
    const data = await fetchFn();
    for (const item of data) {
      await saveEntity(storeName, item);
    }
    console.log(`[OfflineHydration] Hydrated ${storeName}`);
  } catch (err) {
    console.error(`[OfflineHydration] Error hydrating ${storeName}:`, err);
  }
};
