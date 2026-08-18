import { networkProbe } from './networkProbe';
import { offlineQueueEngine, PendingMutation } from './offlineQueueEngine';
import { localDocStore } from './localDocStore';
import { db } from '../../firebase';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { localDB } from './localDB';
import { runPdfSyncCycle } from '../pdf/pdfStorageSync';

const MAX_RETRIES = 5;
const FIREBASE_TIMEOUT_MS = 30000;
const WATCHDOG_TIMEOUT_MS = 45000;

export class SyncEngine {
    private isSyncing: boolean = false;
    private currentUserId: string | null = null;
    private syncStartTime: number = 0;
    private autoSyncInterval: NodeJS.Timeout | null = null;
    private isAuthenticated: boolean = false;

    public setAuthStatus(ready: boolean, user: any | null): void {
        this.currentUserId = user?.uid || null;
        const wasAuthenticated = this.isAuthenticated;
        this.isAuthenticated = ready && !!user;
        
        // Si acabamos de autenticarnos, disparar sync inmediatamente
        if (!wasAuthenticated && this.isAuthenticated) {
            console.log("SyncEngine: Autenticación exitosa detectada. Disparando sync inmediato.");
            this.runSyncCycle();
        }
    }
    
    // Ejecuta el ciclo de sincronización seguro y controlado
    public async runSyncCycle(): Promise<void> {
        if (!this.isAuthenticated) {
            console.warn("SyncEngine: Abortando sync, auth no lista.");
            return;
        }

        // Prevenir concurrencia y loops
        if (this.isSyncing) {
            if (Date.now() - this.syncStartTime > WATCHDOG_TIMEOUT_MS) {
                console.warn("SyncEngine: Watchdog tripped. Sync block released.");
                this.isSyncing = false;
            } else {
                console.log("SyncEngine: Sincronización ya en curso. Abortando.");
                return;
            }
        }

        if (!networkProbe.isOnline()) {
            console.log("SyncEngine: No hay conexión a internet (NetworkProbe). Abortando.");
            return;
        }

        this.isSyncing = true;
        this.syncStartTime = Date.now();
        console.log("SyncEngine: Iniciando ciclo de sincronización...");

        try {
            let isAlive = true;
            try {
                isAlive = await localDB.checkConnectionAlive();
            } catch (connError: any) {
                console.warn('[SyncEngine] checkConnectionAlive no disponible, asumiendo conexión activa:', connError.message);
                isAlive = true;
            }
            const queue = await offlineQueueEngine.getPendingQueue();
            
            if (queue.length > 0) {
                console.log(`SyncEngine: Encontradas ${queue.length} mutaciones pendientes.`);

                for (const mutation of queue) {
                    // Verificar red en cada iteración por si se pierde durante el proceso
                    if (!networkProbe.isOnline()) {
                        console.log("SyncEngine: Se perdió la conexión durante el ciclo. Pausando.");
                        break;
                    }

                    if (mutation.retryCount >= MAX_RETRIES) {
                        console.error(`SyncEngine: Mutación ${mutation.id} excedió límite de reintentos.`);
                        await offlineQueueEngine.markEntryStatus(mutation.id, 'dead', 'Excedido límite de reintentos');
                        continue; 
                    }

                    try {
                        await this.processMutation(mutation);
                    } catch (mutationError) {
                        console.error(`[SyncEngine] Non-blocking failure processing mutation ${mutation.id}. Skipping to next entry.`, mutationError);
                    }
                }

                await offlineQueueEngine.purgeDeadEntries();
            } else {
                console.debug("SyncEngine: No hay mutaciones pendientes de texto.");
            }

            // Disparar sincronización de archivos/PDFs diferidos en segundo plano
            await runPdfSyncCycle().catch((pdfErr) => {
                console.error("SyncEngine: Error en runPdfSyncCycle", pdfErr);
            });

        } catch (error) {
            console.error("SyncEngine: Error grave durante el ciclo de sincronización", error);
        } finally {
            this.isSyncing = false;
            console.log("SyncEngine: Ciclo de sincronización finalizado.");
        }
    }

    private async processMutation(mutation: PendingMutation) {
        console.debug(`[SyncEngine] Processing mutation ${mutation.id} (Op: ${mutation.operation})`);
        try {
            // Marcar como procesando
            await offlineQueueEngine.markEntryStatus(mutation.id, 'processing');

            await this.dispatchToFirestore(mutation);

            const localDoc = await localDocStore.getLocalDoc(mutation.collection, mutation.docId);
            if (localDoc && mutation.operation !== 'delete') {
                await localDocStore.clearDirtyStateSafe(mutation.collection, mutation.docId, localDoc.localRevision);
            } else if (mutation.operation === 'delete') {
                await localDocStore.removeLocalDoc(mutation.collection, mutation.docId);
            }

            // Marcar como completed en vez de eliminar inmediatamente (Deferred purge)
            await offlineQueueEngine.markEntryStatus(mutation.id, 'completed');
            console.debug(`SyncEngine: Mutación ${mutation.id} sincronizada con éxito.`);

        } catch (error: any) {
            console.error(`[SyncEngine] CRITICAL FAILURE: Mutación ${mutation.id} falló.`, error);
            
            // Revertir a fallido y aumentar contador
            const errorMsg = error instanceof Error ? error.message : String(error);
            await offlineQueueEngine.markEntryStatus(mutation.id, 'failed', errorMsg);
            throw error; // Propagate for monitoring
        }
    }

    private sanitizePayload(obj: any): any {
        if (obj === null || typeof obj !== 'object') return obj;
        if (obj instanceof Date || Object.prototype.toString.call(obj) === '[object Date]') return obj;
        if (typeof obj.toDate === 'function' || (obj.isEqual && typeof obj.isEqual === 'function')) return obj;
        
        const newObj: any = Array.isArray(obj) ? [] : {};
        
        Object.keys(obj).forEach(key => {
            const val = obj[key];
            if (val !== undefined) {
                newObj[key] = (val !== null && typeof val === 'object') ? this.sanitizePayload(val) : val;
            }
        });
        
        return newObj;
    }

    private async dispatchToFirestore(mutation: PendingMutation): Promise<void> {
        console.debug(`[SyncEngine] Dispatching to Firestore: ${mutation.id}, Op: ${mutation.operation}, Path: ${mutation.collection}/${mutation.docId}, Payload:`, JSON.stringify(mutation.payload));
        const docRef = doc(db, mutation.collection, mutation.docId);

        // Sanitize payload to remove 'undefined' values and local metadata
        const { isDirty, revision, docId, ...cleanPayload } = (mutation.payload || {}) as any;
        const sanitizedPayload = this.sanitizePayload(cleanPayload);

        // Inject updatedBy if missing in bitacora_vehiculos update to satisfy security rules
        if (mutation.collection === 'bitacora_vehiculos' && mutation.operation === 'update' && this.currentUserId) {
            sanitizedPayload.updatedBy = this.currentUserId;
        }

        let firestorePromise: Promise<void>;

        switch (mutation.operation) {
            case 'create':
                firestorePromise = setDoc(docRef, sanitizedPayload);
                break;
            case 'update':
                firestorePromise = setDoc(docRef, sanitizedPayload, { merge: true });
                break;
            case 'delete':
                firestorePromise = deleteDoc(docRef);
                break;
            default:
                throw new Error(`Operación no soportada: ${mutation.operation}`);
        }

        try {
            return await firestorePromise;
        } catch (e) {
            console.error(`[SyncEngine] Firestore Error in ${mutation.collection}/${mutation.docId}:`, e);
            throw e;
        }
    }

    // Inicializa el sistema de auto-sync (Aún NO ACTIVO globalmente en app productiva)
    public startAutoSync(intervalMs: number = 30000): void {
        if (this.autoSyncInterval) {
            clearInterval(this.autoSyncInterval);
        }

        console.log(`SyncEngine: AutoSync iniciado cada ${intervalMs}ms (Sandboxed)`);

        this.autoSyncInterval = setInterval(() => {
            if (!this.isSyncing) {
                this.runSyncCycle();
            }
        }, intervalMs);

        // Suscribirse a cambios de red para sincronización inmediata al reconectar
        networkProbe.subscribe((isOnline) => {
            if (isOnline && !this.isSyncing) {
                console.log("SyncEngine: Reconexión detectada. Disparando ciclo de sincronización inmediato.");
                this.runSyncCycle();
            }
        });
    }

    public stopAutoSync(): void {
        if (this.autoSyncInterval) {
            clearInterval(this.autoSyncInterval);
            this.autoSyncInterval = null;
        }
        console.log("SyncEngine: AutoSync detenido.");
    }
}

export const syncEngine = new SyncEngine();
