import { useSyncExternalStore, useCallback } from 'react';
import { localDocStore, LocalDocument } from '../core/offline/localDocStore';

/**
 * Cache to provide synchronous snapshots for useSyncExternalStore.
 * While SQLite is async, this cache allows React to read the "last known" 
 * state during the render phase.
 */
const collectionCache = new Map<string, { docs: LocalDocument[]; version: number }>();
const EMPTY_ARRAY: LocalDocument[] = [];

export function useLocalCollection(collectionName: string): LocalDocument[] {
    const getSnapshot = useCallback(() => {
        const cached = collectionCache.get(collectionName);
        return cached ? cached.docs : EMPTY_ARRAY;
    }, [collectionName]);

    const subscribe = useCallback((onStoreChange: () => void) => {
        // Initial fetch to populate cache if empty
        if (!collectionCache.has(collectionName)) {
            localDocStore.getLocalCollection(collectionName).then(docs => {
                collectionCache.set(collectionName, { docs, version: Date.now() });
                onStoreChange();
            });
        }

        // Subscribe to localDocStore notifications
        return localDocStore.subscribe(collectionName, async () => {
            try {
                const docs = await localDocStore.getLocalCollection(collectionName);
                collectionCache.set(collectionName, { docs, version: Date.now() });
                onStoreChange();
            } catch (error) {
                console.error(`[useLocalCollection] Error refreshing ${collectionName}:`, error);
            }
        });
    }, [collectionName]);

    // useSyncExternalStore ensures React is always in sync with our external state
    return useSyncExternalStore(subscribe, getSnapshot);
}
