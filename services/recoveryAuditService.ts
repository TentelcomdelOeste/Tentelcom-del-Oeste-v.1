// services/recoveryAuditService.ts
// Service for auditing offline queue health, managing metadata safety snapshots, and isolating corrupted files

import { getPendingUploads, removeUpload, enqueueUpload, OfflineUploadTask } from './offlineQueueService';
import { getAllKeys, deleteBlob } from './offlineMediaStore';
import { logCorruption, logOrphanCount } from './offlineTelemetry';
import { maskObject } from '../utils/masking';

export interface AuditReport {
  isHealthy: boolean;
  brokenMediaReferences: Array<{ taskId: string; fileKey: string }>;
  duplicateOperationIds: string[];
  staleUploadIds: string[];
  orphanBlobKeys: string[];
  totalTasksChecked: number;
}

const SNAPSHOT_KEY = 'telecom-offline-queue-snapshot';
const CORRUPT_ISOLATION_KEY = 'telecom-isolated-corrupted-uploads';

/**
 * Creates a lightweight snapshot of the current queue (metadata only, no binary blobs)
 * to allow recovery in case of severe IndexedDB storage corruption or abrupt browser crash.
 */
export async function createRecoverySnapshot(): Promise<void> {
  try {
    const tasks = await getPendingUploads();
    // Exclude actual file content (keys/filenames remain, but binary blobs are in mediaStore anyway)
    const lightweightTasks = tasks.map(({ id, trabajoId, caption, fileKeys, fileNames, fileTypes, type, currentUser, replyToId, replyPreview, replyType, replyToUserId, createdAt, status, docId, error }) => ({
      id, trabajoId, caption, fileKeys, fileNames, fileTypes, type, currentUser, replyToId, replyPreview, replyType, replyToUserId, createdAt, status, docId, error
    }));
    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify({
      timestamp: Date.now(),
      tasks: lightweightTasks
    }));
  } catch (e) {
    console.warn('[RecoveryAudit] Failed to create lightweight queue snapshot:', e);
  }
}

/**
 * Recovers queue tasks from the latest saved snapshot in case of IndexedDB wipe or failure.
 */
export async function restoreQueueFromSnapshot(): Promise<number> {
  try {
    const val = localStorage.getItem(SNAPSHOT_KEY);
    if (!val) return 0;
    const snapshot = JSON.parse(val);
    if (!snapshot || !Array.isArray(snapshot.tasks)) return 0;

    const existingTasks = await getPendingUploads();
    const existingIds = new Set(existingTasks.map(t => t.id));
    let restoredCount = 0;

    for (const task of snapshot.tasks) {
      if (!existingIds.has(task.id)) {
        await enqueueUpload(task);
        restoredCount++;
      }
    }

    if (restoredCount > 0) {
      console.warn(maskObject(`[RecoveryAudit] Successfully restored ${restoredCount} tasks from localStorage snapshot.`));
    }
    return restoredCount;
  } catch (e) {
    console.error(maskObject('[RecoveryAudit] Error restoring queue from snapshot:'), maskObject(e));
    return 0;
  }
}

/**
 * Runs a comprehensive audit on the offline queue and media store.
 */
export async function runQueueAudit(): Promise<AuditReport> {
  const brokenMediaReferences: Array<{ taskId: string; fileKey: string }> = [];
  const duplicateOperationIds: string[] = [];
  const staleUploadIds: string[] = [];
  const orphanBlobKeys: string[] = [];
  
  try {
    const [tasks, mediaKeys] = await Promise.all([
      getPendingUploads(),
      getAllKeys()
    ]);

    const mediaKeySet = new Set(mediaKeys);
    const checkedTaskIds = new Set<string>();
    const taskReferencedKeys = new Set<string>();
    const now = Date.now();
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;

    for (const task of tasks) {
      // 1. Check duplicate task IDs
      if (checkedTaskIds.has(task.id)) {
        duplicateOperationIds.push(task.id);
      }
      checkedTaskIds.add(task.id);

      // 2. Check stale uploads (older than 24 hours)
      if (now - task.createdAt > ONE_DAY_MS) {
        staleUploadIds.push(task.id);
      }

      // 3. Check for broken media references
      for (const fileKey of task.fileKeys) {
        taskReferencedKeys.add(fileKey);
        if (!mediaKeySet.has(fileKey)) {
          brokenMediaReferences.push({ taskId: task.id, fileKey });
        }
        // Check optional thumbnail references if it's an image
        if (task.type === 'image') {
          const thumbKey = fileKey.replace('_file_', '_thumb_');
          taskReferencedKeys.add(thumbKey);
        }
      }
    }

    // 4. Check for orphan blobs in media store
    mediaKeys.forEach(key => {
      // If it is not referenced by any upload task
      if (!taskReferencedKeys.has(key)) {
        // Exclude system keys if any, check prefix
        if (key.includes('_file_') || key.includes('_thumb_')) {
          orphanBlobKeys.push(key);
        }
      }
    });

    const isHealthy = 
      brokenMediaReferences.length === 0 &&
      duplicateOperationIds.length === 0 &&
      orphanBlobKeys.length === 0;

    if (!isHealthy) {
      logCorruption();
    }
    if (orphanBlobKeys.length > 0) {
      logOrphanCount(orphanBlobKeys.length);
    }

    return {
      isHealthy,
      brokenMediaReferences,
      duplicateOperationIds,
      staleUploadIds,
      orphanBlobKeys,
      totalTasksChecked: tasks.length
    };
  } catch (e) {
    console.error(maskObject('[RecoveryAudit] Critical queue audit failed:'), maskObject(e));
    return {
      isHealthy: false,
      brokenMediaReferences,
      duplicateOperationIds,
      staleUploadIds,
      orphanBlobKeys,
      totalTasksChecked: 0
    };
  }
}

/**
 * Isolates corrupted tasks to avoid breaking the normal queue processing while preserving the user's data.
 * Also cleans up orphan blobs to reclaim browser storage.
 */
export async function repairAndIsolateQueue(): Promise<{ isolatedCount: number; clearedOrphans: number }> {
  let isolatedCount = 0;
  let clearedOrphans = 0;

  try {
    const report = await runQueueAudit();

    if (report.isHealthy && report.staleUploadIds.length === 0) {
      return { isolatedCount, clearedOrphans };
    }

    // 1. Isolate corrupted queue items
    const corruptTaskIds = new Set([
      ...report.brokenMediaReferences.map(r => r.taskId),
      ...report.duplicateOperationIds
    ]);

    if (corruptTaskIds.size > 0) {
      const allTasks = await getPendingUploads();
      const corruptedTasks = allTasks.filter(t => corruptTaskIds.has(t.id));

      if (corruptedTasks.length > 0) {
        // Retrieve existing isolated items to append safely without overriding
        let currentIsolated: OfflineUploadTask[] = [];
        try {
          const raw = localStorage.getItem(CORRUPT_ISOLATION_KEY);
          if (raw) currentIsolated = JSON.parse(raw);
        } catch (_) {
          void 0;
        }

        // Add to historical isolated log to prevent sync stalling and prevent silent data loss
        const updatedIsolated = [...currentIsolated, ...corruptedTasks];
        localStorage.setItem(CORRUPT_ISOLATION_KEY, JSON.stringify(updatedIsolated));

        // Remove corrupt entries from main queue to unlock synchronization
        for (const corruptTask of corruptedTasks) {
          await removeUpload(corruptTask.id);
          isolatedCount++;
          console.warn(maskObject(`[RecoveryAudit] Isolated corrupt upload task ${corruptTask.id} and moved to recovery cold storage.`), maskObject(corruptTask));
        }
      }
    }

    // 2. Clean up orphan blobs to prevent storage leaks (Storage Protection)
    if (report.orphanBlobKeys.length > 0) {
      for (const orphanKey of report.orphanBlobKeys) {
        await deleteBlob(orphanKey);
        clearedOrphans++;
        console.info(maskObject(`[RecoveryAudit] Garbage Collector: Reclaimed orphan media file key: ${orphanKey}`));
      }
    }

    // Recreate a clean snapshot of the repaired queue
    await createRecoverySnapshot();

    return { isolatedCount, clearedOrphans };
  } catch (e) {
    console.error(maskObject('[RecoveryAudit] Queue repair routine failed:'), maskObject(e));
    return { isolatedCount, clearedOrphans };
  }
}

/**
 * Returns the isolated corrupted tasks for administrative diagnostic/recovery auditing.
 */
export function getIsolatedCorruptedUploads(): OfflineUploadTask[] {
  try {
    const raw = localStorage.getItem(CORRUPT_ISOLATION_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

/**
 * Clears the historical isolated log.
 */
export function clearIsolatedUploads(): void {
  try {
    localStorage.removeItem(CORRUPT_ISOLATION_KEY);
  } catch (e) {
    void e;
  }
}
