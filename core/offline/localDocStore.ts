import { localDB } from './localDB';

export interface LocalDocument {
    collection: string;
    docId: string;
    data: any;
    updatedAt: number;
    isDirty: boolean;
    localRevision: number;
}

type Listener = () => void;
const listeners = new Map<string, Set<Listener>>();
const batchTimeout = new Map<string, any>();

export const localDocStore = {
    subscribe(collection: string, listener: Listener) {
        if (!listeners.has(collection)) {
            listeners.set(collection, new Set());
        }
        listeners.get(collection)!.add(listener);
        return () => {
            listeners.get(collection)?.delete(listener);
        };
    },

    notify(collection: string) {
        if (batchTimeout.has(collection)) {
            clearTimeout(batchTimeout.get(collection));
        }
        
        batchTimeout.set(collection, setTimeout(() => {
            listeners.get(collection)?.forEach(l => l());
            batchTimeout.delete(collection);
        }, 50));
    },

    async saveLocalDoc(collection: string, docId: string, data: any, isDirty: boolean = false, incrementRevision: boolean = true): Promise<void> {
        // Optimización: Evitar escrituras redundantes si la data no ha cambiado
        const existing = await localDB.getDoc(collection, docId);
        if (existing) {
            const { revision: _, isDirty: __, docId: ___, ...existingPayload } = existing;
            const { id: i, ...newPayload } = data;
            
            // Comparación simple por stringify para detectar cambios en el payload
            if (JSON.stringify(existingPayload) === JSON.stringify(newPayload) && existing.isDirty === isDirty) {
                return;
            }
        }

        await localDB.saveDoc(collection, docId, data, isDirty);
        this.notify(collection);
    },

    async saveLocalDocsBatch(collection: string, docs: any[]): Promise<void> {
        if (!docs || docs.length === 0) return;
        
        // Obtener colección actual una sola vez para comparación masiva
        const localItems = await localDB.getCollection(collection);
        const localMap = new Map(localItems.map(item => [item.docId, item]));
        
        const writePromises = [];
        let hasChanges = false;

        for (const doc of docs) {
            const docId = doc.docId || doc.id;
            const existing = localMap.get(docId);
            
            let needsUpdate = true;
            if (existing) {
                const { revision: _, isDirty: __, docId: ___, ...existingPayload } = existing;
                const { id: i, ...newPayload } = doc;
                
                if (JSON.stringify(existingPayload) === JSON.stringify(newPayload) && !existing.isDirty) {
                    needsUpdate = false;
                }
            }

            if (needsUpdate) {
                writePromises.push(localDB.saveDoc(collection, docId, doc, false));
                hasChanges = true;
            }
        }

        if (hasChanges) {
            await Promise.all(writePromises);
            this.notify(collection);
        }
    },

    async getLocalDoc(collection: string, docId: string): Promise<LocalDocument | null> {
        const doc = await localDB.getDoc(collection, docId);
        if (!doc) return null;
        
        return {
            collection,
            docId: doc.docId || docId,
            data: doc,
            isDirty: doc.isDirty || false,
            updatedAt: Date.now(),
            localRevision: doc.revision || 1
        };
    },

    async clearDirtyStateSafe(collection: string, docId: string, expectedRevision: number): Promise<boolean> {
        const doc = await localDB.getDoc(collection, docId);
        if (doc && doc.revision === expectedRevision) {
            await localDB.saveDoc(collection, docId, doc, false);
            this.notify(collection);
            return true;
        }
        return false;
    },

    async getLocalCollection(collection: string): Promise<LocalDocument[]> {
        const docs = await localDB.getCollection(collection);
        return docs.map(doc => ({
            collection,
            docId: doc.docId || doc.id || "temp_" + Math.random().toString(36).substring(7),
            data: doc,
            isDirty: doc.isDirty || false,
            updatedAt: Date.now(),
            localRevision: doc.revision || 1
        }));
    },

    async removeLocalDoc(collection: string, docId: string): Promise<void> {
        await localDB.deleteDoc(collection, docId);
        this.notify(collection);
    }
};
