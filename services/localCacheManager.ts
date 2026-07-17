// services/localCacheManager.ts

import { getAllEntities, clearStore, saveEntitiesBatch } from './localRepositories';
import { STORES } from './localDb';

// Simple TTL enforcement for now. 
// Can be extended with timestamps.
const MAX_CACHE_SIZE = 1000;

export const cleanOldCache = async (storeName: keyof typeof STORES): Promise<void> => {
  const entities = await getAllEntities(storeName);
  
  if (entities.length > MAX_CACHE_SIZE) {
    // Simple strategy: Clear all if too large, can be optimized later
    await clearStore(storeName);
  }
};

export const hydrateCache = async (storeName: keyof typeof STORES, data: any[]): Promise<void> => {
  await clearStore(storeName);
  // Async batch save to avoid blocking execution flow unnecessarily
  saveEntitiesBatch(storeName, data).catch(err => {
    console.error(`[IndexedDB] Error hydrating cache for ${storeName}:`, err);
  });
};
