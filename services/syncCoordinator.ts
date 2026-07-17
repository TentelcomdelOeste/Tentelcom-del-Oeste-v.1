// Sync Coordinator for sequential queue processing, exponential backoff, and conflict protection
import { db, storage } from '@/firebase';
import { collection, doc, query, where, getDocs, addDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { getBlob, deleteBlob } from './offlineMediaStore';
import { detectMentionsInText, dispatchNotifications } from '@/modules/job_scheduling/jobNotificationDispatcher';
import { getPendingUploads, updateUploadStatus, removeUpload, OfflineUploadTask, resetBackoffDelay } from './offlineQueueService';
import { isLeader } from './tabLockManager';
import { logSyncStart, logSyncSuccess, logSyncAttemptFailure } from './offlineTelemetry';

const TAB_ID = typeof window !== 'undefined' ? Math.random().toString(36).substring(2, 11) : 'server';
const SYNC_CHANNEL_NAME = 'telecom_sync_notifications';
const BACKOFF_SEQUENCE = [2000, 5000, 15000, 30000, 60000];

let syncChannel: BroadcastChannel | null = null;
let isProcessingQueue = false;

// Task backoff state tracking (Task ID -> { attempts, nextScheduledTime })
const taskBackoffMap = new Map<string, { attempts: number; nextScheduledTime: number }>();

// Promise registry for locally requested tasks (Task ID -> { resolve, reject, onProgress })
const pendingLocalPromises = new Map<string, {
  resolve: (val?: any) => void;
  reject: (err?: any) => void;
  onProgress?: (taskId: string, progress: number) => void;
}>();

import { logger } from '@/utils/logger';

if (typeof window !== 'undefined') {
  try {
    syncChannel = new BroadcastChannel(SYNC_CHANNEL_NAME);
    setupSyncChannelListeners();
  } catch (e) {
    logger.warn('[SyncCoordinator] BroadcastChannel disabled:', e);
  }
}

// Subscribe to progress broadcast as passive listener
function setupSyncChannelListeners() {
  if (!syncChannel) return;

  syncChannel.onmessage = (event: MessageEvent) => {
    const msg = event.data;
    if (!msg) return;

    switch (msg.type) {
      case 'REQUEST_SYNC':
        // If we are active leader, run queue processing
        if (isLeader()) {
          logger.info(`[SyncCoordinator] Received REQUEST_SYNC from remote tab ${msg.fromTabId}. Waking up queue loop...`);
          processPendingQueue();
        }
        break;

      case 'SYNC_PROGRESS':
        {
          const local = pendingLocalPromises.get(msg.taskId);
          if (local && local.onProgress) {
            local.onProgress(msg.taskId, msg.progress);
          }
        }
        break;

      case 'SYNC_COMPLETE':
        {
          const local = pendingLocalPromises.get(msg.taskId);
          if (local) {
            if (local.onProgress) {
              local.onProgress(msg.taskId, 100);
            }
            local.resolve(msg.docId);
            pendingLocalPromises.delete(msg.taskId);
          }
        }
        break;

      case 'SYNC_FAILED':
        {
          const local = pendingLocalPromises.get(msg.taskId);
          if (local) {
            local.reject(new Error(msg.error));
            pendingLocalPromises.delete(msg.taskId);
          }
        }
        break;
    }
  };
}

// Request any progress handlers for specific tasks to be resolved via events (primarily for passive tabs)
export function registerLocalProgressCallback(
  taskId: string,
  resolve: (val?: any) => void,
  reject: (err?: any) => void,
  onProgress?: (taskId: string, progress: number) => void
): void {
  pendingLocalPromises.set(taskId, { resolve, reject, onProgress });
}

// Wake up coordinator loop. If passive, requests the leader to start.
export function triggerCoordinatorSync(): void {
  if (!navigator.onLine) {
    logger.info('[SyncCoordinator] Internet is offline. Postponing sync trigger.');
    return;
  }

  if (isLeader()) {
    processPendingQueue();
  } else {
    // We are a passive tab. Notify the active leader to start syncing.
    logger.info('[SyncCoordinator] Passive tab requesting active leader to sync...');
    if (syncChannel) {
      syncChannel.postMessage({ type: 'REQUEST_SYNC', fromTabId: TAB_ID });
    }
  }
}

// Main sequential execution thread
async function processPendingQueue(): Promise<void> {
  if (isProcessingQueue) return;
  if (!isLeader()) {
    logger.debug('[SyncCoordinator] Attempted queue run on non-leader tab. Skipping.');
    return;
  }

  isProcessingQueue = true;
  logger.info('[SyncCoordinator] Queue thread lock acquired. Processing pending uploads...');

  // Watchdog: detect stuck operations (e.g. marked 'syncing' for > 2 minutes) and rescue them safely
  try {
    const allPending = await getPendingUploads();
    const now = Date.now();
    const STUCK_THRESHOLD_MS = 2 * 60 * 1000;
    for (const task of allPending) {
      if (task.status === 'syncing' && (now - task.createdAt > STUCK_THRESHOLD_MS)) {
        console.warn(`[SyncWatcher] Watchdog: Task ${task.id} has been stuck in syncing status. Automatically resetting to failed.`);
        await updateUploadStatus(task.id, 'failed', task.docId, 'TIMEOUT_WATCHDOG_STUCK_SYNC');
        resetBackoffDelay(task.id);
      }
    }
  } catch (watchdogErr) {
    console.warn('[SyncWatcher] Stuck operation watch check errored:', watchdogErr);
  }

  logSyncStart();

  try {
    let tasks: OfflineUploadTask[] = [];
    try {
      tasks = await getScheduledTasks();
    } catch (e: any) {
      console.warn('[SyncCoordinator] Failed to fetch scheduled tasks (IndexedDB lock cleanup scheduled):', e);
      isProcessingQueue = false;
      return;
    }

    if (tasks.length === 0) {
      console.debug('[SyncCoordinator] No scheduled tasks available for immediate upload.');
      isProcessingQueue = false;
      return;
    }

    for (const task of tasks) {
      // Re-verify connection and leadership before processing each task
      if (!navigator.onLine) {
        console.warn('[SyncCoordinator] Connection lost. Pausing sequence.');
        break;
      }
      if (!isLeader()) {
        console.warn('[SyncCoordinator] Leadership revoked mid-queue. Terminating processing thread.');
        break;
      }

      console.info(`[SyncCoordinator] Sequentially processing task: ${task.id} (Trabajal: ${task.trabajoId})`);

      const syncStartTime = Date.now();

      // 1. Conflict Protection pre-sync check
      // Check if task was already marked synced by previous thread
      if (task.status === 'syncing') {
        console.info(`[SyncCoordinator] Task ${task.id} is already in 'syncing' phase. Skipping.`);
        continue;
      }

      await updateUploadStatus(task.id, 'syncing');
      broadcastProgress(task.id, 0);

      try {
        let docId = task.docId;
        let timelineRef;
        if (task.timelineId) {
          timelineRef = collection(db, "operational_timelines", task.timelineId, "events");
        } else {
          const parentColl = task.parentCollection || 'trabajos';
          const pId = task.parentId || task.trabajoId;
          if (!pId) throw new Error('Missing parentId/trabajoId in offline upload task');
          timelineRef = collection(db, parentColl, pId, "timeline");
        }

        // Conflict Protection: Remote existence query via optimisticId to bypass duplicate addDoc
        if (!docId) {
          console.debug(`[SyncCoordinator] Conflict Protection: Querying remote timeline for optimisticId: ${task.id}`);
          const duplicateQuery = query(timelineRef, where("optimisticId", "==", task.id));
          const querySnaps = await getDocs(duplicateQuery);

          if (!querySnaps.empty) {
            const firstDoc = querySnaps.docs[0];
            docId = firstDoc.id;
            const remoteData = firstDoc.data();
            console.info(`[SyncCoordinator] Conflict Protection: Found matching remote document ${docId} for optimisticId: ${task.id}`);

            if (remoteData.uploadStatus === 'complete') {
              console.info(`[SyncCoordinator] Conflict Protection: Remote task ${task.id} is already marked complete. Deleting local state.`);
              // Cleanup local files as they are completely sync'd on firestore
              for (const fileKey of task.fileKeys) {
                await deleteBlob(fileKey);
                try {
                  await deleteBlob(fileKey.replace('_file_', '_thumb_'));
                } catch (e) {
                  console.debug('[SyncCoordinator] Non-critical optional thumb delete skip:', e);
                }
              }
              await removeUpload(task.id);
              broadcastComplete(task.id, docId);
              continue;
            }
            
            // Remote doc exists but upload was incomplete, proceed to upload files
            await updateUploadStatus(task.id, 'syncing', docId);
          }
        }

        // 2. Generate Firestore Document if still completely missing
        if (!docId) {
          const mentions = detectMentionsInText(task.caption.trim(), []);
          const dbPayload: any = {
            tipo: task.type === "image" ? "imagen" : "archivo",
            mensaje: task.caption.trim(),
            mentions: mentions,
            usuarioId: task.currentUser.id,
            usuarioNombre: task.currentUser.name,
            timestamp: serverTimestamp(),
            editado: false,
            eliminado: false,
            fileUrls: [],
            fileNames: [],
            fileSizes: [],
            thumbnailUrls: [],
            optimisticId: task.id,
            uploadStatus: 'pending' // Keeps UI showing uploading indicators
          };

          if (task.replyToId) {
            dbPayload.replyToId = task.replyToId;
            dbPayload.replyPreview = task.replyPreview;
            dbPayload.replyType = task.replyType;
            dbPayload.replyToUserId = task.replyToUserId;
          }

          const docRef = await addDoc(timelineRef, dbPayload);
          docId = docRef.id;
          await updateUploadStatus(task.id, 'syncing', docId);
        }

        // 3. Sequentially upload files
        const uploadedFiles: { url: string; name: string; size: number }[] = [];
        const thumbnailUrls: string[] = [];

        for (let i = 0; i < task.fileKeys.length; i++) {
          const fileKey = task.fileKeys[i];
          const fileName = task.fileNames[i];
          const fileType = task.fileTypes[i];

          const fileBlob = await getBlob(fileKey);
          if (!fileBlob) {
            throw new Error(`Offline blob missing for key: ${fileKey}`);
          }

          const uniqueId = Math.random().toString(36).substring(2, 9);
          const cleanFileName = fileName.replace(/[^a-zA-Z0-9.]/g, "_");
          
          let storagePath;
          if (task.timelineId) {
            storagePath = `operational_timelines/${task.timelineId}/${Date.now()}_${uniqueId}_${cleanFileName}`;
          } else {
            const parentColl = task.parentCollection || 'trabajos';
            const pId = task.parentId || task.trabajoId;
            storagePath = `${parentColl}/${pId}/timeline/${Date.now()}_${uniqueId}_${cleanFileName}`;
          }
          const storageRef = ref(storage, storagePath);

          const uploadTask = uploadBytesResumable(storageRef, fileBlob, {
            contentType: fileType,
            contentDisposition: `attachment; filename="${cleanFileName}"`,
          });

          const downloadUrl = await new Promise<string>((resolve, reject) => {
            uploadTask.on(
              "state_changed",
              (snapshot) => {
                const fileProgress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                const overallProgress = (i * 100 + fileProgress) / task.fileKeys.length;
                const roundedProgress = Math.min(Math.round(overallProgress), 99);
                broadcastProgress(task.id, roundedProgress);
              },
              (error) => reject(error),
              async () => {
                const url = await getDownloadURL(uploadTask.snapshot.ref);
                resolve(url);
              }
            );
          });

          // Upload thumbnail if exists
          let thumbUrl = "";
          const thumbKey = fileKey.replace('_file_', '_thumb_');
          const thumbBlob = await getBlob(thumbKey);
          if (thumbBlob) {
            try {
              const thumbUniqueId = Math.random().toString(36).substring(2, 9);
              let thumbStoragePath;
              if (task.timelineId) {
                thumbStoragePath = `operational_timelines/${task.timelineId}/thumbs/${Date.now()}_${thumbUniqueId}_thumb_${cleanFileName}`;
              } else {
                const parentColl = task.parentCollection || 'trabajos';
                const pId = task.parentId || task.trabajoId;
                thumbStoragePath = `${parentColl}/${pId}/timeline/thumbs/${Date.now()}_${thumbUniqueId}_thumb_${cleanFileName}`;
              }
              const thumbStorageRef = ref(storage, thumbStoragePath);

              const thumbUploadTask = uploadBytesResumable(thumbStorageRef, thumbBlob, {
                contentType: "image/jpeg",
                contentDisposition: `attachment; filename="thumb_${cleanFileName}"`,
              });

              thumbUrl = await new Promise<string>((resolve, reject) => {
                thumbUploadTask.on(
                  "state_changed",
                  null,
                  (error) => reject(error),
                  async () => {
                    const url = await getDownloadURL(thumbUploadTask.snapshot.ref);
                    resolve(url);
                  }
                );
              });
            } catch (thumbErr) {
              console.error("[SyncCoordinator] Thumbnail upload failed:", thumbErr);
            }
          }

          uploadedFiles.push({ url: downloadUrl, name: fileName, size: fileBlob.size });
          thumbnailUrls.push(thumbUrl || downloadUrl);
        }

        // 4. Update the Firestore Document with uploaded asset details
        let docRef;
        if (task.timelineId) {
          docRef = doc(db, "operational_timelines", task.timelineId, "events", docId);
        } else {
          const parentColl = task.parentCollection || 'trabajos';
          const pId = task.parentId || task.trabajoId;
          docRef = doc(db, parentColl, pId, "timeline", docId);
        }
        await updateDoc(docRef, {
          uploadStatus: 'complete',
          fileUrls: uploadedFiles.map((f) => f.url),
          fileNames: uploadedFiles.map((f) => f.name),
          fileSizes: uploadedFiles.map((f) => f.size),
          thumbnailUrls: thumbnailUrls,
        });

        // 5. Build notifications
        try {
          const mentions = detectMentionsInText(task.caption.trim(), []);
          dispatchNotifications({
            trabajoId: task.trabajoId,
            trabajoTitle: "Trabajo",
            comentarioId: docId,
            mensaje: task.caption.trim(),
            mentions: mentions,
            replyToUserId: task.replyToUserId,
            replyToId: task.replyToId,
            currentUser: task.currentUser,
            cuadrilla: []
          });
        } catch (notifErr) {
          console.error("[SyncCoordinator] Global notification dispatch failed:", notifErr);
        }

        // 6. Succesful Sync: Complete tasks & remove keys from localdb
        for (const fileKey of task.fileKeys) {
          await deleteBlob(fileKey).catch(() => undefined);
          await deleteBlob(fileKey.replace('_file_', '_thumb_')).catch(() => undefined);
        }

        await removeUpload(task.id);
        taskBackoffMap.delete(task.id); // Clear consecutive failures on success
        
        console.info(`[SyncCoordinator] Task ${task.id} successfully synchronized (Cloud UUID: ${docId}).`);
        const durationSec = Date.now() - syncStartTime;
        logSyncSuccess(durationSec);
        broadcastComplete(task.id, docId);

      } catch (err: any) {
        console.error(`[SyncCoordinator] Task ${task.id} sync errored out:`, err);
        logSyncAttemptFailure();
        
        // 7. Calculate exponential backoff retry delayed timestamp
        const backoffState = taskBackoffMap.get(task.id) || { attempts: 0, nextScheduledTime: 0 };
        const attemptIndex = Math.min(backoffState.attempts, BACKOFF_SEQUENCE.length - 1);
        const delay = BACKOFF_SEQUENCE[attemptIndex];
        
        const nextTime = Date.now() + delay;
        taskBackoffMap.set(task.id, {
          attempts: backoffState.attempts + 1,
          nextScheduledTime: nextTime
        });

        console.info(`[SyncCoordinator] Backoff assigned for failed task ${task.id}. Delaying for ${delay / 1000}s until attempt #${backoffState.attempts + 1}.`);

        await updateUploadStatus(task.id, 'failed', task.docId, err.message || String(err));
        broadcastFailed(task.id, err.message || String(err));
        
        // Break queue execution list to recover and avoid flooding cloud servers during intermitted sync or quota lock
        break;
      }
    }
  } catch (err) {
    console.error('[SyncCoordinator] Sync execution threw critical exception:', err);
  } finally {
    isProcessingQueue = false;
  }
}

// Filters tasks in queue that are not ready due to exponential backoff schedule
async function getScheduledTasks(): Promise<OfflineUploadTask[]> {
  const allTasks = await getPendingUploads();
  const now = Date.now();
  
  return allTasks.filter(task => {
    const backoff = taskBackoffMap.get(task.id);
    if (!backoff) return true; // Newly added, or not yet failing -> Run instantly! (no manual block!)
    return now >= backoff.nextScheduledTime;
  });
}

// Reset backoff for a specific task if user forces upload, or new task added
export function resetBackoffDelay(taskId: string): void {
  taskBackoffMap.delete(taskId);
}

// Local event & broad-cast triggers
function broadcastProgress(taskId: string, progress: number) {
  // Call local handler first
  const local = pendingLocalPromises.get(taskId);
  if (local && local.onProgress) {
    local.onProgress(taskId, progress);
  }
  // Broadcast to passive tabs
  if (syncChannel) {
    syncChannel.postMessage({ type: 'SYNC_PROGRESS', taskId, progress });
  }
}

function broadcastComplete(taskId: string, docId: string) {
  const local = pendingLocalPromises.get(taskId);
  if (local) {
    if (local.onProgress) {
      local.onProgress(taskId, 100);
    }
    local.resolve(docId);
    pendingLocalPromises.delete(taskId);
  }
  if (syncChannel) {
    syncChannel.postMessage({ type: 'SYNC_COMPLETE', taskId, docId });
  }
}

function broadcastFailed(taskId: string, error: string) {
  const local = pendingLocalPromises.get(taskId);
  if (local) {
    local.reject(new Error(error));
    pendingLocalPromises.delete(taskId);
  }
  if (syncChannel) {
    syncChannel.postMessage({ type: 'SYNC_FAILED', taskId, error });
  }
}
