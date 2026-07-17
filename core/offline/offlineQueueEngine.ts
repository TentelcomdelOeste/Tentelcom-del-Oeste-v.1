import { localDB } from './localDB';

export type MutationOperation = 'create' | 'update' | 'delete';
export type MutationStatus = 'pending' | 'failed' | 'processing' | 'dead' | 'corrupt' | 'completed';

export interface PendingMutation {
    id: string; 
    collection: string;
    docId: string; 
    operation: MutationOperation;
    payload: any;
    timestamp: number;
    status: MutationStatus;
    retryCount: number;
    error?: string;
}

export const offlineQueueEngine = {
    async enqueueMutation(collection: string, docId: string, operation: MutationOperation, payload: any): Promise<string> {
        return await localDB.enqueueMutation(collection, docId, operation, payload);
    },

    async getPendingQueue(): Promise<PendingMutation[]> {
        return await localDB.getPendingQueue();
    },

    async markEntryStatus(id: string, status: MutationStatus, error?: string): Promise<void> {
        await localDB.markEntryStatus(id, status, error);
    },

    async removeEntry(id: string): Promise<void> {
        await localDB.removeEntry(id);
    },

    async purgeDeadEntries(): Promise<void> {
        await localDB.purgeDeadEntries();
    }
};