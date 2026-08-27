import { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection } from '@capacitor-community/sqlite';
import { Capacitor } from '@capacitor/core';
import localforage from 'localforage';

export type MutationOperation = 'create' | 'update' | 'delete';
export type MutationStatus = 'pending' | 'failed' | 'processing' | 'dead' | 'corrupt' | 'completed';

export class LocalDB {
    private sqlite: SQLiteConnection;
    private db: SQLiteDBConnection | null = null;
    private isInitialized: boolean = false;
    private dbName: string = "offline_core_db";
    private initPromise: Promise<void> | null = null;

    constructor() {
        this.sqlite = new SQLiteConnection(CapacitorSQLite);
        
        // Initialize localforage for web
        if (Capacitor.getPlatform() === 'web') {
            localforage.config({
                name: 'AppOfflineStore',
                storeName: 'keyvaluepairs'
            });
        }
    }

    public async init() {
        if (this.initPromise) return this.initPromise;
        
        this.initPromise = (async () => {
            try {
                console.log("LocalDB: Initializing...");
                
                if (Capacitor.getPlatform() === 'web') {
                    console.log("LocalDB: Skipping SQLite, using IndexedDB (localforage)...");
                    this.isInitialized = true;
                } else {
                    // Android/iOS Native SQLite
                    console.log("LocalDB: Initializing Native SQLite...");
                    
                    // Check connections consistency
                    const consistency = await this.sqlite.checkConnectionsConsistency();
                    const isConn = (await this.sqlite.isConnection(this.dbName, false)).result;
                    
                    if (consistency.result && isConn) {
                        this.db = await this.sqlite.retrieveConnection(this.dbName, false);
                    } else {
                        this.db = await this.sqlite.createConnection(this.dbName, false, "no-encryption", 1, false);
                    }
                    
                    await this.db.open();
                    
                    await this.db.execute(`
                        CREATE TABLE IF NOT EXISTS local_metadata (
                            key TEXT PRIMARY KEY NOT NULL,
                            value TEXT NOT NULL,
                            updatedAt INTEGER NOT NULL
                        );

                        CREATE TABLE IF NOT EXISTS offline_mutations (
                            id TEXT PRIMARY KEY NOT NULL,
                            collection TEXT NOT NULL,
                            docId TEXT NOT NULL,
                            operation TEXT NOT NULL,
                            payload TEXT NOT NULL,
                            timestamp INTEGER NOT NULL,
                            status TEXT NOT NULL,
                            retryCount INTEGER NOT NULL,
                            error TEXT
                        );

                        CREATE TABLE IF NOT EXISTS local_documents (
                            collection TEXT NOT NULL,
                            docId TEXT NOT NULL,
                            data TEXT NOT NULL,
                            updatedAt INTEGER NOT NULL,
                            isDirty INTEGER NOT NULL,
                            localRevision INTEGER NOT NULL DEFAULT 1,
                            PRIMARY KEY (collection, docId)
                        );

                        CREATE TABLE IF NOT EXISTS executed_operations (
                            id TEXT PRIMARY KEY NOT NULL,
                            executedAt INTEGER NOT NULL
                        );

                        CREATE TABLE IF NOT EXISTS pdf_upload_queue (
                            id TEXT PRIMARY KEY NOT NULL,
                            localPath TEXT NOT NULL,
                            fileName TEXT NOT NULL,
                            mimeType TEXT NOT NULL,
                            module TEXT NOT NULL,
                            targetCollection TEXT NOT NULL,
                            targetDocId TEXT NOT NULL,
                            status TEXT NOT NULL,
                            attempts INTEGER NOT NULL DEFAULT 0,
                            createdAt INTEGER NOT NULL,
                            updatedAt INTEGER NOT NULL,
                            firebasePath TEXT,
                            errorLog TEXT,
                            checksum TEXT NOT NULL
                        );

                        CREATE TABLE IF NOT EXISTS deleted_tombstones (
                            collection TEXT NOT NULL,
                            docId TEXT NOT NULL,
                            deletedAt INTEGER NOT NULL,
                            PRIMARY KEY (collection, docId)
                        );
                    `);
                    
                    this.isInitialized = true;
                }
                
                console.log("LocalDB: Initialization Complete.");
            } catch (e) {
                console.error("LocalDB: Error during initialization", e);
            }
        })();
        
        return this.initPromise;
    }

    public async checkConnectionAlive(): Promise<boolean> {
        try {
            await localforage.getItem('__connection_check__');
            return true;
        } catch (error) {
            console.warn('[LocalDB] checkConnectionAlive falló:', error);
            return false;
        }
    }

    public async saveDoc(collection: string, docId: string, data: any, isDirty: boolean = false): Promise<void> {
        if (Capacitor.getPlatform() === 'web') {
            const key = `${collection}:${docId}`;
            const existing = await localforage.getItem<any>(key);
            let revision = 1;
            if (existing) {
                revision = (existing.revision || 0) + 1;
            }
            // Ensure docId is included in the stored object for consistency with SQLite retrieval
            await localforage.setItem(key, { ...data, docId, revision, isDirty });
        } else {
            await this.init();
            await this.initPromise;
            // Existing SQLite implementation ...
            const timestamp = Date.now();
            const payload = JSON.stringify(data);
            const dirtyFlag = isDirty ? 1 : 0;
            
            let newRev = 1;
            const res = await this.db!.query(
                `SELECT localRevision FROM local_documents WHERE collection = ? AND docId = ?`,
                [collection, docId]
            );
            if (res.values && res.values.length > 0) {
                 newRev = res.values[0].localRevision + 1;
            }
            await this.db!.run(
                `INSERT OR REPLACE INTO local_documents (collection, docId, data, updatedAt, isDirty, localRevision) VALUES (?, ?, ?, ?, ?, ?)`,
                [collection, docId, payload, timestamp, dirtyFlag, newRev]
            );
        }
    }

    public async getDoc(collection: string, docId: string): Promise<any | null> {
        if (Capacitor.getPlatform() === 'web') {
            const key = `${collection}:${docId}`;
            const val = await localforage.getItem<any>(key);
            return val ? { ...val, docId } : null;
        } else {
            await this.init();
            await this.initPromise;
            const res = await this.db!.query(
                `SELECT docId, data, isDirty, updatedAt, localRevision FROM local_documents WHERE collection = ? AND docId = ?`,
                [collection, docId]
            );
            if (res.values && res.values.length > 0) {
                const row = res.values[0];
                return {
                    docId: row.docId,
                    ...JSON.parse(row.data),
                    isDirty: row.isDirty === 1,
                    revision: row.localRevision
                };
            }
            return null;
        }
    }

    public async getCollection(collection: string): Promise<any[]> {
        if (Capacitor.getPlatform() === 'web') {
            const results: any[] = [];
            await localforage.iterate((value: any, key: string) => {
                if (key.startsWith(`${collection}:`)) {
                    const docId = key.substring(collection.length + 1);
                    results.push({ ...value, docId });
                }
            });
            return results;
        } else {
            await this.init();
            await this.initPromise;
            const res = await this.db!.query(
                `SELECT docId, data, isDirty, updatedAt, localRevision FROM local_documents WHERE collection = ?`,
                [collection]
            );
            return (res.values || []).map(row => ({
                docId: row.docId,
                ...JSON.parse(row.data),
                isDirty: row.isDirty === 1,
                revision: row.localRevision
            }));
        }
    }

    public async enqueueMutation(collection: string, docId: string, operation: MutationOperation, payload: any): Promise<string> {
        const id = (typeof crypto !== 'undefined' && crypto.randomUUID) 
            ? crypto.randomUUID() 
            : `mut_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
        const timestamp = Date.now();
        if (Capacitor.getPlatform() === 'web') {
            await localforage.setItem(`mutation:${id}`, { id, collection, docId, operation, payload, timestamp, status: 'pending', retryCount: 0 });
            return id;
        } else {
            await this.init();
            await this.initPromise;
            await this.db!.run(
                `INSERT INTO offline_mutations (id, collection, docId, operation, payload, timestamp, status, retryCount) VALUES (?, ?, ?, ?, ?, ?, 'pending', 0)`,
                [id, collection, docId, operation, JSON.stringify(payload), timestamp]
            );
            return id;
        }
    }

    public async getPendingQueue(): Promise<any[]> {
        if (Capacitor.getPlatform() === 'web') {
            const results: any[] = [];
            await localforage.iterate((value: any, key: string) => {
                if (key.startsWith('mutation:')) {
                    if (value.status === 'pending' || value.status === 'failed') {
                        results.push(value);
                    }
                }
            });
            return results.sort((a, b) => a.timestamp - b.timestamp);
        } else {
            await this.init();
            await this.initPromise;
            const res = await this.db!.query(`SELECT * FROM offline_mutations WHERE status = 'pending' OR status = 'failed' ORDER BY timestamp ASC`);
            return (res.values || []).map(row => ({
                ...row,
                payload: JSON.parse(row.payload)
            }));
        }
    }

    public async markEntryStatus(id: string, status: MutationStatus, error?: string): Promise<void> {
        if (Capacitor.getPlatform() === 'web') {
            const item = await localforage.getItem<any>(`mutation:${id}`);
            if (item) {
                if (status === 'failed') {
                    item.retryCount = (item.retryCount || 0) + 1;
                }
                item.status = status;
                item.error = error;
                await localforage.setItem(`mutation:${id}`, item);
            }
        } else {
            await this.init();
            await this.initPromise;
            if (status === 'failed') {
                await this.db!.run(`UPDATE offline_mutations SET status = ?, error = ?, retryCount = retryCount + 1 WHERE id = ?`, [status, error || null, id]);
            } else {
                await this.db!.run(`UPDATE offline_mutations SET status = ?, error = ? WHERE id = ?`, [status, error || null, id]);
            }
        }
    }

    public async removeEntry(id: string): Promise<void> {
        if (Capacitor.getPlatform() === 'web') {
            await localforage.removeItem(`mutation:${id}`);
        } else {
            await this.init();
            await this.initPromise;
            await this.db!.run(`DELETE FROM offline_mutations WHERE id = ?`, [id]);
        }
    }

    /**
     * Retorna la conexión SQLite activa (solo nativo) o null en web.
     * Usado por SyncEngine para idempotencia via tabla executed_operations.
     * En web, la idempotencia no aplica (IndexedDB no tiene SQL), retorna null
     * y SyncEngine omite ese bloque de forma segura con el guard `if (dbRef)`.
     */
    public async getReadyDb(): Promise<SQLiteDBConnection | null> {
        if (Capacitor.getPlatform() === 'web') {
            return null;
        }
        await this.init();
        await this.initPromise;
        return this.db;
    }

    /**
     * Elimina un documento del store local por colección y docId.
     * Requerido por localDocStore.removeLocalDoc().
     */
    public async deleteDoc(collection: string, docId: string): Promise<void> {
        if (Capacitor.getPlatform() === 'web') {
            await localforage.removeItem(`${collection}:${docId}`);
        } else {
            await this.init();
            await this.initPromise;
            await this.db!.run(
                `DELETE FROM local_documents WHERE collection = ? AND docId = ?`,
                [collection, docId]
            );
        }
    }

    /**
     * Elimina todas las mutaciones con status 'dead' o 'completed' de la cola.
     * Llamado por SyncEngine al final de cada ciclo (purgeDeadEntries).
     */
    public async purgeDeadEntries(): Promise<void> {
        if (Capacitor.getPlatform() === 'web') {
            const keysToDelete: string[] = [];
            await localforage.iterate((value: any, key: string) => {
                if (key.startsWith('mutation:') && (value.status === 'dead' || value.status === 'completed')) {
                    keysToDelete.push(key);
                }
            });
            for (const key of keysToDelete) {
                await localforage.removeItem(key);
            }
        } else {
            await this.init();
            await this.initPromise;
            await this.db!.run(
                `DELETE FROM offline_mutations WHERE status = 'dead' OR status = 'completed'`
            );
        }
    }

    /**
     * Guarda un registro de lápida (tombstone) cuando un documento se confirma o marca como eliminado.
     */
    public async saveTombstone(collection: string, docId: string): Promise<void> {
        const deletedAt = Date.now();
        if (Capacitor.getPlatform() === 'web') {
            await localforage.setItem(`tombstone:${collection}:${docId}`, { collection, docId, deletedAt });
        } else {
            await this.init();
            await this.initPromise;
            await this.db!.run(
                `INSERT OR REPLACE INTO deleted_tombstones (collection, docId, deletedAt) VALUES (?, ?, ?)`,
                [collection, docId, deletedAt]
            );
        }
    }

    /**
     * Verifica si un documento posee un tombstone activo de eliminación.
     */
    public async isTombstoned(collection: string, docId: string): Promise<boolean> {
        const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
        if (Capacitor.getPlatform() === 'web') {
            const val = await localforage.getItem<any>(`tombstone:${collection}:${docId}`);
            if (!val) return false;
            if (Date.now() - (val.deletedAt || 0) > thirtyDaysMs) {
                await localforage.removeItem(`tombstone:${collection}:${docId}`);
                return false;
            }
            return true;
        } else {
            await this.init();
            await this.initPromise;
            const res = await this.db!.query(
                `SELECT deletedAt FROM deleted_tombstones WHERE collection = ? AND docId = ?`,
                [collection, docId]
            );
            if (res.values && res.values.length > 0) {
                const deletedAt = res.values[0].deletedAt;
                if (Date.now() - deletedAt > thirtyDaysMs) {
                    await this.db!.run(
                        `DELETE FROM deleted_tombstones WHERE collection = ? AND docId = ?`,
                        [collection, docId]
                    );
                    return false;
                }
                return true;
            }
            return false;
        }
    }

    /**
     * Elimina el tombstone cuando un documento es creado nuevamente con intención explícita.
     */
    public async clearTombstone(collection: string, docId: string): Promise<void> {
        if (Capacitor.getPlatform() === 'web') {
            await localforage.removeItem(`tombstone:${collection}:${docId}`);
        } else {
            await this.init();
            await this.initPromise;
            await this.db!.run(
                `DELETE FROM deleted_tombstones WHERE collection = ? AND docId = ?`,
                [collection, docId]
            );
        }
    }

    /**
     * Cancela e invalida todas las mutaciones pendientes (create/update) de un documento eliminado.
     * Evita que mutaciones offline antiguas resuciten un documento borrado.
     */
    public async cancelMutationsForDoc(collection: string, docId: string): Promise<void> {
        if (Capacitor.getPlatform() === 'web') {
            const keysToUpdate: string[] = [];
            await localforage.iterate((value: any, key: string) => {
                if (key.startsWith('mutation:') && value.collection === collection && value.docId === docId) {
                    if (value.operation === 'create' || value.operation === 'update') {
                        keysToUpdate.push(key);
                    }
                }
            });
            for (const key of keysToUpdate) {
                const item = await localforage.getItem<any>(key);
                if (item) {
                    item.status = 'dead';
                    item.error = 'Cancelado por eliminación confirmada del documento';
                    await localforage.setItem(key, item);
                }
            }
        } else {
            await this.init();
            await this.initPromise;
            await this.db!.run(
                `UPDATE offline_mutations SET status = 'dead', error = 'Cancelado por eliminación confirmada del documento' WHERE collection = ? AND docId = ? AND (operation = 'create' OR operation = 'update')`,
                [collection, docId]
            );
        }
    }

}

export const localDB = new LocalDB();
