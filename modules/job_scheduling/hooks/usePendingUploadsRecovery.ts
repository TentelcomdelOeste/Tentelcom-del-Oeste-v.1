import { useEffect } from 'react';
import { collectionGroup, query, where, limit, getDocs, updateDoc } from 'firebase/firestore';
import { db } from '@/firebase';
import { syncPendingUploads, getPendingUploads } from '@/services/offlineQueueService';
import { initializeDisasterRecovery } from '@/services/disasterRecoveryManager';
import { useUserContext } from '@/contexts/UserContext';
import { hasPermission } from '@/utils/permissions';

let isSyncInitialized = false;

export function usePendingUploadsRecovery(currentUser: { id?: string; uid?: string; role?: any; permissions?: any } | null): void {
  const { authReady } = useUserContext();

  useEffect(() => {
    if (!authReady || !currentUser || isSyncInitialized) return;

    const uid = currentUser.id || currentUser.uid;
    if (!uid) return;

    isSyncInitialized = true;

    // Trigger auto-sync on app boot and setup online connection listener (Reconnection Engine)
    const handleOnlineSync = () => {
      if (!currentUser) return;
      console.debug("[Reconnection Engine] Connection online detected. Launching queue sync...");
      syncPendingUploads().catch(err => {
        console.error("[Reconnection Engine] Sync execution threw:", err);
      });
    };

    const handleServiceWorkerMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'TRIGGER_SYNC_QUEUE') {
        if (!currentUser) return;
        console.debug('[SW Integration] Sync requested by Background Service Worker.');
        syncPendingUploads().catch(err => {
          console.error('[SW Integration] SW-triggered sync execution failed:', err);
        });
      }
    };

    const onlineSyncWrapper = () => {
      if (authReady && currentUser) {
        handleOnlineSync();
      }
    };

    const swMessageWrapper = (event: MessageEvent) => {
      if (authReady && currentUser) {
        handleServiceWorkerMessage(event);
      }
    };

    window.addEventListener('online', onlineSyncWrapper);

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', swMessageWrapper);
    }
    
    // Register background sync if supported
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
      navigator.serviceWorker.ready.then((reg) => {
        try {
          (reg as any).sync.register('telecom-sync-queue').catch((e: any) => {
            console.debug('[SW Integration] Background sync tag registration skipped/failed:', e);
          });
        } catch (e) {
          console.debug('[SW Integration] SW registration check failed:', e);
        }
      });
    }
    
    // Immediate validation & self-repair boot loop scan
    initializeDisasterRecovery().then(() => {
      if (navigator.onLine) {
        handleOnlineSync();
      }
    }).catch(err => {
      console.error('[DisasterRecovery] Boot execution errored safely:', err);
    });

    const runRecoveryAndCleanup = async () => {
      // Evitar consulta collectionGroup 'timeline' si el usuario no tiene permisos de trabajos
      if (!hasPermission(currentUser as any, 'trabajos')) {
        console.debug('[Recovery] Skipping background timeline cleanup (no trabajos permission)');
        return;
      }

      try {
        const timelineQuery = query(
          collectionGroup(db, 'timeline'),
          where('uploadStatus', '==', 'pending'),
          where('usuarioId', '==', uid),
          limit(30)
        );

        const snapshot = await getDocs(timelineQuery);
        const now = Date.now();
        const pendingTasks = await getPendingUploads();
        const activeDocIds = new Set(pendingTasks.map(t => t.docId).filter(Boolean));

        for (const doc of snapshot.docs) {
          const data = doc.data();
          const createdAt = data.timestamp ? data.timestamp.toMillis() : 0;
          
          if (createdAt > 0 && now - createdAt > 30 * 60 * 1000) {
            // Hardening orphan protection: do not mark as orphaned if it has active blobs awaiting sync in IndexedDB!
            if (activeDocIds.has(doc.id)) {
              console.debug(`[Recovery] Preserving Doc ${doc.id} as it is actively listed in local sync queue.`);
              continue;
            }
            await updateDoc(doc.ref, { uploadStatus: 'orphaned' });
            console.warn('[Recovery] Tagged older hanging item as orphaned:', doc.ref.id);
          }
        }
      } catch (error) {
        console.error('[Recovery] Error in background uploader cleanup:', error);
      }
    };

    // Run recovery check slightly delayed after startup to prioritize main thread loading
    let handle: number;
    if ('requestIdleCallback' in window) {
      handle = (window as any).requestIdleCallback(runRecoveryAndCleanup, { timeout: 5000 });
    } else {
      handle = window.setTimeout(runRecoveryAndCleanup, 5000);
    }
    return () => {
      if ('cancelIdleCallback' in window && handle) {
        (window as any).cancelIdleCallback(handle);
      } else if (handle) {
        clearTimeout(handle);
      }
    };
  }, [currentUser, authReady]);
}
