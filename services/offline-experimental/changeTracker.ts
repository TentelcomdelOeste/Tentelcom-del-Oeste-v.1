// services/offline-experimental/changeTracker.ts

import { STORES } from '../localDb';

export interface EntityChange {
  entityId: string;
  updatedAt: number;
  syncState: 'synced' | 'pending' | 'conflict';
}

export const markAsDirty = async (entityType: keyof typeof STORES, entityId: string): Promise<void> => {
  // Logic to update entity metadata and mark as pending
  console.log(`[ChangeTracker] Marking ${entityType}:${entityId} as dirty`);
};
