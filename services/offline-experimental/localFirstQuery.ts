// services/offline-experimental/localFirstQuery.ts

import { getAllEntities, saveEntity, clearStore } from '../localRepositories';
import { STORES } from '../localDb';

export const queryLocalFirst = async <T>(
  storeName: keyof typeof STORES,
  firestoreFetchFn: () => Promise<T[]>,
  onLocalData: (data: T[]) => void
): Promise<T[]> => {
  // 1. Try local data first
  try {
    const localData = await getAllEntities(storeName);
    if (localData && localData.length > 0) {
      console.log(`[LocalFirst] Found ${localData.length} items in ${storeName}`);
      onLocalData(localData);
    }
  } catch (err) {
    console.error(`[LocalFirst] Error reading local ${storeName}:`, err);
  }

  // 2. Fetch from Firestore (silently)
  try {
    const remoteData = await firestoreFetchFn();
    
    // 3. Update cache
    await clearStore(storeName);
    for (const item of remoteData) {
      await saveEntity(storeName, item);
    }
    
    return remoteData;
  } catch (err) {
    console.error(`[LocalFirst] Error fetching remote ${storeName}:`, err);
    return [];
  }
};
