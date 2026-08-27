import { 
  runTransaction, 
  DocumentReference, 
  CollectionReference,
  addDoc as firestoreAddDoc,
  WithFieldValue,
  DocumentData,
} from "firebase/firestore";
import { db } from "../firebase";

/**
 * Agrega un documento con control de versiones inicial (v1)
 */
export const addVersionedDoc = async <T extends WithFieldValue<DocumentData>>(
  collectionRef: CollectionReference<T>, 
  data: T
) => {
  return await firestoreAddDoc(collectionRef, {
    ...data,
    version: 1
  });
};

/**
 * Actualiza un documento verificando la versión para evitar conflictos.
 * 
 * @param docRef Referencia al documento
 * @param data Datos a actualizar
 * @param expectedVersion Versión que el cliente cree que tiene (opcional, si no se pasa, se incrementa ciegamente pero se mantiene la integridad del contador)
 */
export const updateVersionedDoc = async (
  docRef: DocumentReference,
  data: any,
  expectedVersion?: number
) => {
  try {
    // Si estamos online, usamos runTransaction normalmente
    await runTransaction(db, async (transaction) => {
      const sfDoc = await transaction.get(docRef);
      
      if (!sfDoc.exists()) {
        console.error("❌ Document not found in transaction:", docRef.path);
        throw new Error("No se pudo guardar el cambio. El material no fue encontrado.");
      }

      const currentData = sfDoc.data();
      const currentVersion = currentData.version || 1;
      

      const newVersion = currentVersion + 1;

      transaction.update(docRef, {
        ...data,
        version: newVersion
      });
    });
  } catch (e: any) {
    console.error("Error updating document with version:", e);
    throw e;
  }
};

/**
 * Wrapper para setDoc que inicializa versión si es nuevo, o incrementa si existe (merge)
 * Nota: setDoc sin merge sobrescribe todo, así que reiniciamos a v1 o v(n+1) si leemos antes.
 * Para simplificar, usaremos transacción para garantizar atomicidad.
 */
export const setVersionedDoc = async (
  docRef: DocumentReference,
  data: any,
  options?: { merge?: boolean }
) => {
  // Si estamos online, usamos runTransaction normalmente
  await runTransaction(db, async (transaction) => {
    const sfDoc = await transaction.get(docRef);
    
    let newVersion = 1;
    if (sfDoc.exists()) {
      const currentVersion = sfDoc.data().version || 1;
      newVersion = currentVersion + 1;
    }

    transaction.set(docRef, {
      ...data,
      version: newVersion
    }, options || {});
  });
};

import { localDocStore } from "./offline/localDocStore";
import { offlineQueueEngine } from "./offline/offlineQueueEngine";
import { syncEngine } from "./offline/syncEngine";
import { networkProbe } from "./offline/networkProbe";

/**
 * Guarda un documento offline utilizando SQLite y encola la mutación para sync diferido.
 */
export const setVersionedDocOffline = async (
  collectionName: string,
  docId: string,
  data: any
) => {
  try {
    const existing = await localDocStore.getLocalDoc(collectionName, docId);
    let nextVersion = 1;
    if (existing && existing.data) {
      nextVersion = (existing.data.version || 1) + 1;
    }

    const enrichedData = {
      ...data,
      version: nextVersion,
      updatedAt: new Date().toISOString()
    };

    // Persistir localmente en SQLite primero (isDirty = true)
    await localDocStore.saveLocalDoc(collectionName, docId, enrichedData, true);

    // Encolar mutación
    await offlineQueueEngine.enqueueMutation(collectionName, docId, 'create', enrichedData);

    // Intento de escritura REAL e INMEDIATA en Firestore si hay conexión
    if (networkProbe.isOnline()) {
      // Limpiar metadatos locales antes de enviar a Firestore
      const { isDirty, revision, docId: _, ...cleanData } = enrichedData as any;

      import('firebase/firestore').then(({ setDoc, doc }) => {
        import('../firebase').then(({ db }) => {
          setDoc(doc(db, collectionName, docId), cleanData).then(() => {
            console.log(`[VersionControl] Documento ${docId} creado/actualizado en Firestore de forma inmediata.`);
          }).catch((firestoreErr) => {
            console.warn(`[VersionControl] Fallo la escritura inmediata en Firestore para ${docId}, el SyncEngine lo reintentará:`, firestoreErr);
          });
        });
      });
      
      syncEngine.runSyncCycle().catch((err) => {
        console.error("Error al disparar sync automático desde setVersionedDocOffline:", err);
      });
    }

    return enrichedData;
  } catch (error) {
    console.error("Error en setVersionedDocOffline:", error);
    throw error;
  }
};

/**
 * Actualiza un documento offline utilizando SQLite y encola la mutación para sync diferido.
 */
export const updateVersionedDocOffline = async (
  collectionName: string,
  docId: string,
  data: any,
  fallbackBaseData?: any
) => {
  try {
    if (await localDB.isTombstoned(collectionName, docId)) {
      console.warn(`[VersionControl] Intento de actualizar un documento eliminado (${collectionName}/${docId}). Cancelando.`);
      await localDocStore.removeLocalDoc(collectionName, docId);
      return null;
    }

    const existing = await localDocStore.getLocalDoc(collectionName, docId);
    let nextVersion = 1;
    const base = existing && existing.data ? existing.data : (fallbackBaseData || {});
    if (base.version) {
      nextVersion = (base.version || 1) + 1;
    }
    const mergedData = { ...base, ...data };

    const enrichedData = {
      ...mergedData,
      version: nextVersion,
      updatedAt: new Date().toISOString()
    };

    // Persistir localmente en SQLite (isDirty = true)
    await localDocStore.saveLocalDoc(collectionName, docId, enrichedData, true);

    // Encolar mutación
    await offlineQueueEngine.enqueueMutation(collectionName, docId, 'update', enrichedData);

    // Intento de actualización REAL e INMEDIATA en Firestore si hay conexión
    if (networkProbe.isOnline()) {
      // Limpiar metadatos locales antes de enviar a Firestore
      const { isDirty, revision, docId: _, ...cleanData } = enrichedData as any;

      import('firebase/firestore').then(({ updateDoc, doc }) => {
        import('../firebase').then(({ db }) => {
          updateDoc(doc(db, collectionName, docId), cleanData).then(() => {
            console.log(`[VersionControl] Documento ${docId} actualizado en Firestore de forma inmediata con updateDoc.`);
          }).catch((firestoreErr: any) => {
            if (firestoreErr?.code === 'not-found' || firestoreErr?.message?.includes('No document to update') || firestoreErr?.message?.includes('not found')) {
              console.warn(`[VersionControl] Documento ${docId} fue eliminado en Firestore. Purgando localmente:`, firestoreErr);
              localDocStore.removeLocalDoc(collectionName, docId);
            } else {
              console.warn(`[VersionControl] Falló la actualización inmediata en Firestore para ${docId}, el SyncEngine lo reintentará:`, firestoreErr);
            }
          });
        });
      });

      syncEngine.runSyncCycle().catch((err) => {
        console.error("Error al disparar sync automático desde updateVersionedDocOffline:", err);
      });
    }

    return enrichedData;
  } catch (error) {
    console.error("Error en updateVersionedDocOffline:", error);
    throw error;
  }
};
export const addAuditEntryOffline = async (
  collectionOrPath: string,
  parentIdOrData: any,
  historyData?: any
) => {
  try {
    let targetCollection: string;
    let data: any;

    if (historyData !== undefined) {
      targetCollection = `${collectionOrPath}/${parentIdOrData}/audit_history`;
      data = historyData;
    } else {
      targetCollection = collectionOrPath;
      data = parentIdOrData;
    }

    const historyId = data.id || crypto.randomUUID();
    const enrichedData = {
      ...data,
      id: historyId,
      createdAt: data.createdAt || new Date().toISOString(),
      timestamp: data.timestamp || data.eventTimestamp || new Date().toISOString(),
      version: 1
    };

    // 1. Guardar de forma inmediata en localDocStore (IndexedDB / SQLite) para disponibilidad offline
    await localDocStore.saveLocalDoc(targetCollection, historyId, enrichedData, true);

    // 2. Encolar mutación para el motor de sincronización offline
    await offlineQueueEngine.enqueueMutation(targetCollection, historyId, 'create', enrichedData);

    // 3. Intento de escritura REAL e INMEDIATA en Firestore si hay conexión
    if (networkProbe.isOnline()) {
      const { setDoc, doc } = await import('firebase/firestore');
      const { db } = await import('../firebase');
      
      const parts = targetCollection.split('/');
      if (parts.length % 2 === 1) {
        await setDoc(doc(db, targetCollection, historyId), enrichedData);
      } else {
        const parentPath = parts.slice(0, -1).join('/');
        const subName = parts[parts.length - 1];
        await setDoc(doc(db, parentPath, subName, historyId), enrichedData);
      }
      console.log(`[VersionControl] Audit entry ${historyId} added in Firestore at ${targetCollection}`);
    }

    return enrichedData;
  } catch (error) {
    console.error("Error en addAuditEntryOffline:", error);
    throw error;
  }
};

/**
 * Elimina un documento offline utilizando SQLite y encola la mutación para sync diferido (Hard Delete).
 */
export const deleteVersionedDocOffline = async (
  collectionName: string,
  docId: string
) => {
  try {
    // 1. Eliminar localmente de forma inmediata (Optimista)
    await localDocStore.removeLocalDoc(collectionName, docId);

    // 2. Encolar mutación de eliminación para persistencia offline
    await offlineQueueEngine.enqueueMutation(collectionName, docId, 'delete', null);

    // 3. Intento de eliminación REAL e INMEDIATA en Firestore si hay conexión
    if (networkProbe.isOnline()) {
      try {
        const { deleteDoc, doc } = await import('firebase/firestore');
        const { db } = await import('../firebase');
        await deleteDoc(doc(db, collectionName, docId));
        console.log(`[VersionControl] Documento ${docId} eliminado físicamente en Firestore de forma inmediata.`);
      } catch (firestoreErr) {
        console.warn(`[VersionControl] Fallo el borrado inmediato en Firestore para ${docId}, el SyncEngine lo reintentará:`, firestoreErr);
      }
      
      // Siempre disparamos el sync cycle por si acaso
      syncEngine.runSyncCycle().catch((err) => {
        console.error("Error al disparar sync automático desde deleteVersionedDocOffline:", err);
      });
    }
  } catch (error) {
    console.error("Error en deleteVersionedDocOffline:", error);
    throw error;
  }
};

