// Service for managing the Persistent Offline Upload Queue in IndexedDB with safety timeouts and multi-tab coordination
import { triggerCoordinatorSync, registerLocalProgressCallback, resetBackoffDelay } from './syncCoordinator';
import { createRecoverySnapshot } from './recoveryAuditService';
import { isSafeModeActive } from './disasterRecoveryManager';

const DB_NAME = 'telecom-offline-upload-queue';
const DB_VERSION = 1;
const STORE_NAME = 'uploads';
const IDB_OP_TIMEOUT_MS = 5000;

export interface OfflineUploadTask {
  id: string; // optimisticId or random key
  parentCollection?: string;
  parentId?: string;
  trabajoId?: string; // Kept for backwards compatibility
  timelineId?: string | null;
  caption: string;
  fileKeys: string[]; // keys in offlineMediaStore
  fileNames: string[];
  fileTypes: string[];
  type: 'image' | 'file';
  currentUser: {
    id: string;
    name: string;
  };
  replyToId?: string;
  replyPreview?: string;
  replyType?: string;
  replyToUserId?: string;
  createdAt: number;
  status: 'pending' | 'syncing' | 'failed';
  docId?: string | null; // Firestore doc ID if created
  error?: string;
}

// Memory-backed fallback queue for Failsafe Safe Mode
let memoryQueueTaskBackup: OfflineUploadTask[] = [];

function openDB(): Promise<IDBDatabase> {
  if (isSafeModeActive()) {
    return Promise.reject(new Error("SAFE_MODE_INDEXEDDB_BLOCKED"));
  }
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    const timeout = setTimeout(() => {
      req.onerror = null;
      req.onsuccess = null;
      reject(new Error("IDB_OPEN_TIMEOUT"));
    }, IDB_OP_TIMEOUT_MS);

    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
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

export async function enqueueUpload(task: OfflineUploadTask): Promise<void> {
  if (isSafeModeActive()) {
    console.warn('[SafeMode] Enqueuing task in memory:', task.id);
    const idx = memoryQueueTaskBackup.findIndex(t => t.id === task.id);
    if (idx !== -1) {
      memoryQueueTaskBackup[idx] = task;
    } else {
      memoryQueueTaskBackup.push(task);
    }
    await createRecoverySnapshot().catch(() => {});
    return;
  }

  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(task);

    const timeout = setTimeout(() => {
      tx.abort();
      reject(new Error("ENQUEUE_IDB_TIMEOUT"));
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

  await createRecoverySnapshot().catch(() => {});
}

export async function getPendingUploads(): Promise<OfflineUploadTask[]> {
  if (isSafeModeActive()) {
    const tasks = [...memoryQueueTaskBackup];
    tasks.sort((a, b) => a.createdAt - b.createdAt);
    return tasks;
  }

  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();

    const timeout = setTimeout(() => {
      tx.abort();
      reject(new Error("GET_PENDING_IDB_TIMEOUT"));
    }, IDB_OP_TIMEOUT_MS);

    req.onsuccess = () => {
      clearTimeout(timeout);
      const tasks = (req.result as OfflineUploadTask[]) || [];
      // Sort oldest first
      tasks.sort((a, b) => a.createdAt - b.createdAt);
      resolve(tasks);
    };
    req.onerror = () => {
      clearTimeout(timeout);
      reject(req.error);
    };
  });
}

export async function updateUploadStatus(
  id: string,
  status: 'pending' | 'syncing' | 'failed',
  docId?: string | null,
  error?: string
): Promise<void> {
  if (isSafeModeActive()) {
    const task = memoryQueueTaskBackup.find(t => t.id === id);
    if (task) {
      task.status = status;
      if (docId !== undefined) {
        task.docId = docId;
      }
      if (error !== undefined) {
        task.error = error;
      }
    }
    await createRecoverySnapshot().catch(() => {});
    return;
  }

  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const getReq = store.get(id);

    const timeout = setTimeout(() => {
      tx.abort();
      reject(new Error("UPDATE_STATUS_IDB_TIMEOUT"));
    }, IDB_OP_TIMEOUT_MS);

    getReq.onsuccess = () => {
      const task = getReq.result as OfflineUploadTask;
      if (!task) {
        clearTimeout(timeout);
        resolve();
        return;
      }
      task.status = status;
      if (docId !== undefined) {
        task.docId = docId;
      }
      if (error !== undefined) {
        task.error = error;
      }
      const putReq = store.put(task);
      putReq.onsuccess = () => {
        clearTimeout(timeout);
        resolve();
      };
      putReq.onerror = () => {
        clearTimeout(timeout);
        reject(putReq.error);
      };
    };
    getReq.onerror = () => {
      clearTimeout(timeout);
      reject(getReq.error);
    };
  }).then(async () => {
    await createRecoverySnapshot().catch(() => {});
  });
}

export async function removeUpload(id: string): Promise<void> {
  if (isSafeModeActive()) {
    memoryQueueTaskBackup = memoryQueueTaskBackup.filter(t => t.id !== id);
    await createRecoverySnapshot().catch(() => {});
    return;
  }

  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(id);

    const timeout = setTimeout(() => {
      tx.abort();
      reject(new Error("REMOVE_IDB_TIMEOUT"));
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

  await createRecoverySnapshot().catch(() => {});
}

// Public API matching the original Fase 3 contract, now elevated to Enterprise Multi-Tab state.
export async function syncPendingUploads(
  onProgress?: (taskId: string, progress: number) => void
): Promise<void> {
  if (!navigator.onLine) {
    console.info('[Sync] Network is offline. Enqueued task details are persisted locally.');
    return;
  }

  const tasks = await getPendingUploads();
  if (tasks.length === 0) return;

  // Reset exponential backoff for the requested tasks to prioritize immediate manual queue submission
  tasks.forEach(task => {
    resetBackoffDelay(task.id);
  });

  // Track the synchronization run of these tasks via promises
  const taskPromises = tasks.map((task) => {
    return new Promise<void>((resolve, reject) => {
      registerLocalProgressCallback(task.id, resolve, reject, onProgress);
    });
  });

  // Wake up the Sync Coordinator sequentially on the active Leader tab
  triggerCoordinatorSync();

  // Await the queue execution results to satisfy the original Fase 3 contract
  await Promise.all(taskPromises);
}

