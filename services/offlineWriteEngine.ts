// services/offlineWriteEngine.ts

import { addToQueue, Mutation } from './offlineMutationQueue';
import { logMutation } from './offlineMutationJournal';
import { saveEntity, removeEntity } from './localRepositories';
import { STORES } from './localDb';

const generateUUID = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

export const createOffline = async (entityType: keyof typeof STORES, data: any): Promise<void> => {
  const operationId = generateUUID();
  const mutation: Mutation = {
    id: operationId,
    entityType,
    entityId: data.id || operationId,
    operationType: 'create',
    payload: data,
    createdAt: Date.now(),
    syncStatus: 'pending',
    retryCount: 0
  };

  // Write local
  await saveEntity(entityType, data);
  // Queue
  await addToQueue(mutation);
  await logMutation(mutation, 'pending');
};

export const updateOffline = async (entityType: keyof typeof STORES, data: any): Promise<void> => {
  const mutation: Mutation = {
    id: generateUUID(),
    entityType,
    entityId: data.id,
    operationType: 'update',
    payload: data,
    createdAt: Date.now(),
    syncStatus: 'pending',
    retryCount: 0
  };

  // Write local
  await saveEntity(entityType, data);
  // Queue
  await addToQueue(mutation);
  await logMutation(mutation, 'pending');
};

export const deleteOffline = async (entityType: keyof typeof STORES, entityId: string): Promise<void> => {
  const mutation: Mutation = {
    id: generateUUID(),
    entityType,
    entityId,
    operationType: 'delete',
    payload: { id: entityId },
    createdAt: Date.now(),
    syncStatus: 'pending',
    retryCount: 0
  };

  // Delete local
  await removeEntity(entityType, entityId);
  // Queue
  await addToQueue(mutation);
  await logMutation(mutation, 'pending');
};

