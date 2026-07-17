// services/offlineMutationQueue.ts

import { saveEntity, getAllEntities, removeEntity} from './localRepositories';
import { STORES } from './localDb';

export interface Mutation {
  id: string; // operationId
  entityType: string;
  entityId: string;
  operationType: 'create' | 'update' | 'delete';
  payload: any;
  createdAt: number;
  syncStatus: 'pending' | 'syncing' | 'synced' | 'failed';
  retryCount: number;
}

export const addToQueue = async (mutation: Mutation): Promise<void> => {
  await saveEntity(STORES.mutation_queue, mutation);
};

export const getPendingMutations = async (): Promise<Mutation[]> => {
  const all = await getAllEntities(STORES.mutation_queue) as Mutation[];
  return all.filter(m => m.syncStatus === 'pending' || m.syncStatus === 'failed');
};

export const removeFromQueue = async (id: string): Promise<void> => {
  await removeEntity(STORES.mutation_queue, id);
};
