import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, updateDoc, arrayUnion, getDoc } from 'firebase/firestore';
import { db, storage } from '../../firebase';
import { pdfOfflineQueue } from './pdfOfflineQueue';
import { pdfFileEngine } from './pdfFileEngine';
import { networkProbe } from '../offline/networkProbe';
import { getBlob } from '../../services/offlineMediaStore';
import { localDB } from '../offline/localDB';
import { Capacitor } from '@capacitor/core';

let isSyncingPdf = false;
const STORAGE_TIMEOUT_MS = 15000;

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number = STORAGE_TIMEOUT_MS, errorMsg: string = "Operación de Storage excedió el tiempo límite"): Promise<T> {
    return Promise.race([
        promise,
        new Promise<T>((_, reject) => 
            setTimeout(() => reject(new Error(errorMsg)), timeoutMs)
        )
    ]);
}

export async function runPdfSyncCycle(): Promise<void> {
    if (isSyncingPdf) {
        console.log("[PdfStorageSync] Ciclo de sincronización de PDFs ya activo. Ignorando.");
        return;
    }

    if (!networkProbe.isOnline()) {
        console.log("[PdfStorageSync] Red inestable o desconectada (NetworkProbe). Sincronización pospuesta.");
        return;
    }

    isSyncingPdf = true;
    console.log("[PdfStorageSync] Iniciando ciclo de sincronización de PDFs...");

    try {
        await pdfOfflineQueue.purgeCompletedUploads();

        const pending = await pdfOfflineQueue.getPendingUploads();
        if (pending.length === 0) {
            console.log("[PdfStorageSync] No hay PDFs pendientes en la cola.");
            return;
        }

        console.log(`[PdfStorageSync] Encontrados ${pending.length} PDFs pendientes por subir.`);

        for (const entry of pending) {
            if (!networkProbe.isOnline()) {
                console.warn("[PdfStorageSync] Se perdió la conexión a internet. Pausando ciclo de PDFs.");
                break;
            }

            if (entry.attempts >= 5) {
                console.error(`[PdfStorageSync] El archivo ${entry.fileName} excedió el límite de reintentos.`);
                await pdfOfflineQueue.markUploadStatus(entry.id, 'dead', 'Límite de reintentos excedido');
                continue;
            }

            try {
                if (Capacitor.isNativePlatform()) {
                    const exists = await pdfFileEngine.fileExists(entry.fileName);
                    if (!exists) {
                        console.error(`[PdfStorageSync] Archivo físico ausente en Documents: ${entry.fileName}. Marcando como corrupto.`);
                        await pdfOfflineQueue.markUploadStatus(entry.id, 'corrupt', `El archivo físico ${entry.fileName} no existe en Documents.`);
                        continue;
                    }
                }

                let blob: Blob;
                if (Capacitor.isNativePlatform()) {
                    blob = await pdfFileEngine.readPdfFromDevice(entry.fileName);
                } else {
                    const cachedBlob = await getBlob(entry.localPath);
                    if (!cachedBlob) {
                        throw new Error(`Blob original no encontrado en almacenamiento offline: ${entry.localPath}`);
                    }
                    blob = cachedBlob;
                }

                let alreadyUploadedPath: string | null = null;
                let alreadyUploadedUrl: string | null = null;

                if (Capacitor.isNativePlatform()) {
                    const sqliteDb = localDB.getDb();
                    if (sqliteDb) {
                        const res = await sqliteDb.query(
                            `SELECT firebasePath FROM pdf_upload_queue WHERE checksum = ? AND status = 'completed' LIMIT 1`,
                            [entry.checksum]
                        );
                        if (res?.values && res.values.length > 0) {
                            alreadyUploadedPath = res.values[0].firebasePath;
                            console.log(`[PdfStorageSync] Checksum coincidente (${entry.checksum}) encontrado en base local. Reusando path: ${alreadyUploadedPath}`);
                        }
                    }
                }

                const isAttachment = entry.targetCollection.endsWith('/attachments');
                const attachmentParent = isAttachment
                    ? entry.targetCollection.replace(/\/attachments$/, '')
                    : '';

                const orgId = "tentelcom";
                const firebasePath = entry.module === 'vehicles'
                    ? entry.localPath
                    : isAttachment
                        ? `${attachmentParent}/attachments/${entry.targetDocId}-${entry.fileName}`
                        : (alreadyUploadedPath || `uploads/${orgId}/${entry.module}/${entry.targetDocId}/${entry.fileName}`);

                const storageRef = ref(storage, firebasePath);

                await pdfOfflineQueue.markUploadStatus(entry.id, 'uploading');

                if (alreadyUploadedPath && !isAttachment) {
                    try {
                        alreadyUploadedUrl = await withTimeout(
                            getDownloadURL(storageRef),
                            STORAGE_TIMEOUT_MS,
                            "Error pidiendo URL de Storage en idempotencia"
                        );
                    } catch (e) {
                        console.warn("[PdfStorageSync] No se pudo obtener URL por idempotencia, re-intentando upload físico...", e);
                        alreadyUploadedPath = null;
                    }
                }

                let finalDownloadUrl = alreadyUploadedUrl;

                if (!alreadyUploadedUrl) {
                    let unidadCompleta: string | undefined;
                    if (entry.module === 'vehicles' && entry.targetDocId && entry.targetDocId !== 'temp_id') {
                        try {
                            const bitacoraSnap = await getDoc(doc(db, 'bitacora_vehiculos', entry.targetDocId));
                            if (bitacoraSnap.exists()) {
                                unidadCompleta = bitacoraSnap.data()?.unidadId as string | undefined;
                            }
                        } catch (e) {
                            console.warn('[PdfStorageSync] No se pudo resolver unidadCompleta para metadata:', e);
                        }
                    }

                    console.log(`[PdfStorageSync] Subiendo archivo "${entry.fileName}" a "${firebasePath}"...`);
                    const uploadPromise = uploadBytes(storageRef, blob, {
                        contentType: entry.mimeType,
                        customMetadata: {
                            checksum: entry.checksum,
                            module: entry.module,
                            targetDocId: entry.targetDocId,
                            ...(unidadCompleta ? { unidadCompleta } : {})
                        }
                    });

                    await withTimeout(uploadPromise, STORAGE_TIMEOUT_MS, "Timeout alcanzado al subir archivo a Firebase Storage");

                    finalDownloadUrl = await withTimeout(
                        getDownloadURL(storageRef),
                        STORAGE_TIMEOUT_MS,
                        "Timeout alcanzado al obtener la URL de descarga de Firebase Storage"
                    );
                }

                if (!finalDownloadUrl) {
                    throw new Error("No se pudo resolver la URL de descarga para el archivo");
                }

                console.log(`[PdfStorageSync] Actualizando documento Firestore: ${entry.targetCollection}/${entry.targetDocId}...`);
                const docRef = doc(db, entry.targetCollection, entry.targetDocId);

                let firestoreUpdatePayload: any;
                if (entry.targetCollection === 'external_products') {
                    firestoreUpdatePayload = {
                        fichas_tecnicas: arrayUnion(finalDownloadUrl),
                        updatedAt: new Date().toISOString()
                    };
                } else {
                    firestoreUpdatePayload = {
                        downloadURL: finalDownloadUrl,
                        downloadUrl: finalDownloadUrl,
                        url: finalDownloadUrl,
                        storagePath: firebasePath,
                        uploadedAt: new Date().toISOString(),
                        checksum: entry.checksum
                    };
                }

                const firestorePromise = updateDoc(docRef, firestoreUpdatePayload);
                await withTimeout(firestorePromise, STORAGE_TIMEOUT_MS, "Timeout alcanzado al actualizar el documento en Firestore");

                console.log(`[PdfStorageSync] Sincronización exitosa del archivo ${entry.fileName}. URL: ${finalDownloadUrl}`);
                await pdfOfflineQueue.markUploadStatus(entry.id, 'completed', undefined, firebasePath);

            } catch (error: any) {
                const errMsg = error instanceof Error ? error.message : String(error);
                console.error(`[PdfStorageSync] Error procesando elemento ${entry.id} de la cola:`, error);
                await pdfOfflineQueue.markUploadStatus(entry.id, 'failed', errMsg);
            }
        }

    } catch (e) {
        console.error("[PdfStorageSync] Error crítico en el ciclo de sincronización de PDFs:", e);
    } finally {
        isSyncingPdf = false;
        console.log("[PdfStorageSync] Ciclo de sincronización terminado.");
    }
}
