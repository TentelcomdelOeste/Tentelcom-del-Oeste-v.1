import { eventBus } from '../modules/core/eventBus'

export type OfflineActionType =
  | 'CAMBIO_ESTADO_TRABAJO'
  | 'MENSAJE_BITACORA'
  | 'REGISTRO_MATERIAL'
  | 'SYSTEM_EVENT'

export interface OfflineAction {
  id: string                    // crypto.randomUUID()
  type: OfflineActionType
  payload: Record<string, unknown>
  createdAt: number             // Date.now()
  retries: number               // iniciar en 0
}

// ── Constantes IndexedDB ───────────────────────────────

const DB_NAME    = 'telecom-offline-queue'
const DB_VERSION = 1
const STORE_NAME = 'actions'

// ── Helpers IndexedDB ─────────────────────────────────

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
    };
    req.onsuccess = () => resolve(req.result)
    req.onerror   = () => reject(req.error)
  })
}

export async function enqueueAction(
  action: Omit<OfflineAction, 'id' | 'createdAt' | 'retries'>
): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const entry: OfflineAction = {
      ...action,
      id:        (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `offline_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      createdAt: Date.now(),
      retries:   0
    }
    const req = store.add(entry)
    req.onsuccess = () => {
      console.log(`[QUEUE_ADD_SUCCESS] Type: ${entry.type}, QueueId: ${entry.id}, TimelineId: ${entry.payload.timelineId}`);
      console.log(`[OFFLINE_QUEUE_ITEM]`, entry);
      eventBus.emit('OFFLINE_QUEUE_UPDATED', entry);
      resolve();
    }
    req.onerror   = () => {
      console.error(`[QUEUE_ADD_FAILED] Type: ${action.type}`, req.error);
      reject(req.error);
    }
  })
}

export async function getPendingActions(): Promise<OfflineAction[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const req   = store.getAll()
    req.onsuccess = () => resolve(req.result || [])
    req.onerror   = () => reject(req.error)
  })
}

export async function removeAction(id: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const req   = store.delete(id)
    req.onsuccess = () => resolve()
    req.onerror   = () => reject(req.error)
  })
}

export async function incrementRetry(
  id: string
): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const getReq = store.get(id)
    getReq.onsuccess = () => {
      const action = getReq.result as OfflineAction
      if (!action) { resolve(); return }
      action.retries += 1
      const putReq = store.put(action)
      putReq.onsuccess = () => resolve()
      putReq.onerror   = () => reject(putReq.error)
    }
    getReq.onerror = () => reject(getReq.error)
  })
}
