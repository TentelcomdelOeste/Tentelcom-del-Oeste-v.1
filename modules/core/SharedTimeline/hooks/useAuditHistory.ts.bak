import { useState, useEffect } from 'react';
import { localDocStore } from '@/core/offline/localDocStore';
import { networkProbe } from '@/core/offline/networkProbe';

export interface AuditSnapshot {
  id: string;
  messageId?: string;
  mensaje: string;
  usuarioId?: string;
  usuarioNombre?: string;
  createdAt?: string;
  timestamp: string;
  tipoEvento: 'Creación' | 'Edición' | 'Eliminación' | string;
  accion: string;
  accionUsuario: string;
  tipo?: string;
  contenidoOriginal?: string;
  contenidoAnterior?: string;
  contenidoNuevo?: string;
  fileUrls?: string[];
  fileNames?: string[];
  fileSizes?: string[];
}

export function useAuditHistory(auditCollectionPath: string | null) {
  const [auditEntries, setAuditEntries] = useState<AuditSnapshot[]>([]);

  useEffect(() => {
    if (!auditCollectionPath) {
      setAuditEntries([]);
      return;
    }

    let isMounted = true;

    const loadAuditLogs = async () => {
      try {
        // 1. Read local storage (IndexedDB / SQLite)
        const localDocs = await localDocStore.getLocalCollection(auditCollectionPath);
        if (localDocs && localDocs.length > 0) {
          const items = localDocs.map(d => d.data || d);
          items.sort((a, b) => new Date(a.timestamp || a.createdAt).getTime() - new Date(b.timestamp || b.createdAt).getTime());
          if (isMounted) setAuditEntries(items);
        }

        // 2. Fetch remote from Firestore if online
        if (networkProbe.isOnline()) {
          const { collection, getDocs, query, orderBy } = await import('firebase/firestore');
          const { db } = await import('@/firebase');

          const parts = auditCollectionPath.split('/');
          let colRef;
          if (parts.length % 2 === 1) {
            colRef = collection(db, auditCollectionPath);
          } else {
            const parentPath = parts.slice(0, -1).join('/');
            const subName = parts[parts.length - 1];
            const { doc } = await import('firebase/firestore');
            colRef = collection(doc(db, parentPath), subName);
          }

          const q = query(colRef, orderBy('timestamp', 'asc'));
          const snapshot = await getDocs(q);
          const remoteData: AuditSnapshot[] = [];
          snapshot.forEach((docSnap) => {
            remoteData.push({ id: docSnap.id, ...docSnap.data() } as AuditSnapshot);
          });

          if (remoteData.length > 0) {
            await localDocStore.saveLocalDocsBatch(auditCollectionPath, remoteData);
            
            const currentLocal = await localDocStore.getLocalCollection(auditCollectionPath);
            const dirtyItems = currentLocal.filter(d => d.isDirty).map(d => d.data);
            
            const map = new Map<string, AuditSnapshot>();
            remoteData.forEach(item => map.set(item.id, item));
            dirtyItems.forEach(item => map.set(item.id, item));

            const merged = Array.from(map.values()).sort(
              (a, b) => new Date(a.timestamp || a.createdAt).getTime() - new Date(b.timestamp || b.createdAt).getTime()
            );

            if (isMounted) setAuditEntries(merged);
          }
        }
      } catch (err) {
        console.warn("[useAuditHistory] Error loading audit logs:", err);
      }
    };

    loadAuditLogs();

    // 3. Subscribe to localDocStore changes for real-time reactivity
    const unsubscribe = localDocStore.subscribe(auditCollectionPath, async () => {
      try {
        const docs = await localDocStore.getLocalCollection(auditCollectionPath);
        const items = docs.map(d => d.data || d);
        items.sort((a, b) => new Date(a.timestamp || a.createdAt).getTime() - new Date(b.timestamp || b.createdAt).getTime());
        if (isMounted) setAuditEntries(items);
      } catch (e) {
        console.error("Error in audit store subscriber:", e);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [auditCollectionPath]);

  return auditEntries;
}
