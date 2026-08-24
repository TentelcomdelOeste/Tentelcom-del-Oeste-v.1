import { db } from "../../firebase";
import { doc, getDoc, setDoc, collection, query, where, orderBy, limit, getDocs } from "firebase/firestore";
import { VehicleLog, VehicleExpense } from "../../types/vehicle.types";
import { User } from "../../utils/types";
import { createSystemEvent } from "../job_scheduling/jobService";
import { setVersionedDocOffline, updateVersionedDocOffline } from "../../core/versionControl";
import { localDocStore } from "../../core/offline/localDocStore";
import { offlineQueueEngine } from "../../core/offline/offlineQueueEngine";
import { auditService } from "../../services/auditService";
import { networkProbe } from "../../core/offline/networkProbe";

/**
 * Formatea una fecha para visualización en eventos de sistema.
 */
export const formatSystemEventDateTime = (d: Date) => {
    const months = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
    const day = String(d.getDate()).padStart(2, '0');
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const strTime = String(hours).padStart(2, '0') + ':' + minutes + ':' + seconds + ' ' + ampm;
    return `${day} ${month} ${year} • ${strTime}`;
};

/**
 * Formatea un string de hora (HH:mm:ss) a formato 12h con AM/PM.
 */
export const formatSystemTimeOnly = (timeStr: string) => {
    if (!timeStr) return "";
    const parts = timeStr.split(':');
    if (parts.length >= 2) {
        let hours = parseInt(parts[0], 10);
        const minutes = parts[1];
        const seconds = parts[2] || "00";
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours ? hours : 12;
        return `${String(hours).padStart(2, '0')}:${minutes}:${seconds} ${ampm}`;
    }
    return timeStr;
};

/**
 * Registra el evento de finalización de bitácora en el timeline operacional.
 */
export const recordBitacoraFinalizedEvent = async (timelineId: string, dataToSave: any) => {
    try {
        const totalKm = dataToSave.kmLlegada ? Math.max(0, dataToSave.kmLlegada - (dataToSave.kmSalida || 0)) : 0;
        const finalEventDate = new Date();

        const kmSalida = dataToSave.kmSalida || 0;
        const kmLlegada = dataToSave.kmLlegada || 0;
        const combustibleInicial = dataToSave.combustible || 'Full';
        const combustibleFinal = dataToSave.combustibleFinal || 'Full';
        const observaciones = dataToSave.observaciones || 'Sin observaciones específicas.';

        const eventData: any = {
            conductor: dataToSave.conductorName || dataToSave.conductorId || "Usuario",
            unidad: dataToSave.unidad || dataToSave.unidadName || "Unidad",
            kmSalida,
            kmLlegada,
            kilometraje_recorrido: totalKm,
            combustibleInicial,
            combustibleFinal,
            observaciones,
            bitacoraId: dataToSave.id, // Added for navigation
            horaCierre: formatSystemTimeOnly(`${String(finalEventDate.getHours()).padStart(2, '0')}:${String(finalEventDate.getMinutes()).padStart(2, '0')}:${String(finalEventDate.getSeconds()).padStart(2, '0')}`),
            fechaHora: formatSystemEventDateTime(finalEventDate),
            descripcion: `La bitácora de la unidad ${dataToSave.unidad || dataToSave.unidadName || "Unidad"} ha finalizado de manera exitosa.\nResumen Operativo: Recorrido total de ${totalKm} km (de ${kmSalida} km a ${kmLlegada} km). Combustible: ${combustibleInicial} (salida) / ${combustibleFinal} (llegada).\nObservaciones: ${observaciones}`
        };

        if (dataToSave.kmRecarga) eventData.kmRecarga = dataToSave.kmRecarga;
        if (dataToSave.monto) eventData.monto = dataToSave.monto;
        if (dataToSave.litros) eventData.litros = dataToSave.litros;
        if (dataToSave.gasolinera) eventData.gasolinera = dataToSave.gasolinera;

        const deterministicId = `finalizada_${timelineId}_${(dataToSave.unidad || 'Unidad').replace(/\s+/g, '_')}`;
        console.log(`[VEHICLE_SERVICE] [CREATE_SYSTEM_EVENT_START] Action: bitacora_finalizada, TimelineId: ${timelineId}, LocalTime: ${new Date().toISOString()}`);
        await createSystemEvent(timelineId, "bitacora_finalizada", eventData, finalEventDate, deterministicId);
        console.log(`[VEHICLE_SERVICE] [CREATE_SYSTEM_EVENT_SUCCESS] Action: bitacora_finalizada, TimelineId: ${timelineId}`);
    } catch (err) {
        console.error(`[VEHICLE_SERVICE] [CREATE_SYSTEM_EVENT_ERROR] Action: bitacora_finalizada, TimelineId: ${timelineId}`, err);
    }
};

export const compressImage = async (file: File, maxWidth = 1280, quality = 0.85): Promise<Blob> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (e) => {
            const img = new Image();
            img.src = e.target?.result as string;
            img.onload = () => {
                let w = img.width;
                let h = img.height;
                if (w > maxWidth) {
                    h = Math.round((h * maxWidth) / w);
                    w = maxWidth;
                }
                const canvas = document.createElement('canvas');
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    reject(new Error("Canvas context failed"));
                    return;
                }
                ctx.drawImage(img, 0, 0, w, h);
                canvas.toBlob((blob) => {
                    if (blob) resolve(blob);
                    else reject(new Error("Canvas to blob failed"));
                }, 'image/jpeg', quality);
            };
            img.onerror = reject;
        };
        reader.onerror = reject;
    });
};

/**
 * Servicio centralizado para guardar registros de bitácora y disparar eventos operativos.
 * Esta función desacopla la persistencia de la UI y asegura que los eventos se registren siempre.
 */
export const saveVehicleLog = async (
    formData: Partial<VehicleLog>,
    currentUser: User,
    isEditing: boolean,
    initialData?: VehicleLog | null,
    trabajoId?: string,
    photoFiles?: File[]
) => {
    console.log("[vehicleService] Starting saveVehicleLog pipeline (Unified Offline Architecture)...", { isEditing, trabajoId, photoCount: photoFiles?.length || 0 });

    // 1. Sanitización y Preparación de Datos
    const totalKm = formData.kmLlegada ? Math.max(0, formData.kmLlegada - (formData.kmSalida || 0)) : 0;
    const { _resolvedName, _resolvedUnidad, _resolvedPlaca, ...cleanData } = formData as any;

    const sanitizedData: Record<string, any> = {};
    Object.keys(cleanData).forEach(key => {
        const val = cleanData[key];
        if (val !== undefined && !key.startsWith('_')) {
            sanitizedData[key] = val;
        }
    });

    // NORMALIZATION: Ensure 'unidad' is always present if 'unidadId' exists
    if (sanitizedData.unidadId && !sanitizedData.unidad) {
        const parts = sanitizedData.unidadId.split(" - ");
        sanitizedData.unidad = parts[0]?.trim() || "";
    } else if (sanitizedData.unidadId && sanitizedData.unidad) {
        // Keep them in sync
        const parts = sanitizedData.unidadId.split(" - ");
        const derivedUnidad = parts[0]?.trim() || "";
        if (derivedUnidad && sanitizedData.unidad !== derivedUnidad) {
            sanitizedData.unidad = derivedUnidad;
        }
    }

    if (photoFiles && photoFiles.length > 0) {
        const timestamp = Date.now();
        const unidadName = sanitizedData.unidad || 'unidad';
        sanitizedData.photoTimestamp = timestamp;
        const paths: string[] = [];

        for (let i = 0; i < photoFiles.length; i++) {
            const photoFile = photoFiles[i];
            const storagePath = `vehicle_photos/${unidadName}/${timestamp}_${i}.jpg`;
            paths.push(storagePath);
            if (i === 0) {
                sanitizedData.photoStoragePath = storagePath;
            }

            try {
                const compressedBlob = await compressImage(photoFile);
                if (networkProbe.isOnline()) {
                    const { storage } = await import("../../firebase");
                    const { ref, uploadBytes } = await import("firebase/storage");
                    const storageRef = ref(storage, storagePath);
                    await uploadBytes(storageRef, compressedBlob, { contentType: 'image/jpeg' });
                    console.log("[vehicleService] Vehicle photo uploaded successfully to Storage:", storagePath);
                } else {
                    console.log("[vehicleService] Offline detected, storing vehicle photo locally in offlineMediaStore & queue:", storagePath);
                    const { storeBlob } = await import("../../services/offlineMediaStore");
                    const { pdfOfflineQueue, calculateBlobChecksum } = await import("../../core/pdf/pdfOfflineQueue");
                    await storeBlob(storagePath, compressedBlob);
                    const checksum = await calculateBlobChecksum(compressedBlob);
                    await pdfOfflineQueue.enqueuePdfUpload(
                        storagePath,
                        `${unidadName}_${timestamp}_${i}.jpg`,
                        'image/jpeg',
                        'vehicles',
                        'bitacora_vehiculos',
                        initialData?.id || 'temp_id',
                        checksum
                    );
                }
            } catch (photoErr) {
                console.error(`[vehicleService] Error processing/uploading vehicle photo ${i}:`, photoErr);
            }
        }
        sanitizedData.photoStoragePaths = paths;
    } else if (initialData) {
        if (initialData.photoStoragePath) {
            sanitizedData.photoStoragePath = initialData.photoStoragePath;
        }
        if (initialData.photoStoragePaths) {
            sanitizedData.photoStoragePaths = initialData.photoStoragePaths;
        }
        if (initialData.photoTimestamp) {
            sanitizedData.photoTimestamp = initialData.photoTimestamp;
            if (!sanitizedData.photoStoragePath) {
                const unidadName = sanitizedData.unidad || initialData.unidad || 'unidad';
                sanitizedData.photoStoragePath = `vehicle_photos/${unidadName}/${initialData.photoTimestamp}_0.jpg`;
            }
        }
        if (initialData.oneDriveUrl) {
            sanitizedData.oneDriveUrl = initialData.oneDriveUrl;
        }
        if (initialData.oneDriveSyncedAt) {
            sanitizedData.oneDriveSyncedAt = initialData.oneDriveSyncedAt;
        }
        if (initialData.oneDriveSyncError) {
            sanitizedData.oneDriveSyncError = initialData.oneDriveSyncError;
        }
    }

    const now = new Date();
    const currentHour = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const currentDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    
    // Detectar si se está finalizando (antes no tenía kmLlegada, ahora sí)
    const isFinalizando = (sanitizedData.kmLlegada != null) && (!initialData || initialData.kmLlegada == null);

    if (isFinalizando) {
        if (!sanitizedData.horaLlegada || sanitizedData.horaLlegada === '16:00') {
            sanitizedData.horaLlegada = currentHour;
        }
        if (!sanitizedData.fechaRegreso) {
            sanitizedData.fechaRegreso = currentDate;
        }
    }

    // 2. Resolución de Vehículo
    const vehiculoId = sanitizedData.vehiculoId || '';
    let vUnidad = sanitizedData.unidad || '';
    let vPlaca = sanitizedData.placa || '';

    // Intentar resolución silenciosa si tenemos unidadId (formato: "U1 - abc-123")
    if (sanitizedData.unidadId && !vehiculoId) {
        const parts = sanitizedData.unidadId.split(" - ");
        vUnidad = parts[0]?.trim() || "";
        vPlaca = parts[2]?.trim() || parts[1]?.trim() || "";
    }

    const dataToSave = {
        ...sanitizedData,
        totalKm,
        updatedAt: now.toISOString(),
        updatedBy: currentUser.id,
        ...(vehiculoId && { vehiculoId }),
        unidad: vUnidad,
        placa: vPlaca
    };

    // --- BLOQUEO DE BITÁCORAS DUPLICADAS ---
    if (!isEditing) {
        let remoteLogs: VehicleLog[] = [];
        try {
            const { getDocsFromServer } = await import('firebase/firestore');
            const qLogs = query(
                collection(db, 'bitacora_vehiculos'),
                where('unidad', '==', vUnidad),
                orderBy('fecha', 'desc'),
                limit(5)
            );
            
            // Forzar consulta al servidor con un timeout estricto para evitar bloqueos
            const timeoutPromise = new Promise<any>((_, reject) => setTimeout(() => reject(new Error("TIMEOUT_GETDOCS")), 2500));
            const snapLogs = await Promise.race([
                getDocsFromServer(qLogs),
                timeoutPromise
            ]);
            
            if (snapLogs && !snapLogs.empty) {
                remoteLogs = snapLogs.docs.map(doc => ({ ...doc.data() as VehicleLog, id: doc.id }));
            }
        } catch (serverError) {
            console.warn("[vehicleService] getDocsFromServer failed or timed out, falling back to local cache:", serverError);
            try {
                const { getDocsFromCache } = await import('firebase/firestore');
                const qLogs = query(collection(db, 'bitacora_vehiculos'), where('unidad', '==', vUnidad), orderBy('fecha', 'desc'), limit(5));
                const snapLogs = await getDocsFromCache(qLogs);
                if (!snapLogs.empty) {
                    remoteLogs = snapLogs.docs.map(doc => ({ ...doc.data() as VehicleLog, id: doc.id }));
                }
            } catch (cacheError) {
                console.warn("[vehicleService] getDocsFromCache failed, relying purely on offline localDocStore:", cacheError);
            }
        }

        // 2. Fetch Local Logs (for unsynced records)
        let localDocs: any[] = [];
        let pendingMutations: any[] = [];
        try {
            localDocs = await localDocStore.getLocalCollection('bitacora_vehiculos');
            pendingMutations = await offlineQueueEngine.getPendingQueue();
        } catch (e) {
            console.warn("[vehicleService] localDocStore/offlineQueue access failed in duplication check:", e);
        }

        const deleteMutations = new Set(
            pendingMutations
                .filter(m => m.collection === 'bitacora_vehiculos' && m.operation === 'delete')
                .map(m => m.docId)
        );

        const localLogs = localDocs
            .filter(d => d.data?.unidad === vUnidad)
            .map(d => ({ ...d.data, id: d.docId }) as VehicleLog);

        // 3. Merge and Check
        const logMap = new Map<string, VehicleLog>();
        
        // Populate with Remote Logs, but skip those pending deletion or legacy isDeleted
        remoteLogs.forEach(l => {
            if (!deleteMutations.has(l.id) && !l.isDeleted) {
                logMap.set(l.id, l);
            }
        });

        localLogs.forEach(l => {
            if (!deleteMutations.has(l.id) && !l.isDeleted) {
                logMap.set(l.id, l);
            }
        });

        const logs = Array.from(logMap.values());
        if (logs.length > 0) {
            logs.sort((a, b) => {
                const dateA = a.fecha || "";
                const dateB = b.fecha || "";
                if (dateA !== dateB) return dateB.localeCompare(dateA);
                const timeA = a.horaSalida || "";
                const timeB = b.horaSalida || "";
                return timeB.localeCompare(timeA);
            });

            // Consideramos bitácora activa cualquiera que no tenga kmLlegada (o kmFinal), 
            // no esté borrada y el estado NO sea 'Finalizada'
            const activeLog = logs.find(l => 
                !l.kmLlegada && 
                !l.isDeleted && 
                l.estado !== 'Finalizada' &&
                l.id !== initialData?.id
            );
            
            if (activeLog) {
                const conductor = activeLog.conductorName || 'otro conductor';
                const fecha = activeLog.fecha || 'sin fecha';
                throw new Error(`BLOQUEO: La unidad ${vUnidad} ya tiene una bitácora activa sin finalizar (Conductor: ${conductor}, Fecha: ${fecha}).`);
            }
        }
    }

    let bitacoraId = initialData?.id || '';
    let finalTimelineId = initialData?.timelineId || '';

    // 3. Persistencia y Disparo de Eventos
    try {
        let resultLogDoc = null;

        if (isEditing && initialData) {
            // --- FLUJO DE ACTUALIZACIÓN ---
            if (!finalTimelineId) {
                // Utilizar un generador seguro compatible con entornos restringidos
                const safeUuid = () => {
                   if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
                   return `tl_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
                };
                finalTimelineId = safeUuid();
                dataToSave.timelineId = finalTimelineId;
            } else {
                dataToSave.timelineId = finalTimelineId;
            }

            // Migración: updateVersionedDocOffline (SQLite + Mutation Queue)
            await updateVersionedDocOffline('bitacora_vehiculos', initialData.id, dataToSave);
            resultLogDoc = { ...initialData, ...dataToSave, id: initialData.id };
        } else {
            // --- FLUJO DE CREACIÓN ---
            const createdAtStr = now.toISOString();

            // Resolver timelineId desde el trabajo si existe
            if (trabajoId && !finalTimelineId) {
                try {
                    // Primero, intentar leer de IndexedDB (LocalDB) que es instantáneo y offline-first
                    const { getEntity } = await import("../../services/localRepositories");
                    const { STORES } = await import("../../services/localDb");
                    const localJob = await getEntity(STORES.trabajos as any, trabajoId).catch(() => null);
                    if (localJob && localJob.timelineId) {
                        finalTimelineId = localJob.timelineId;
                    } else {
                        // Fallback a Firestore con timeout controlado para evitar bloqueos
                        const { getDocFromCache } = await import('firebase/firestore');
                        const timeoutPromise = new Promise<any>((_, reject) => setTimeout(() => reject(new Error("TIMEOUT_GETDOC")), 1500));
                        const getDocPromise = getDoc(doc(db, 'trabajos', trabajoId));
                        
                        const jobSnap = await Promise.race([getDocPromise, timeoutPromise]).catch(async (err) => {
                            console.warn("[vehicleService] Firestore fetch for job timed out or failed, trying cache:", err);
                            return await getDocFromCache(doc(db, 'trabajos', trabajoId)).catch(() => null);
                        });
                        
                        if (jobSnap && jobSnap.exists() && jobSnap.data().timelineId) {
                            finalTimelineId = jobSnap.data().timelineId;
                        }
                    }
                } catch(e) { console.warn("Job timeline resolution failed:", e); }
            }

            if (!finalTimelineId) {
                const safeUuid = () => {
                   if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
                   return `tl_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
                };
                finalTimelineId = safeUuid();
            }

            const dataToSaveCreate = {
                ...dataToSave,
                ...(trabajoId && { trabajoId }),
                createdAt: createdAtStr,
                createdBy: currentUser.id,
                timelineId: finalTimelineId
            };

            const safeId = () => {
               if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
               return `bit_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
            };
            bitacoraId = safeId();
            
            // Migración: setVersionedDocOffline (SQLite + Mutation Queue)
            await setVersionedDocOffline('bitacora_vehiculos', bitacoraId, dataToSaveCreate);
            resultLogDoc = { ...dataToSaveCreate, id: bitacoraId };

            // CORRECCIÓN CRITIC: Update the job directly so it contains the correct references
            if (trabajoId) {
                try {
                    // Force the job doc to point to this new Bitácora and Timeline immediately
                    await updateVersionedDocOffline('trabajos', trabajoId, {
                        registroBitacoraId: bitacoraId,
                        timelineId: finalTimelineId
                    });
                } catch(err) {
                    console.warn("[vehicleService] Failed to update job with new bitacora/timeline IDs:", err);
                }
            }
        }

        // 4. Operaciones Secundarias Desacopladas
        // Ninguna de estas operaciones debe hacer fallar el guardado principal de la bitácora
        setTimeout(() => {
            try {
                if (isEditing && initialData) {
                    // Evento: bitacora_actualizada
                    const finalEventDate = new Date();
                    createSystemEvent(finalTimelineId, "bitacora_actualizada", {
                        conductor: dataToSave.conductorName || currentUser?.name || 'Sistema',
                        unidad: dataToSave.unidad || 'Unidad',
                        destino: dataToSave.destino || "Actualizado",
                        fechaHora: formatSystemEventDateTime(finalEventDate),
                        bitacoraId: initialData.id, // Added for navigation
                        descripcion: "Se actualizó la información de la bitácora."
                    }, finalEventDate, `actualizada_${finalTimelineId}_${Date.now()}`).catch(err => console.error("[vehicleService] Secondary event failed:", err));
                } else {
                    // Evento: bitacora_iniciada
                    const finalEventDate = new Date();
                    const conductor = resultLogDoc.conductorName || currentUser?.name || 'Sistema';
                    const kmSalida = resultLogDoc.kmSalida || 0;
                    const combustibleInicial = resultLogDoc.combustible || 'Full';

                    createSystemEvent(finalTimelineId, "bitacora_iniciada", {
                        conductor,
                        unidad: vUnidad,
                        destino: sanitizedData.destino || "No especificado",
                        kmSalida,
                        combustibleInicial,
                        fechaHora: formatSystemEventDateTime(finalEventDate),
                        bitacoraId: bitacoraId, // Added for navigation
                        descripcion: `Se inició una nueva sesión operacional para la unidad ${vUnidad} con destino a "${sanitizedData.destino || "No especificado"}". Km salida: ${kmSalida} km, combustible inicial: ${combustibleInicial}.`
                    }, finalEventDate, `iniciada_${finalTimelineId}_${vUnidad.replace(/\s+/g, '_')}`).catch(err => console.error("[vehicleService] Secondary event failed:", err));
                }

                // 4.1. Sincronizar Metadatos del Timeline (Cabecera)
                const tlRef = doc(db, 'operational_timelines', finalTimelineId);
                setDoc(tlRef, {
                    id: finalTimelineId,
                    creado_en: now.toISOString(),
                    metadata: {
                        title: `Bitácora de Salida: ${vUnidad || ""}`,
                        subtitle: `${vPlaca || ""} - ${currentUser.name || ""}`,
                        status: resultLogDoc.kmLlegada ? "finalizado" : "en_proceso",
                        vehiculoId: vehiculoId || null,
                        unidad: vUnidad || null,
                        placa: vPlaca || null,
                        createdBy: currentUser.id,
                        createdAt: now.toISOString(),
                        bitacoraId: bitacoraId || resultLogDoc.id || null
                    }
                }, { merge: true }).catch(tlErr => {
                    console.warn("[vehicleService] Operational timeline metadata update deferred (app is offline)", tlErr);
                });

                // 4.2. Trigger de Recarga de combustible si aplica
                const tieneRecarga = dataToSave.kmRecarga || dataToSave.monto || dataToSave.litros;
                const recargaExistia = (isEditing && initialData) ? (initialData.kmRecarga || initialData.monto || initialData.litros) : false;

                if (tieneRecarga && !recargaExistia) {
                    const finalEventDate = new Date();
                    const eventData: any = {
                        conductor: dataToSave.conductorName || currentUser?.name || 'Sistema',
                        unidad: dataToSave.unidad || 'Unidad',
                        kmRecarga: dataToSave.kmRecarga || 0,
                        monto: dataToSave.monto || 0,
                        litros: dataToSave.litros || 0,
                        gasolinera: dataToSave.gasolinera || 'No especificada',
                        combustible: dataToSave.combustible || 'No especificado',
                        fechaHora: formatSystemEventDateTime(finalEventDate),
                        bitacoraId: bitacoraId || resultLogDoc.id, // Added for navigation
                        descripcion: `Se registró una recarga de combustible de la unidad ${dataToSave.unidad || "Unidad"}.\nDetalle: ₡${(dataToSave.monto || 0).toLocaleString()} por ${(dataToSave.litros || 0)} litros en la estación "${dataToSave.gasolinera || 'No especificada'}". Km de recarga: ${dataToSave.kmRecarga || 0} km.`
                    };
                    const deterministicId = `recarga_${finalTimelineId}_${Date.now()}`;
                    createSystemEvent(finalTimelineId, "bitacora_recarga_combustible", eventData, finalEventDate, deterministicId)
                        .then(() => console.log(`[VEHICLE_SERVICE] [CREATE_SYSTEM_EVENT_SUCCESS] Action: bitacora_recarga_combustible, TimelineId: ${finalTimelineId}`))
                        .catch(err => console.error("[vehicleService] Failed to record refueling event:", err));
                }

                // 4.3. Trigger de Finalización si aplica
                if (isFinalizando) {
                    recordBitacoraFinalizedEvent(finalTimelineId, resultLogDoc).catch(console.error);
                }

                // 4.4. Auditoría
                auditService.logEvent({
                  action: isEditing ? (isFinalizando ? 'finalize_record' : 'update_record') : 'create_record',
                  module: 'Bitácora de Vehículos',
                  submodule: 'Bitácora',
                  route: '/bitacora-vehiculos',
                  recordId: resultLogDoc.id || 'new-log',
                  recordCode: dataToSave.unidad
                });
            } catch (secondaryError) {
                console.error("[vehicleService] Error in secondary operations (ignored for main save):", secondaryError);
            }
        }, 0);

        return { 
            success: true, 
            timelineId: finalTimelineId, 
            logDoc: resultLogDoc 
        };

    } catch (err) {
        console.error("[vehicleService] CRITICAL Error in saveVehicleLog:", err);
        throw err;
    }
};

/**
 * Actualiza un registro de bitácora de forma parcial (útil para normalización).
 */
export const updateVehicleLog = async (
    id: string,
    data: Partial<VehicleLog>,
    currentUser: User
) => {
    try {
        const now = new Date().toISOString();
        const dataToSave = {
            ...data,
            updatedAt: now,
            updatedBy: currentUser.id
        };

        // Persistencia offline-first
        await updateVersionedDocOffline('bitacora_vehiculos', id, dataToSave);
        
        return { success: true };
    } catch (err) {
        console.error("[vehicleService] Error in updateVehicleLog:", err);
        throw err;
    }
};

/**
 * Guarda un gasto de vehículo con soporte offline.
 */
export const saveVehicleExpense = async (
    expenseData: Partial<VehicleExpense>,
    currentUser: User
) => {
    const now = new Date();
    const id = expenseData.id || `exp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    // Sanitización para evitar valores 'undefined' en Firestore
    const sanitizedData: Record<string, any> = {};
    Object.keys(expenseData).forEach(key => {
        const val = (expenseData as any)[key];
        if (val !== undefined) {
            sanitizedData[key] = val;
        }
    });

    const dataToSave: VehicleExpense = {
        ...sanitizedData,
        id,
        createdAt: expenseData.createdAt || now.toISOString(),
        createdBy: expenseData.createdBy || currentUser.id,
        updatedAt: now.toISOString(),
        version: (expenseData.version || 0) + 1,
        isDeleted: expenseData.isDeleted ?? false,
    } as VehicleExpense;

    await setVersionedDocOffline('vehicle_expenses', id, dataToSave);

    auditService.logEvent({
        action: expenseData.id ? 'update_expense' : 'create_expense',
        module: 'Análisis de Flota',
        submodule: 'Gastos',
        route: '/analisis-flota',
        recordId: id,
        recordCode: dataToSave.unidad
    });

    return { success: true, id };
};

/**
 * Elimina un gasto de vehículo (soft delete).
 */
export const deleteVehicleExpense = async (id: string, expenseData: VehicleExpense, currentUser: User) => {
    const dataToSave = {
        ...expenseData,
        isDeleted: true,
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser.id,
        version: (expenseData.version || 0) + 1
    };
    
    await updateVersionedDocOffline('vehicle_expenses', id, dataToSave);
    
    auditService.logEvent({
        action: 'delete_expense',
        module: 'Análisis de Flota',
        submodule: 'Gastos',
        route: '/analisis-flota',
        recordId: id,
        recordCode: expenseData.unidad
    });
    
    return { success: true };
};

/**
 * Obtiene los gastos de una unidad con soporte offline.
 */
export const getVehicleExpenses = async (unidad: string): Promise<VehicleExpense[]> => {
    try {
        // 1. Intentar obtener de Firestore si hay red
        let remoteExpenses: VehicleExpense[] = [];
        if (networkProbe.isOnline()) {
            const q = query(
                collection(db, 'vehicle_expenses'),
                where('unidad', '==', unidad),
                where('isDeleted', '==', false)
            );
            const snap = await getDocs(q);
            remoteExpenses = snap.docs.map(d => ({ ...d.data(), id: d.id } as VehicleExpense));
        }

        // 2. Obtener de LocalDB
        const localDocs = await localDocStore.getLocalCollection('vehicle_expenses');
        const localExpenses = localDocs
            .filter(d => d.data?.unidad === unidad && !d.data?.isDeleted)
            .map(d => ({ ...d.data, id: d.docId } as VehicleExpense));

        // 3. Mezclar (preferir local si es dirty)
        const expenseMap = new Map<string, VehicleExpense>();
        remoteExpenses.forEach(e => expenseMap.set(e.id, e));
        localExpenses.forEach(e => expenseMap.set(e.id, e));

        const result = Array.from(expenseMap.values());
        result.sort((a, b) => b.fecha.localeCompare(a.fecha));
        return result;
    } catch (error) {
        console.error("[vehicleService] Error getting vehicle expenses:", error);
        return [];
    }
};
