import { db } from "../../firebase";
import { getAuth } from 'firebase/auth';
import { collection, doc, query, onSnapshot, Timestamp, runTransaction, getDocs, orderBy, where, getDoc, writeBatch, updateDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { Trabajo, EstadoTrabajo } from "./types";
import { setVersionedDocOffline, updateVersionedDocOffline } from "../../core/versionControl";
import { globalSearchEngine, jobSearchPlugin } from '../../core/search';

import { localDocStore } from "../../core/offline/localDocStore";
import { SystemEventPayload } from "./types/systemEvents";
import { eventBus } from "../core/eventBus";
import { createSystemEventPayload } from "./utils/systemEventNormalizer";
import { auditService } from "../../services/auditService";

export const createSystemEvent = async (
  timelineId: string,
  action: SystemEventPayload['systemAction'],
  metadata: SystemEventPayload['metadata'],
  overrideTimestamp?: Date,
  overrideId?: string
) => {
  console.log(`[EVENT_CREATE_START] Action: ${action}, TimelineId: ${timelineId}, Metadata:`, metadata);

  if (!timelineId) {
      console.error("[EVENT_CREATE_ABORTED] Cannot create event without timelineId", { action, metadata });
      return;
  }
  
  const payload = createSystemEventPayload(timelineId, action, metadata, overrideTimestamp);
  if (overrideId) {
      payload.id = overrideId;
      payload.clientGeneratedId = overrideId;
      payload.optimisticId = overrideId;
  }

  console.log(`[EVENT_CREATE_PAYLOAD] EventId: ${payload.id}`, payload);
  
  try {
      // Migración a Arquitectura Unificada Certificada (FASE 10A)
      // Usamos setVersionedDocOffline para persistencia local y sincronización vía SyncEngine
      // La colección sigue el patrón de subcolecciones de Firestore manejado por SyncEngine/localDB
      const collectionPath = `operational_timelines/${timelineId}/events`;
      
      await setVersionedDocOffline(collectionPath, payload.id, {
          ...payload,
          tipo: "system_event",
          timestamp: payload.timestamp // Use the timestamp generated in the payload
      });

      console.log(`[UNIFIED_SYNC_SUCCESS] EventId: ${payload.id} encolado en offline_mutations`);
  } catch (err) {
      console.error(`[UNIFIED_SYNC_ERROR] Failed for EventId: ${payload.id}`, err);
  }

  // Emit optimistic event para compatibilidad con UI actual (eventBus)
  eventBus.emit('SYSTEM_EVENT_CREATED', { timelineId, payload });

  console.info(`[SystemEvent] Registered ${action} via Unified Offline Engine for timeline: ${timelineId}`);
};

export const forkTimeline = async (oldTimelineId: string): Promise<string> => {
  const newTimelineId = `timeline_${Date.now()}`;
  const newTimelineRef = doc(db, "operational_timelines", newTimelineId);
  const oldEventsRef = collection(db, "operational_timelines", oldTimelineId, "events");
  const newEventsRef = collection(db, "operational_timelines", newTimelineId, "events");
  
  // 1. Create new timeline doc
  await setDoc(newTimelineRef, {
      createdAt: serverTimestamp(),
      status: 'active',
      parentTimelineId: oldTimelineId
  });

  // 2. Initial copy of events
  const snapshot = await getDocs(oldEventsRef);
  if (!snapshot.empty) {
      const batch = writeBatch(db);
      snapshot.docs.forEach(docSnap => {
          batch.set(doc(newEventsRef, docSnap.id), docSnap.data());
      });
      await batch.commit();
  }
  
  return newTimelineId;
};

export const recordBitacoraUnlinkedEvent = async (timelineId: string, bitacoraId: string, otCode: string) => {
  try {
    const bitacoraSnap = await getDoc(doc(db, "bitacora_vehiculos", bitacoraId));
    let unidad = "Unidad";
    if (bitacoraSnap.exists()) {
        unidad = bitacoraSnap.data().unidad || "Unidad";
    }
    
    await createSystemEvent(timelineId, "bitacora_desvinculada", {
        otCode,
        unidad,
        bitacoraId, // Added for navigation
        fechaHora: new Intl.DateTimeFormat("es-CR", { 
            day: "numeric", 
            month: "short", 
            year: "numeric",
            hour: "numeric", 
            minute: "2-digit"
        }).format(new Date()).replace(',', ''),
        descripcion: `La bitácora ${unidad} fue desvinculada del trabajo ${otCode}.\n\nLa sesión operacional continúa de forma independiente.`
    });
  } catch (err) {
    console.error("Error creating bitacora_desvinculada event:", err);
  }
};


export const migrateTimeline = async (oldTimelineId: string, newTimelineId: string) => {
  if (oldTimelineId === newTimelineId) return;
  
  const oldEventsRef = collection(db, "operational_timelines", oldTimelineId, "events");
  const newEventsRef = collection(db, "operational_timelines", newTimelineId, "events");
  
  const snapshot = await getDocs(oldEventsRef);
  
  if (snapshot.empty) return;
  
  const batch = writeBatch(db);
  
  snapshot.docs.forEach(docSnap => {
    const newDocRef = doc(newEventsRef, docSnap.id);
    batch.set(newDocRef, docSnap.data(), { merge: true }); // Prevent overwriting existing identical events during migration
  });
  
  await batch.commit();
};

const COLLECTION_NAME = "trabajos";

const mapDataToTrabajo = (id: string, data: any): Trabajo => {
  const toDate = (val: any) => {
    if (val instanceof Timestamp) return val.toDate();
    if (val && typeof val.toDate === 'function') return val.toDate();
    if (!val) return undefined;
    const d = new Date(val);
    return isNaN(d.getTime()) ? undefined : d;
  };

  return {
    id: id,
    ...data,
    fecha_inicio: toDate(data.fecha_inicio) || new Date(),
    fecha_fin: toDate(data.fecha_fin) || new Date(),
    fecha_inicio_real: toDate(data.fecha_inicio_real),
    fecha_fin_real: toDate(data.fecha_fin_real),
    dias_programados: data.dias_programados,
    dias_detalle: data.dias_detalle?.map((d: any) => ({
      ...d,
      fecha: toDate(d.fecha) || new Date(),
      completado_en: toDate(d.completado_en),
      recursos_ajustados: d.recursos_ajustados || false,
      cuadrilla_diaria: d.cuadrilla_diaria || [],
      unidades_diarias: d.unidades_diarias || [],
      estado: d.estado || 'programado'
    })),
    cerrado_manualmente: data.cerrado_manualmente,
    creado_en: toDate(data.creado_en) || new Date(),
    actualizado_en: toDate(data.actualizado_en) || new Date(),
    parentId: data.parentId,
    esSubTrabajo: data.esSubTrabajo,
    tieneContinuacionActiva: data.tieneContinuacionActiva,
    enEspera: data.enEspera,
    fecha_reprogramacion: toDate(data.fecha_reprogramacion),
    deleted: data.deleted || false,
    version: data.version || 1
  } as Trabajo;
};

const mapDocToTrabajo = (doc: any): Trabajo => {
  return mapDataToTrabajo(doc.id, doc.data());
};

const updateHybridTrabajos = async (serverTrabajos: Trabajo[], callback: (trabajos: Trabajo[]) => void) => {
  let localTrabajos: any[] = [];
  try {
    const localDocs = await localDocStore.getLocalCollection(COLLECTION_NAME);
    localTrabajos = localDocs.map(ld => ({
      ...ld.data,
      id: ld.docId,
      isDirty: ld.isDirty
    }));
  } catch (err) {
    console.warn("[jobService] Error cargando trabajos locales:", err);
  }

  const jobsMap = new Map<string, Trabajo>();
  
  // 1. Remotos
  serverTrabajos.forEach(j => jobsMap.set(j.id, j));
  
  // 2. Locales sucios, nuevos o con versión superior
  localTrabajos.forEach(j => {
    const remote = jobsMap.get(j.id);
    
    // Decisión de usar local:
    // 1. No existe en remoto (nuevo)
    // 2. Es dirty (cambios pendientes)
    // 3. La versión local es superior a la remota (sync recién terminado pero snapshot pendiente)
    const useLocal = !remote || j.isDirty || (j.version && remote.version && j.version > remote.version);

    if (useLocal) {
      const mapped = mapDataToTrabajo(j.id, j);
      jobsMap.set(j.id, {
        ...(remote || {}),
        ...mapped
      });
    }
  });

  const merged = Array.from(jobsMap.values())
    .filter(j => !j.deleted);
    
  merged.sort((a, b) => (b.creado_en?.getTime() || 0) - (a.creado_en?.getTime() || 0));

  callback(merged);
};

export const getTrabajos = (callback: (trabajos: Trabajo[]) => void) => {
  const auth = getAuth();
  if (!auth.currentUser) {
    console.warn('[jobService] Listener abortado: sin usuario');
    return () => {};
  }

  // Carga inicial local
  updateHybridTrabajos([], callback);

  const q = query(collection(db, COLLECTION_NAME));
  return onSnapshot(q, (snapshot) => {
    
    try {
      snapshot.docChanges().forEach(change => {
        if (change.type === 'removed') {
          globalSearchEngine.removeDocument(`job_${change.doc.id}`);
        } else {
          const job = mapDocToTrabajo(change.doc);
          globalSearchEngine.upsertDocument(jobSearchPlugin.mapToSearchableItem(job));
        }
      });
    } catch (e) {
       console.warn("[GlobalSearchEngine] Error en jobs:", e);
    }

    const serverTrabajos = snapshot.docs.map(mapDocToTrabajo);
    updateHybridTrabajos(serverTrabajos, callback);
  }, (err) => {
    console.warn("[jobService] Firestore error, fallback local:", err);
    updateHybridTrabajos([], callback);
  });
};

const sanitizeData = (data: any): any => {
  // Manejar tipos que no debemos tocar
  if (
    data === null || 
    data === undefined ||
    typeof data !== 'object' || 
    data instanceof Date ||
    Object.prototype.toString.call(data) === '[object Date]' ||
    (data.constructor && data.constructor.name === 'FieldValue') ||
    (data.constructor && data.constructor.name === 'Timestamp')
  ) {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(sanitizeData);
  }

  const sanitized: any = {};
  Object.keys(data).forEach(key => {
    if (data[key] !== undefined) {
      sanitized[key] = sanitizeData(data[key]);
    }
  });
  return sanitized;
};

export const getTimelineIdForBitacora = async (bitacoraId: string): Promise<string | null> => {
  if (!bitacoraId) return null;
  try {
    const { getEntity } = await import("../../services/localRepositories");
    const { STORES } = await import("../../services/localDb");
    const localLog = await getEntity(STORES.bitacoras, bitacoraId);
    if (localLog && localLog.timelineId) {
      return localLog.timelineId;
    }
  } catch (err) {
    console.warn("Could not load bitacora from offline storage:", err);
  }

  if (navigator.onLine) {
    try {
      const snap = await getDoc(doc(db, "bitacora_vehiculos", bitacoraId));
      if (snap.exists()) {
        return snap.data().timelineId || null;
      }
    } catch (err) {
      console.warn("Could not fetch bitacora from Firestore:", err);
    }
  }
  return null;
};

export const recordBitacoraLinkedEvent = async (resolvedTimelineId: string, bitacoraId: string, otCode: string) => {
  try {
    const bitacoraSnap = await getDoc(doc(db, "bitacora_vehiculos", bitacoraId));
    let unidad = "Unidad";
    if (bitacoraSnap.exists()) {
        unidad = bitacoraSnap.data().unidad || "Unidad";
    }
    
    await createSystemEvent(resolvedTimelineId, "bitacora_vinculada", {
        otCode,
        unidad,
        bitacoraId, // Added for navigation
        fechaHora: new Intl.DateTimeFormat("es-CR", { 
            day: "numeric", 
            month: "short", 
            year: "numeric",
            hour: "numeric", 
            minute: "2-digit"
        }).format(new Date()).replace(',', ''),
        descripcion: `La bitácora ${unidad} fue vinculada al trabajo ${otCode}.\n\nEl timeline operacional fue unificado.`
    });
  } catch (err) {
    console.error("Error creating bitacora_vinculada event:", err);
  }
};

export const generateOTCode = async (parentId?: string) => {
  if (parentId) {
    // 1. LÓGICA PARA SUBTRABAJOS (HIJOS)
    // BUSCAR PADRE RAÍZ (Evitar OT-2026-028-1-1)
    let rootParentId = parentId;
    const currentRef = doc(db, COLLECTION_NAME, parentId);
    const currentSnap = await getDoc(currentRef);
    
    if (currentSnap.exists()) {
      const currentData = currentSnap.data();
      // Si el seleccionado ya es un subtrabajo, usamos su parentId como raíz
      if (currentData.esSubTrabajo && currentData.parentId) {
        rootParentId = currentData.parentId;
      }
    }

    const rootParentRef = doc(db, COLLECTION_NAME, rootParentId);
    const rootParentSnap = await getDoc(rootParentRef);
    
    if (rootParentSnap.exists()) {
      const parentData = rootParentSnap.data();
      const parentOtCode = parentData.otCode || "OT-UNKNOWN";

      // Consultar cuántos subtrabajos existen para este raíz
      const q = query(collection(db, COLLECTION_NAME), where("parentId", "==", rootParentId));
      const snapshot = await getDocs(q);
      
      // El siguiente sufijo es el total actual + 1
      const nextSuffix = snapshot.size + 1;
      
      return { 
        otCode: `${parentOtCode}-${nextSuffix}`,
        rootParentId 
      };
    }
  }

  // 2. LÓGICA TRABAJOS PRINCIPALES (PADRES)
  const year = new Date().getFullYear();
  const counterRef = doc(db, "counters", `OT-${year}`);

  const otCode = await runTransaction(db, async (transaction) => {
    const counterDoc = await transaction.get(counterRef);

    let newNumber = 1;

    if (counterDoc.exists()) {
      newNumber = (counterDoc.data().lastNumber || 0) + 1;
    }

    transaction.set(counterRef, { lastNumber: newNumber }, { merge: true });

    const formattedNumber = String(newNumber).padStart(3, "0");

    return `OT-${year}-${formattedNumber}`;
  });

  return { otCode, rootParentId: null };
};

export const renameExistingOTCodes = async () => {
  const q = query(collection(db, COLLECTION_NAME));
  const snapshot = await getDocs(q);
  
  for (const jobDoc of snapshot.docs) {
    const data = jobDoc.data();
    const otCode = data.otCode;
    
    if (otCode && typeof otCode === 'string') {
        const regex = /^(OT-\d{4}-)0(\d{3})$/;
        const match = otCode.match(regex);
        
        if (match) {
            const newOtCode = `${match[1]}${match[2]}`;
            await updateDoc(doc(db, COLLECTION_NAME, jobDoc.id), { otCode: newOtCode });
        }
    }
  }
};

export const migrateExistingTrabajos = async () => {
  const q = query(collection(db, COLLECTION_NAME), orderBy("creado_en", "asc"));
  const snapshot = await getDocs(q);
  
  const jobsToMigrate = snapshot.docs.filter(doc => !doc.data().otCode);
  
  if (jobsToMigrate.length === 0) return;

  for (const jobDoc of jobsToMigrate) {
    const { otCode } = await generateOTCode();
    await updateDoc(doc(db, COLLECTION_NAME, jobDoc.id), { otCode });
  }
};

export const createTrabajo = async (trabajo: Omit<Trabajo, "id" | "creado_en" | "actualizado_en">) => {
  const id = crypto.randomUUID();
  const data = sanitizeData(trabajo);

  // Marcar pendientes para SyncEngine / Post-sync
  data.pendingTimelineSync = true;
  data.pendingBitacoraSync = true;
  data.pendingContinuationEvaluation = !!trabajo.parentId;

  if (trabajo.estado) {
    data.enEspera = trabajo.estado === 'en_espera';
  }

  // Si tiene padre, actualizarlo a continuado (offline-safe)
  if (trabajo.parentId) {
    await updateVersionedDocOffline(COLLECTION_NAME, trabajo.parentId, {
      enEspera: false,
      estado: 'continuado' as EstadoTrabajo,
      tieneContinuacionActiva: true,
      actualizado_en: new Date().toISOString()
    });
  }

  if (trabajo.bitacorasRelacionadas && trabajo.bitacorasRelacionadas.length > 0) {
    data.bitacoraIds = trabajo.bitacorasRelacionadas.map((b: any) => b.bitacoraId);
  }

  await setVersionedDocOffline(COLLECTION_NAME, id, {
    ...data,
    creado_en: new Date().toISOString(),
    actualizado_en: new Date().toISOString()
  });

  if (data.bitacoraIds && data.bitacoraIds.length > 0) {
    data.bitacoraIds.forEach(async (bitacoraId: string) => {
      try {
        const bitacoraSnap = await getDoc(doc(db, "bitacora_vehiculos", bitacoraId));
        if (bitacoraSnap.exists()) {
           const bitacoraTimelineId = bitacoraSnap.data().timelineId;
           if (bitacoraTimelineId && bitacoraTimelineId !== id) {
               await migrateTimeline(bitacoraTimelineId, id);
           }
        }
        await updateDoc(doc(db, "bitacora_vehiculos", bitacoraId), {
          trabajoId: id,
          timelineId: id
        });
        await recordBitacoraLinkedEvent(id, bitacoraId, data.otCode || '');
      } catch (e) {
        console.error("Error linking bitacora on create", e);
      }
    });
  }

  // Auditoría (no bloqueante para evitar que el botón quede en "Guardando...")
  setTimeout(() => {
    auditService.logEvent({
      action: 'create_record',
      module: 'Programación de Trabajos',
      submodule: 'Trabajo',
      route: '/cronograma',
      recordId: id,
      recordCode: data.titulo
    });
  }, 100);

  return id;
};

export const updateTrabajo = async (id: string, updates: Partial<Trabajo>, _expectedLastUpdateDate?: any) => {
  const data = sanitizeData(updates);
  data.actualizado_en = new Date().toISOString();

  // Obtener estado anterior para ver si hay cambios en las bitácoras vinculadas
  let previousBitacoraIds: string[] = [];
  try {
    const docSnap = await getDoc(doc(db, COLLECTION_NAME, id));
    if (docSnap.exists()) {
      previousBitacoraIds = docSnap.data().bitacoraIds || [];
    }
  } catch (err) {
    console.warn("Could not load previous job state for bitacora analysis:", err);
  }

  // Las bitácoras nuevas en esta actualización
  const currentBitacoraIds: string[] = updates.bitacorasRelacionadas?.map((b: any) => b.bitacoraId) || updates.bitacoraIds || [];
  data.bitacoraIds = currentBitacoraIds;

  // Determinar bitácoras agregadas y eliminadas
  const addedBitacoras = currentBitacoraIds.filter(bid => !previousBitacoraIds.includes(bid));
  const removedBitacoras = previousBitacoraIds.filter(bid => !currentBitacoraIds.includes(bid));

  // Actualizar documento principal usando control de versiones offline
  await updateVersionedDocOffline(COLLECTION_NAME, id, data);

  // Procesar bitácoras añadidas (Vinculación y Consolidación de Timelines)
  for (const bitacoraId of addedBitacoras) {
    try {
      const bitacoraSnap = await getDoc(doc(db, "bitacora_vehiculos", bitacoraId));
      if (bitacoraSnap.exists()) {
         const bitacoraTimelineId = bitacoraSnap.data().timelineId;
         // Si la bitácora tiene un timeline diferente al del trabajo, unificamos
         if (bitacoraTimelineId && bitacoraTimelineId !== id) {
             await migrateTimeline(bitacoraTimelineId, id);
         }
      }
      await updateDoc(doc(db, "bitacora_vehiculos", bitacoraId), {
        trabajoId: id,
        timelineId: id
      });
      await recordBitacoraLinkedEvent(id, bitacoraId, updates.otCode || '');
    } catch (e) {
      console.error("Error linking bitacora on update", e);
    }
  }

  // Procesar bitácoras removidas (Desvinculación de Bitácoras)
  for (const bitacoraId of removedBitacoras) {
    try {
      await updateDoc(doc(db, "bitacora_vehiculos", bitacoraId), {
        trabajoId: null,
        timelineId: bitacoraId // Vuelve a su timeline independiente
      });
      await recordBitacoraUnlinkedEvent(id, bitacoraId, updates.otCode || '');
    } catch (e) {
      console.error("Error unlinking bitacora on update", e);
    }
  }

  // Registrar auditoría
  setTimeout(() => {
    auditService.logEvent({
      action: 'edit_record',
      module: 'Programación de Trabajos',
      submodule: 'Trabajo',
      route: '/cronograma',
      recordId: id,
      recordCode: updates.titulo || ''
    });
  }, 100);
};

export const deleteTrabajo = async (trabajo: Trabajo) => {
  const id = trabajo.id;

  // 1. Validar integridad de reportes de materiales
  try {
    const q = query(collection(db, "material_reports_log"), where("jobId", "==", id));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      return { blocked: true };
    }
  } catch (err) {
    console.error("Error checking material reports on delete:", err);
  }

  // 2. Desvincular todas las bitácoras asociadas antes de borrar el trabajo
  const bitacoraIds = trabajo.bitacoraIds || [];
  for (const bitacoraId of bitacoraIds) {
    try {
      await updateDoc(doc(db, "bitacora_vehiculos", bitacoraId), {
        trabajoId: null,
        timelineId: bitacoraId // Vuelve a su timeline independiente
      });
      await recordBitacoraUnlinkedEvent(id, bitacoraId, trabajo.otCode || '');
    } catch (e) {
      console.error("Error unlinking bitacora on job deletion:", e);
    }
  }

  // 3. Realizar el borrado lógico del trabajo
  await updateVersionedDocOffline(COLLECTION_NAME, id, {
    deleted: true,
    actualizado_en: new Date().toISOString()
  });

  // Registrar auditoría
  setTimeout(() => {
    auditService.logEvent({
      action: 'delete_record',
      module: 'Programación de Trabajos',
      submodule: 'Trabajo',
      route: '/cronograma',
      recordId: id,
      recordCode: trabajo.titulo || ''
    });
  }, 100);

  return { blocked: false };
};

export const obtenerGrupoTrabajo = async (jobId: string): Promise<Trabajo[]> => {
  if (!jobId) return [];
  try {
    const jobSnap = await getDoc(doc(db, COLLECTION_NAME, jobId));
    if (!jobSnap.exists()) return [];

    const jobData = jobSnap.data();
    const rootId = jobData.parentId || jobId;

    // Obtener el trabajo raíz
    const rootSnap = await getDoc(doc(db, COLLECTION_NAME, rootId));
    const rootJob = rootSnap.exists() ? mapDataToTrabajo(rootId, rootSnap.data()) : null;

    // Obtener los subtrabajos
    const q = query(collection(db, COLLECTION_NAME), where("parentId", "==", rootId));
    const querySnap = await getDocs(q);
    const subJobs = querySnap.docs.map(d => mapDataToTrabajo(d.id, d.data()));

    const group = [];
    if (rootJob) group.push(rootJob);
    group.push(...subJobs);

    // Filtrar eliminados
    return group.filter(j => !j.deleted);
  } catch (err) {
    console.error("Error fetching job group:", err);
    return [];
  }
};

