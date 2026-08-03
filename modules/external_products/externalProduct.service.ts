import { db } from '../../firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { ExternalProduct, ExternalProductStatus } from './types';
import { cachedQuery, invalidateCache } from '../../utils/queryCache';
import { safeUpdate } from '../../core/writeService';
import { pdfOfflineQueue, calculateBlobChecksum } from '../../core/pdf/pdfOfflineQueue';
import { pdfFileEngine } from '../../core/pdf/pdfFileEngine';
import { networkProbe } from '../../core/offline/networkProbe';
import { runPdfSyncCycle } from '../../core/pdf/pdfStorageSync';

const COLLECTION_NAME = 'external_products';
const CACHE_PREFIX = 'external_products';

export const uploadPDFs = async (files: File[], docId: string): Promise<string[]> => {
  try {
    const urls: string[] = [];
    for (const file of files) {
      // 1. Guardar localmente primero (Filesystem First)
      let physicalPath = file.name;
      try {
        physicalPath = await pdfFileEngine.savePdfToDevice(file.name, file);
      } catch (saveErr) {
        console.warn("uploadPDFs: Error guardando PDF físico en dispositivo", saveErr);
      }

      // 2. Calcular Checksum SHA-256
      const checksum = await calculateBlobChecksum(file);

      // 3. Encolar upload en SQLite (Queue Second)
      await pdfOfflineQueue.enqueuePdfUpload(
        physicalPath,
        file.name,
        file.type,
        'external_products', // module
        'external_products', // targetCollection
        docId, // targetDocId
        checksum
      );
    }

    // 4. Si está online, disparar el ciclo de sincronización en segundo plano (Sync Third)
    if (networkProbe.isOnline()) {
      runPdfSyncCycle().catch((err) => {
        console.error("uploadPDFs: Error corriendo runPdfSyncCycle en segundo plano", err);
      });
    }

    return urls;
  } catch (error) {
    console.error("Error subiendo PDFs con cola offline:", error);
    throw error;
  }
};

export const updateExternalProduct = async (id: string, data: Partial<ExternalProduct>): Promise<{ success: boolean; message?: string }> => {
  try {
    await safeUpdate(COLLECTION_NAME, id, data);
    invalidateCache(CACHE_PREFIX);
    return { success: true, message: 'Producto actualizado correctamente.' };
  } catch (error: any) {
    console.error("Error en updateExternalProduct:", error);
    return { success: false, message: error.message || 'Error al actualizar.' };
  }
};

/**
 * Obtiene todos los productos externos filtrados por estado.
 * Usa caché local de 60s.
 */
export const getExternalProductsByStatus = async (status: ExternalProductStatus): Promise<ExternalProduct[]> => {
  const cacheKey = `${CACHE_PREFIX}_${status}`;

  return await cachedQuery(cacheKey, async () => {
    try {
      // Se remueve orderBy para evitar el error de índice compuesto en Firestore
      const q = query(
        collection(db, COLLECTION_NAME), 
        where('estado', '==', status)
      );
      
      const snapshot = await getDocs(q);
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as ExternalProduct));

      // Ordenamiento en el cliente (descendente por fecha_ingreso)
      list.sort((a, b) => {
          const dateA = new Date(a.fecha_ingreso || 0).getTime();
          const dateB = new Date(b.fecha_ingreso || 0).getTime();
          return dateB - dateA;
      });

      return list;
    } catch (error) {
      console.error("Error fetching external products:", error);
      return [];
    }
  });
};

/**
 * Actualiza el estado de revisión de un producto.
 * MIGRADO A WRITE PROTECTION LAYER
 */
export const reviewExternalProduct = async (
  id: string, 
  status: 'APROBADO' | 'RECHAZADO', 
  reviewerId: string
): Promise<{ success: boolean; message?: string }> => {
  try {
    // Uso de safeUpdate en lugar de updateDoc directo
    await safeUpdate(COLLECTION_NAME, id, {
      estado: status,
      revisado_por: reviewerId,
      fecha_revision: new Date().toISOString()
    });

    // Invalidar caché para reflejar el cambio de estado
    invalidateCache(CACHE_PREFIX);

    return { success: true };
  } catch (error: any) {
    console.error("Error reviewing product:", error);
    return { success: false, message: error.message };
  }
};
