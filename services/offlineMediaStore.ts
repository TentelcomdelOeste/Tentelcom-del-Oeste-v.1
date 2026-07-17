// Services for Offline Media Blob Storage in IndexedDB with safety timeouts
import { isSafeModeActive } from './disasterRecoveryManager';

const DB_NAME = 'telecom-offline-media';
const DB_VERSION = 1;
const STORE_NAME = 'media';
const IDB_OP_TIMEOUT_MS = 5000;

// ── Límites programáticos del Media Store ───────────
const MEDIA_STORE_MAX_ENTRIES = 150;
// 150 blobs × ~400KB promedio = ~60MB máximo
// Conservador para dispositivos Android gama baja

const MEDIA_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
// 7 días — trabajo activo raramente dura más
// Blobs más antiguos se consideran seguros de purgar
// ────────────────────────────────────────────────────

// ── Limpieza proactiva antes de guardar blob nuevo ──
async function enforceMediaStoreLimits(
  db: IDBDatabase
): Promise<void> {
  return new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(
        STORE_NAME,
        'readwrite'
      );
      const store = tx.objectStore(STORE_NAME);
      const getAllReq = store.getAll();
      const getKeysReq = store.getAllKeys();

      let keys: IDBValidKey[] = [];
      let values: any[] = [];
      let successCount = 0;

      const checkReady = () => {
        successCount++;
        if (successCount === 2) {
          const now = Date.now();
          const entries = keys.map((key, i) => {
            const blob = values[i];
            const ts = (blob as any)?.lastModified || (blob as any)?.createdAt || now;
            return {
              id: key as string,
              timestamp: ts
            };
          });

          // 1. Eliminar entradas expiradas (> 7 días)
          const expired = entries.filter(e => {
            return now - e.timestamp > MEDIA_MAX_AGE_MS;
          });
          expired.forEach(e => {
            store.delete(e.id);
          });

          // 2. De los no expirados, si exceden el límite
          //    eliminar los más antiguos (LRU)
          const remaining = entries
            .filter(e => {
              return now - e.timestamp <= MEDIA_MAX_AGE_MS;
            })
            .sort((a, b) => a.timestamp - b.timestamp);

          if (remaining.length >= MEDIA_STORE_MAX_ENTRIES) {
            const overflow =
              remaining.length -
              MEDIA_STORE_MAX_ENTRIES + 1;
            remaining
              .slice(0, overflow)
              .forEach(e => {
                store.delete(e.id);
              });
          }
        }
      };

      tx.oncomplete = () => resolve();
      tx.onerror    = () => resolve(); // silencioso

      getKeysReq.onsuccess = () => {
        keys = getKeysReq.result || [];
        checkReady();
      };
      getKeysReq.onerror = () => resolve();

      getAllReq.onsuccess = () => {
        values = getAllReq.result || [];
        checkReady();
      };
      getAllReq.onerror = () => resolve();

    } catch {
      resolve(); // nunca lanzar — siempre resolver
    }
  });
}
// ────────────────────────────────────────────────────

// Memory-backed binary store for Failsafe Safe Mode
const memoryBlobBackup = new Map<string, Blob>();

function openDB(): Promise<IDBDatabase> {
  if (isSafeModeActive()) {
    return Promise.reject(new Error("SAFE_MODE_MEDIA_DB_BLOCKED"));
  }
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    const timeout = setTimeout(() => {
      req.onerror = null;
      req.onsuccess = null;
      reject(new Error("IDB_MEDIA_OPEN_TIMEOUT"));
    }, IDB_OP_TIMEOUT_MS);

    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => {
      clearTimeout(timeout);
      resolve(req.result);
    };
    req.onerror = () => {
      clearTimeout(timeout);
      reject(req.error);
    };
  });
}

export async function storeBlob(key: string, blob: Blob): Promise<void> {
  try {
    (blob as any).createdAt = Date.now();
    if (!('lastModified' in blob)) {
      (blob as any).lastModified = Date.now();
    }
  } catch (_) {
    // Avoid any potential read-only errors on non-extensible objects
  }

  if (isSafeModeActive()) {
    console.warn('[SafeMode] Storing media blob in-memory:', key);
    memoryBlobBackup.set(key, blob);
    return;
  }

  const db = await openDB();

  // ── Pro-active limits enforcing ──
  await enforceMediaStoreLimits(db).catch(() => {});
  // ──────────────────────────────────

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(blob, key);

    const timeout = setTimeout(() => {
      tx.abort();
      reject(new Error("STORE_BLOB_TIMEOUT"));
    }, IDB_OP_TIMEOUT_MS);

    req.onsuccess = () => {
      clearTimeout(timeout);
      resolve();
    };
    req.onerror = () => {
      clearTimeout(timeout);
      reject(req.error);
    };
  });
}

export async function getBlob(key: string): Promise<Blob | null> {
  if (isSafeModeActive()) {
    return memoryBlobBackup.get(key) || null;
  }

  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(key);

    const timeout = setTimeout(() => {
      tx.abort();
      reject(new Error("GET_BLOB_TIMEOUT"));
    }, IDB_OP_TIMEOUT_MS);

    req.onsuccess = () => {
      clearTimeout(timeout);
      resolve(req.result || null);
    };
    req.onerror = () => {
      clearTimeout(timeout);
      reject(req.error);
    };
  });
}

export async function deleteBlob(key: string): Promise<void> {
  if (isSafeModeActive()) {
    memoryBlobBackup.delete(key);
    return;
  }

  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(key);

    const timeout = setTimeout(() => {
      tx.abort();
      reject(new Error("DELETE_BLOB_TIMEOUT"));
    }, IDB_OP_TIMEOUT_MS);

    req.onsuccess = () => {
      clearTimeout(timeout);
      resolve();
    };
    req.onerror = () => {
      clearTimeout(timeout);
      reject(req.error);
    };
  });
}

export async function getAllKeys(): Promise<string[]> {
  if (isSafeModeActive()) {
    return Array.from(memoryBlobBackup.keys());
  }

  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAllKeys();

    const timeout = setTimeout(() => {
      tx.abort();
      reject(new Error("GET_ALL_KEYS_TIMEOUT"));
    }, IDB_OP_TIMEOUT_MS);

    req.onsuccess = () => {
      clearTimeout(timeout);
      resolve((req.result as string[]) || []);
    };
    req.onerror = () => {
      clearTimeout(timeout);
      reject(req.error);
    };
  });
}

