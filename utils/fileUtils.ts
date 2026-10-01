import { Capacitor } from '@capacitor/core';
import { pdfFileEngine } from '../core/pdf/pdfFileEngine';

export const triggerFileDownload = async (blob: Blob, fileName: string) => {
    console.log("triggerFileDownload: Iniciando...", { fileName, blobSize: blob?.size, blobType: blob?.type });

    if (!blob || blob.size === 0) {
        console.error("triggerFileDownload: Blob vacío o inválido, descarga cancelada.");
        return;
    }

    if (Capacitor.isNativePlatform()) {
        try {
            const finalUri = await pdfFileEngine.savePdfToDevice(fileName, blob);
            console.log("triggerFileDownload: Guardado nativo exitoso en", finalUri);
            await pdfFileEngine.openPdf(fileName);
            return;
        } catch (e) {
            console.error("triggerFileDownload: Error guardando local nativo", e);
            alert(`No se pudo guardar el archivo en el dispositivo. Asegúrese de otorgar permisos de almacenamiento. Detalles: ${e}`);
            return; // Detener flujo, no hacer fallback a web
        }
    }

    // Web Fallback / PWA
    console.log("triggerFileDownload: Web Fallback");
    const url = URL.createObjectURL(blob);
    console.log("triggerFileDownload: URL creada", url);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.style.display = 'none';
    document.body.appendChild(link);
    console.log("triggerFileDownload: Link appendido y clickeando");
    link.click();
    console.log("triggerFileDownload: Link clickeado");
    document.body.removeChild(link);
    
    // Limpiamos después de un tiempo prudente (10s para permitir que el gestor de descargas de Android procese el stream)
    setTimeout(() => {
        URL.revokeObjectURL(url);
        console.log("triggerFileDownload: URL revocada");
    }, 10000);
};

export function dataUrlToBlob(dataUrl: string): Blob {
  const parts = dataUrl.split(',');
  if (parts.length < 2) {
    throw new Error('Formato de Data URL inválido');
  }
  const mimeMatch = parts[0].match(/:(.*?);/);
  const mimeType = mimeMatch ? mimeMatch[1] : 'application/pdf';
  const byteString = atob(parts[1]);
  const n = byteString.length;
  const u8arr = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    u8arr[i] = byteString.charCodeAt(i);
  }
  return new Blob([u8arr], { type: mimeType });
}

export async function isValidPdfBlob(blob: Blob): Promise<boolean> {
  if (!blob || blob.size < 50) return false;
  try {
    const slice = blob.slice(0, 1024);
    const text = await slice.text();
    if (text.startsWith('mock-pdf-content') || text.includes('<!DOCTYPE') || text.includes('<html')) {
      return false;
    }
    return text.includes('%PDF');
  } catch {
    return false;
  }
}

export class FileCorruptedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FileCorruptedError';
  }
}

/**
 * Descarga cualquier archivo (PDF, imagen, documentos) de forma segura y transparente,
 * evitando bloqueos de CORS de Firebase Storage a través del proxy del servidor o descarga directa.
 */
export const downloadFileSafely = async (
  rawUrl: string | undefined | null,
  fileName: string,
  storagePath?: string
): Promise<void> => {
  let fileUrl = rawUrl?.trim() || '';

  // 1. Si la URL está vacía pero tenemos storagePath, obtener la URL fresca de Firebase Storage
  if (!fileUrl && storagePath) {
    try {
      const { ref, getDownloadURL } = await import('firebase/storage');
      const { storage } = await import('../firebase');
      const storageRef = ref(storage, storagePath);
      fileUrl = await getDownloadURL(storageRef);
    } catch (err) {
      console.warn('[downloadFileSafely] No se pudo resolver getDownloadURL desde storagePath:', err);
    }
  }

  if (!fileUrl) {
    throw new Error('No se encontró una URL de descarga válida. Es posible que el archivo aún se esté subiendo o sincronizando.');
  }

  // 2. Si estamos en plataforma nativa (Android / iOS con Capacitor)
  if (Capacitor.isNativePlatform()) {
    try {
      const exists = await pdfFileEngine.fileExists(fileName);
      if (exists) {
        await pdfFileEngine.openPdf(fileName);
        return;
      }
    } catch (checkErr) {
      console.warn('[downloadFileSafely] Verificación de archivo local nativo:', checkErr);
    }
  }

  // 3. Si es una URL de datos (data:), decodificar sincrónicamente a Blob
  if (fileUrl.startsWith('data:')) {
    try {
      const blob = dataUrlToBlob(fileUrl);
      const isPdf = fileName.toLowerCase().endsWith('.pdf');
      if (!isPdf || (await isValidPdfBlob(blob))) {
        await triggerFileDownload(blob, fileName);
        return;
      }
      console.warn('[downloadFileSafely] Data URL local incompleto o corrupto, intentando desde Firebase Storage...');
    } catch (dataErr) {
      console.warn('[downloadFileSafely] Falló decodificación de data URL, intentando desde Firebase Storage:', dataErr);
    }
  }

  // Si es un Blob URL del navegador (blob:), descargar directamente
  if (fileUrl.startsWith('blob:')) {
    try {
      const link = document.createElement('a');
      link.href = fileUrl;
      link.download = fileName;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    } catch (blobErr) {
      console.error('[downloadFileSafely] Error descargando blob URL:', blobErr);
      throw blobErr;
    }
  }

  // 4. Intentar descarga a través del proxy del servidor (bypasea CORS sin exponer credenciales)
  const candidateProxyEndpoints = [
    `/api/download-proxy?url=${encodeURIComponent(fileUrl)}&filename=${encodeURIComponent(fileName)}`
  ];

  let proxySuccess = false;

  for (const proxyUrl of candidateProxyEndpoints) {
    try {
      const response = await fetch(proxyUrl);
      if (!response.ok) {
        throw new Error(`Proxy HTTP ${response.status}`);
      }

      const contentType = (response.headers.get('content-type') || '').toLowerCase();
      // Si el servidor devolvió HTML (fallback SPA del frontend), ignorar
      if (contentType.includes('html')) {
        throw new Error('El servidor devolvió contenido HTML en lugar del archivo binario.');
      }

      const blob = await response.blob();
      if (blob.size === 0) {
        throw new Error('Archivo recibido vacío');
      }

      // Verificación estricta de integridad si es PDF
      if (fileName.toLowerCase().endsWith('.pdf')) {
        const isValid = await isValidPdfBlob(blob);
        if (!isValid) {
          throw new FileCorruptedError('Este archivo en el servidor se guardó de forma incompleta antes de la actualización. Por favor, elimínelo pulsando el icono rojo de la papelera 🗑️ y vuelva a subir el documento original con "+ ADJUNTAR".');
        }
      }

      await triggerFileDownload(blob, fileName);
      proxySuccess = true;
      return;
    } catch (proxyErr) {
      if (proxyErr instanceof FileCorruptedError) {
        throw proxyErr;
      }
      console.warn(`[downloadFileSafely] Falló proxy ${proxyUrl}:`, proxyErr);
    }
  }

  // 5. Fallback: Intento de fetch directo (funciona si CORS está habilitado)
  if (!proxySuccess) {
    try {
      const directResponse = await fetch(fileUrl);
      if (directResponse.ok) {
        const directBlob = await directResponse.blob();
        if (directBlob.size > 0) {
          if (fileName.toLowerCase().endsWith('.pdf')) {
            const isValid = await isValidPdfBlob(directBlob);
            if (!isValid) {
              throw new FileCorruptedError('Este archivo en el servidor se guardó de forma incompleta antes de la actualización. Por favor, elimínelo pulsando el icono rojo de la papelera 🗑️ y vuelva a subir el documento original con "+ ADJUNTAR".');
            }
          }
          await triggerFileDownload(directBlob, fileName);
          return;
        }
      }
    } catch (directFetchErr) {
      if (directFetchErr instanceof FileCorruptedError) {
        throw directFetchErr;
      }
      console.warn('[downloadFileSafely] Fetch directo bloqueado:', directFetchErr);
    }
  }

  // Si falló tanto el proxy como la lectura directa, notificar al usuario en vez de descargar un enlace roto
  throw new Error('No se pudo descargar el archivo. Por favor verifique su conexión o elimine y vuelva a adjuntar el documento.');
};

/**
 * Obtiene el Blob binario de un archivo de manera segura usando la misma jerarquía (IndexedDB / DataURL / Proxy / Storage).
 */
export const fetchFileBlobSafely = async (
  rawUrl: string | undefined | null,
  fileName: string,
  storagePath?: string
): Promise<Blob> => {
  let fileUrl = rawUrl?.trim() || '';

  if (!fileUrl && storagePath) {
    try {
      const { ref, getDownloadURL } = await import('firebase/storage');
      const { storage } = await import('../firebase');
      const storageRef = ref(storage, storagePath);
      fileUrl = await getDownloadURL(storageRef);
    } catch (err) {
      console.warn('[fetchFileBlobSafely] No se pudo resolver getDownloadURL desde storagePath:', err);
    }
  }

  if (fileUrl.startsWith('data:')) {
    const blob = dataUrlToBlob(fileUrl);
    const isPdf = fileName.toLowerCase().endsWith('.pdf');
    if (!isPdf || (await isValidPdfBlob(blob))) {
      return blob;
    }
  }

  if (fileUrl.startsWith('blob:')) {
    const resp = await fetch(fileUrl);
    return await resp.blob();
  }

  const proxyUrl = `/api/download-proxy?url=${encodeURIComponent(fileUrl)}&filename=${encodeURIComponent(fileName)}`;
  try {
    const response = await fetch(proxyUrl);
    if (response.ok) {
      const blob = await response.blob();
      if (blob.size > 0) {
        if (fileName.toLowerCase().endsWith('.pdf')) {
          const isValid = await isValidPdfBlob(blob);
          if (!isValid) {
            throw new FileCorruptedError('El archivo en el servidor está dañado o incompleto.');
          }
        }
        return blob;
      }
    }
  } catch (proxyErr) {
    if (proxyErr instanceof FileCorruptedError) throw proxyErr;
  }

  const directResponse = await fetch(fileUrl);
  if (directResponse.ok) {
    const directBlob = await directResponse.blob();
    if (directBlob.size > 0) {
      if (fileName.toLowerCase().endsWith('.pdf')) {
        const isValid = await isValidPdfBlob(directBlob);
        if (!isValid) {
          throw new FileCorruptedError('El archivo en el servidor está dañado o incompleto.');
        }
      }
      return directBlob;
    }
  }

  throw new Error('No se pudo recuperar el archivo para procesarlo.');
};

/**
 * Abre el diálogo nativo de compartir del teléfono o computadora con el archivo adjunto real.
 */
export const shareFileSafely = async (
  blobOrUrl: Blob | string | undefined | null,
  fileName: string,
  storagePath?: string
): Promise<void> => {
  let blob: Blob;
  if (blobOrUrl instanceof Blob) {
    blob = blobOrUrl;
  } else {
    blob = await fetchFileBlobSafely(blobOrUrl, fileName, storagePath);
  }

  // 1. Plataforma Nativa (Android / iOS Capacitor)
  if (Capacitor.isNativePlatform()) {
    try {
      const { Share } = await import('@capacitor/share');
      const savedUri = await pdfFileEngine.savePdfToDevice(fileName, blob);
      await Share.share({
        title: fileName,
        text: `Documento adjunto: ${fileName}`,
        url: savedUri,
        dialogTitle: `Compartir ${fileName}`,
      });
      return;
    } catch (nativeShareErr: any) {
      if (nativeShareErr?.message?.includes('canceled') || nativeShareErr?.name === 'AbortError') {
        return;
      }
      console.warn('[shareFileSafely] Share nativo cancelado o falló, probando Web Share:', nativeShareErr);
    }
  }

  // 2. Web Share API (Chrome en Android, Safari en iOS/Mac, Edge en Windows)
  if (typeof navigator !== 'undefined') {
    const mimeType = blob.type || (fileName.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream');
    const file = new File([blob], fileName, { type: mimeType });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          title: fileName,
          text: `Documento: ${fileName}`,
          files: [file],
        });
        return;
      } catch (shareErr: any) {
        if (shareErr?.name === 'AbortError') {
          return;
        }
        console.warn('[shareFileSafely] navigator.share con archivos:', shareErr);
      }
    }

    if (navigator.share) {
      try {
        await navigator.share({
          title: fileName,
          text: `Documento: ${fileName}`,
        });
        return;
      } catch (shareErr: any) {
        if (shareErr?.name === 'AbortError') return;
      }
    }
  }

  // 3. Si no hay soporte de Web Share, descargar el archivo directamente
  await triggerFileDownload(blob, fileName);
};


