
import { db, storage, auth } from '../../firebase';
import { collection, doc, deleteDoc, setDoc } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { Attachment, AttachmentType } from './attachment.types';
import { v4 as uuidv4 } from 'uuid';
import { pdfOfflineQueue, calculateBlobChecksum } from '../../core/pdf/pdfOfflineQueue';
import { pdfFileEngine } from '../../core/pdf/pdfFileEngine';
import { networkProbe } from '../../core/offline/networkProbe';
import { runPdfSyncCycle } from '../../core/pdf/pdfStorageSync';
import { auditService } from '../../services/auditService';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

function handleFirebaseError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  };
  console.error('Firebase Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Sube un archivo y crea el documento de metadatos en una colección dinámica.
 * @param entityType - 'quotes' | 'purchase_orders' | 'invoices'
 * @param entityId - ID de la entidad
 */
export const uploadFileAndCreateAttachmentDoc = async (
  entityType: string,
  entityId: string | number,
  file: File,
  type: AttachmentType
): Promise<void> => {
  if (!entityType || !entityId || !file || !type) {
    throw new Error('Argumentos inválidos para la subida de archivo.');
  }

  const fileId = uuidv4();
  const filePath = `${entityType}/${entityId}/attachments/${fileId}-${file.name}`;

  try {
    // 1. Guardar localmente primero (Filesystem First)
    let physicalPath = file.name;
    try {
      physicalPath = await pdfFileEngine.savePdfToDevice(file.name, file);
    } catch (saveErr) {
      console.warn("attachments: Error guardando PDF físico en dispositivo, procediendo con nombre", saveErr);
    }

    // 2. Calcular Checksum SHA-256 del archivo
    const checksum = await calculateBlobChecksum(file);

    // 3. Crear metadatos optimistas en Firestore para visibilidad inmediata offline
    const attachmentsCollectionRef = collection(db, entityType, entityId.toString(), 'attachments');
    const attachmentDocRef = doc(attachmentsCollectionRef, fileId);
    
    await setDoc(attachmentDocRef, {
      name: file.name,
      url: "", // Se llenará en segundo plano tras completarse el upload
      downloadURL: "",
      downloadUrl: "",
      type: type,
      createdAt: new Date().toISOString(),
      path: filePath,
      checksum: checksum,
      isOffline: true
    });

    // 4. Encolar upload en SQLite (Queue Second)
    const targetColl = `${entityType}/${entityId.toString()}/attachments`;
    await pdfOfflineQueue.enqueuePdfUpload(
      physicalPath,
      file.name,
      file.type,
      entityType, // module
      targetColl, // targetCollection
      fileId, // targetDocId
      checksum
    );

    auditService.logEvent({
      action: 'upload_file',
      module: 'Adjuntos',
      submodule: entityType,
      recordId: entityId.toString(),
      recordCode: file.name,
      route: '/attachments'
    });

    // 5. Si está online, disparar ciclo de sync en segundo plano (Sync Third)
    if (networkProbe.isOnline()) {
      runPdfSyncCycle().catch((err) => {
        console.error("attachments: Error al correr runPdfSyncCycle posterior a encolar", err);
      });
    }

  } catch (error) {
    handleFirebaseError(error, OperationType.WRITE, filePath);
  }
};

/**
 * Elimina un archivo de Storage y su metadato en Firestore.
 */
export const deleteFileAndAttachmentDoc = async (
  entityType: string,
  entityId: string | number,
  attachment: Attachment
): Promise<void> => {
  if (!entityType || !entityId || !attachment || !attachment.path || !attachment.id) {
    throw new Error('Argumentos inválidos para eliminar el archivo.');
  }

  const storageRef = ref(storage, attachment.path);

  try {
    await deleteObject(storageRef);
  } catch (error: any) {
    if (error.code !== 'storage/object-not-found') {
      throw error;
    }
    console.warn(`Archivo no encontrado en Storage, eliminando registro en Firestore.`);
  }

  const attachmentDocRef = doc(db, entityType, entityId.toString(), 'attachments', attachment.id);
  await deleteDoc(attachmentDocRef);

  auditService.logEvent({
    action: 'delete_record',
    module: 'Adjuntos',
    submodule: entityType,
    recordId: attachment.id,
    recordCode: attachment.name,
    route: '/attachments'
  });
};
