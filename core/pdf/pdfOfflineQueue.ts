import { localDB } from '../offline/localDB';
import { Capacitor } from '@capacitor/core';

export interface PdfQueueEntry {
    id: string;
    localPath: string;
    fileName: string;
    mimeType: string;
    module: string;
    targetCollection: string;
    targetDocId: string;
    status: 'pending' | 'uploading' | 'failed' | 'completed' | 'dead' | 'corrupt';
    attempts: number;
    createdAt: number;
    updatedAt: number;
    firebasePath?: string;
    errorLog?: string;
    checksum: string;
}

// In-memory fallback for non-native platforms (Web / PWA) to keep the app working 
const webFallbackQueue: Map<string, PdfQueueEntry> = new Map();

/**
 * Calcula Heurístico de Checksum de un Blob para evitar envíos duplicados o corrupción
 */
export async function calculateBlobChecksum(blob: Blob): Promise<string> {
    try {
        if (typeof crypto !== 'undefined' && crypto.subtle) {
            const arrayBuffer = await blob.arrayBuffer();
            const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        }
    } catch (e) {
        console.warn("calculateBlobChecksum: falló subtle crypto, usando fallback heurístico", e);
    }
    // Fallback heurístico si no hay subtle crypto (ej. contexto iframe HTTP)
    return `heur-${blob.size}-${blob.type || 'pdf'}-${Date.now()}`;
}

export const pdfOfflineQueue = {
    /**
     * Encola un archivo para sincronización posterior.
     */
    async enqueuePdfUpload(
        localPath: string,
        fileName: string,
        mimeType: string,
        moduleName: string,
        targetCollection: string,
        targetDocId: string,
        checksum: string
    ): Promise<string> {
        const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15);
        const now = Date.now();
        const entry: PdfQueueEntry = {
            id,
            localPath,
            fileName,
            mimeType,
            module: moduleName,
            targetCollection,
            targetDocId,
            status: 'pending',
            attempts: 0,
            createdAt: now,
            updatedAt: now,
            checksum
        };

        if (!Capacitor.isNativePlatform()) {
            console.log("pdfOfflineQueue: Encolado en Web Fallback", entry);
            webFallbackQueue.set(id, entry);
            this.saveWebQueueToLocalStorage();
            return id;
        }

        try {
            await localDB.checkConnectionAlive();
            const db = localDB.getDb();
            if (!db) {
                console.warn("pdfOfflineQueue: DB local no lista, usando fallback en Web");
                webFallbackQueue.set(id, entry);
                return id;
            }

            await db.run(`
                INSERT INTO pdf_upload_queue (
                    id, localPath, fileName, mimeType, module, targetCollection, targetDocId, status, attempts, createdAt, updatedAt, checksum
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                entry.id, 
                entry.localPath, 
                entry.fileName, 
                entry.mimeType, 
                entry.module, 
                entry.targetCollection, 
                entry.targetDocId, 
                entry.status, 
                entry.attempts, 
                entry.createdAt, 
                entry.updatedAt, 
                entry.checksum
            ]);

            console.log(`pdfOfflineQueue: Encolado con éxito en SQLite. ID: ${id}`);
            return id;
        } catch (error) {
            console.error("pdfOfflineQueue: Falló al encolar en SQLite", error);
            webFallbackQueue.set(id, entry);
            return id;
        }
    },

    /**
     * Obtiene los elementos pendientes u fallidos en la cola.
     */
    async getPendingUploads(): Promise<PdfQueueEntry[]> {
        if (!Capacitor.isNativePlatform()) {
            this.loadWebQueueFromLocalStorage();
            return Array.from(webFallbackQueue.values()).filter(e => e.status === 'pending' || e.status === 'failed');
        }

        try {
            await localDB.checkConnectionAlive();
            const db = localDB.getDb();
            if (!db) {
                return Array.from(webFallbackQueue.values()).filter(e => e.status === 'pending' || e.status === 'failed');
            }

            const res = await db.query(`
                SELECT * FROM pdf_upload_queue 
                WHERE status = 'pending' OR status = 'failed' 
                ORDER BY createdAt ASC
            `);

            const list: PdfQueueEntry[] = [];
            if (res.values) {
                for (const row of res.values) {
                    list.push({
                        id: row.id,
                        localPath: row.localPath,
                        fileName: row.fileName,
                        mimeType: row.mimeType,
                        module: row.module,
                        targetCollection: row.targetCollection,
                        targetDocId: row.targetDocId,
                        status: row.status as PdfQueueEntry['status'],
                        attempts: row.attempts,
                        createdAt: row.createdAt,
                        updatedAt: row.updatedAt,
                        firebasePath: row.firebasePath || undefined,
                        errorLog: row.errorLog || undefined,
                        checksum: row.checksum
                    });
                }
            }
            return list;
        } catch (error) {
            console.error("pdfOfflineQueue: Error obteniendo cola de SQLite", error);
            return Array.from(webFallbackQueue.values()).filter(e => e.status === 'pending' || e.status === 'failed');
        }
    },

    /**
     * Registra el cambio de estado de un elemento de la cola.
     */
    async markUploadStatus(id: string, status: PdfQueueEntry['status'], errorLog?: string, firebasePath?: string): Promise<void> {
        const now = Date.now();
        
        // Actualizar fallback primero
        const webEntry = webFallbackQueue.get(id);
        if (webEntry) {
            webEntry.status = status;
            webEntry.updatedAt = now;
            if (status === 'failed') webEntry.attempts += 1;
            if (errorLog) webEntry.errorLog = errorLog;
            if (firebasePath) webEntry.firebasePath = firebasePath;
            this.saveWebQueueToLocalStorage();
        }

        if (!Capacitor.isNativePlatform()) return;

        try {
            await localDB.checkConnectionAlive();
            const db = localDB.getDb();
            if (!db) return;

            if (status === 'failed') {
                await db.run(`
                    UPDATE pdf_upload_queue 
                    SET status = ?, errorLog = ?, attempts = attempts + 1, updatedAt = ?
                    WHERE id = ?
                `, [status, errorLog || null, now, id]);
            } else {
                await db.run(`
                    UPDATE pdf_upload_queue 
                    SET status = ?, errorLog = ?, firebasePath = ?, updatedAt = ?
                    WHERE id = ?
                `, [status, errorLog || null, firebasePath || null, now, id]);
            }
        } catch (error) {
            console.error("pdfOfflineQueue: Error actualizando estado en SQLite", error);
        }
    },

    /**
     * Remueve un elemento de la cola.
     */
    async removeUploadEntry(id: string): Promise<void> {
        webFallbackQueue.delete(id);
        this.saveWebQueueToLocalStorage();

        if (!Capacitor.isNativePlatform()) return;

        try {
            await localDB.checkConnectionAlive();
            const db = localDB.getDb();
            if (!db) return;

            await db.run(`DELETE FROM pdf_upload_queue WHERE id = ?`, [id]);
        } catch (error) {
            console.error("pdfOfflineQueue: Error eliminando elemento en SQLite", error);
        }
    },

    /**
     * Purga elementos completados de forma de diferida respetando la ventana de retención (24 horas).
     */
    async purgeCompletedUploads(): Promise<void> {
        const GRACE_PERIOD_MS = 24 * 60 * 60 * 1000;
        const threshold = Date.now() - GRACE_PERIOD_MS;

        // Limpiar fallback de memoria
        for (const [id, entry] of webFallbackQueue.entries()) {
            if ((entry.status === 'completed' || entry.status === 'dead' || entry.status === 'corrupt') && entry.updatedAt < threshold) {
                webFallbackQueue.delete(id);
            }
        }
        this.saveWebQueueToLocalStorage();

        if (!Capacitor.isNativePlatform()) return;

        try {
            await localDB.checkConnectionAlive();
            const db = localDB.getDb();
            if (!db) return;

            await db.run(`
                DELETE FROM pdf_upload_queue 
                WHERE (status = 'completed' OR status = 'dead' OR status = 'corrupt') 
                AND updatedAt < ?
            `, [threshold]);
            console.log("pdfOfflineQueue: Purgada cola completada en SQLite.");
        } catch (error) {
            console.error("pdfOfflineQueue: Error purgando cola SQLite", error);
        }
    },

    // Auxiliares para sincronizar localStorage en Web
    saveWebQueueToLocalStorage() {
        try {
            localStorage.setItem('telecom_pdf_upload_queue', JSON.stringify(Array.from(webFallbackQueue.entries())));
        } catch (_) {}
    },

    loadWebQueueFromLocalStorage() {
        try {
            const raw = localStorage.getItem('telecom_pdf_upload_queue');
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) {
                    parsed.forEach(([id, entry]) => webFallbackQueue.set(id, entry));
                }
            }
        } catch (_) {}
    }
};
