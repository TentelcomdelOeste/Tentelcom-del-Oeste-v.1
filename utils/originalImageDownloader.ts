import { triggerFileDownload } from './fileUtils';

function dataURLtoBlob(dataurl: string): Blob {
  const arr = dataurl.split(',');
  const mimeMatch = arr[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}

/**
 * Inspects a Blob's headers, MIME type, and magic bytes to guarantee it is a valid image,
 * rejecting any HTML, script, plain text, or JSON payload.
 */
async function inspectAndValidateImageBlob(
  blob: Blob,
  fallbackExt: string = 'jpg'
): Promise<{ valid: boolean; normalizedBlob: Blob; extension: string }> {
  if (!blob || blob.size === 0) {
    return { valid: false, normalizedBlob: blob, extension: '' };
  }

  const rawMime = (blob.type || '').toLowerCase();

  // Instant rejection of web documents / HTML / scripts / JSON
  if (
    rawMime.startsWith('text/') ||
    rawMime.includes('html') ||
    rawMime.includes('javascript') ||
    rawMime.includes('json') ||
    (rawMime.includes('xml') && !rawMime.includes('svg'))
  ) {
    return { valid: false, normalizedBlob: blob, extension: '' };
  }

  // Inspect binary header bytes (magic numbers)
  try {
    const headerSlice = blob.slice(0, 16);
    const buffer = await headerSlice.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    if (bytes.length >= 3) {
      // Rejection of HTML tags or JSON structures at raw byte level
      const firstChar = String.fromCharCode(bytes[0]);
      if (firstChar === '<' || firstChar === '{') {
        return { valid: false, normalizedBlob: blob, extension: '' };
      }

      // JPEG: FF D8 FF
      if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
        const normalizedBlob = rawMime === 'image/jpeg' || rawMime === 'image/jpg'
          ? blob
          : new Blob([blob], { type: 'image/jpeg' });
        return { valid: true, normalizedBlob, extension: 'jpg' };
      }

      // PNG: 89 50 4E 47 (0x89 'P' 'N' 'G')
      if (bytes.length >= 4 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
        const normalizedBlob = rawMime === 'image/png'
          ? blob
          : new Blob([blob], { type: 'image/png' });
        return { valid: true, normalizedBlob, extension: 'png' };
      }

      // WebP: RIFF .... WEBP
      if (
        bytes.length >= 12 &&
        bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
        bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
      ) {
        const normalizedBlob = rawMime === 'image/webp'
          ? blob
          : new Blob([blob], { type: 'image/webp' });
        return { valid: true, normalizedBlob, extension: 'webp' };
      }

      // GIF: 47 49 46 38 ('G' 'I' 'F' '8')
      if (bytes.length >= 4 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) {
        const normalizedBlob = rawMime === 'image/gif'
          ? blob
          : new Blob([blob], { type: 'image/gif' });
        return { valid: true, normalizedBlob, extension: 'gif' };
      }
    }
  } catch (err) {
    console.warn('No se pudieron leer los magic bytes del archivo:', err);
  }

  // If MIME type explicitly starts with image/ and is not on the reject list
  if (rawMime.startsWith('image/')) {
    let ext = fallbackExt;
    if (rawMime.includes('jpeg') || rawMime.includes('jpg')) ext = 'jpg';
    else if (rawMime.includes('png')) ext = 'png';
    else if (rawMime.includes('webp')) ext = 'webp';
    else if (rawMime.includes('gif')) ext = 'gif';
    else if (rawMime.includes('svg')) ext = 'svg';
    else if (rawMime.includes('avif')) ext = 'avif';
    else if (rawMime.includes('bmp')) ext = 'bmp';
    return { valid: true, normalizedBlob: blob, extension: ext };
  }

  return { valid: false, normalizedBlob: blob, extension: '' };
}

/**
 * Downloads the exact original image file from Firebase Storage via server proxy / Netlify Function
 * without processing, converting, or resizing. Validates that the returned payload is a genuine image
 * before saving to disk.
 */
export async function downloadOriginalImage(
  originalUrl?: string | null,
  fileNamePrefix: string = 'imagen-original'
): Promise<{ success: boolean; message?: string }> {
  if (!originalUrl || originalUrl.trim() === '') {
    return {
      success: false,
      message: 'Esta imagen no tiene un archivo original disponible.'
    };
  }

  const cleanCode = fileNamePrefix.replace(/[^a-zA-Z0-9_-]/g, '_');

  // 1. Handle base64 Data URLs directly on client
  if (originalUrl.startsWith('data:')) {
    try {
      const blob = dataURLtoBlob(originalUrl);
      const validation = await inspectAndValidateImageBlob(blob);
      if (!validation.valid) {
        console.error('Data URL no contiene una imagen válida:', { type: blob.type, size: blob.size });
        return {
          success: false,
          message: 'El archivo de imagen no es válido o está dañado.'
        };
      }

      const finalFileName = `${cleanCode}_original.${validation.extension}`;
      await triggerFileDownload(validation.normalizedBlob, finalFileName);
      return { success: true };
    } catch (e: any) {
      console.error('Error procesando Data URL:', e);
      return {
        success: false,
        message: 'Ocurrió un error al procesar la imagen local.'
      };
    }
  }

  // 2. Derive fallback extension from URL if available
  let urlExtension = 'jpg';
  const urlWithoutQuery = originalUrl.split('?')[0];
  const extMatch = urlWithoutQuery.match(/\.([a-zA-Z0-9]+)$/);
  if (extMatch && extMatch[1] && extMatch[1].length <= 5) {
    const ext = extMatch[1].toLowerCase();
    if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'avif', 'bmp', 'heic'].includes(ext)) {
      urlExtension = ext === 'jpeg' ? 'jpg' : ext;
    }
  }

  const defaultFileName = `${cleanCode}_original.${urlExtension}`;

  // 3. Download via server proxy / Netlify Function to avoid CORS blocks on PWA & Android
  const candidateProxyEndpoints = [
    `/api/download-proxy?url=${encodeURIComponent(originalUrl)}&filename=${encodeURIComponent(defaultFileName)}`,
    `/.netlify/functions/download-proxy?url=${encodeURIComponent(originalUrl)}&filename=${encodeURIComponent(defaultFileName)}`
  ];

  let lastErrorMsg = '';

  for (const proxyUrl of candidateProxyEndpoints) {
    try {
      const response = await fetch(proxyUrl);
      if (!response.ok) {
        if (response.status === 403) {
          const errJson = await response.json().catch(() => null);
          throw new Error(errJson?.error || 'Descarga no autorizada para este dominio de almacenamiento.');
        }
        if (response.status === 404) {
          // Endpoint not found on this path, try next candidate
          continue;
        }
        throw new Error(`Error en el servidor de descarga (${response.status})`);
      }

      const responseContentType = (response.headers.get('content-type') || '').toLowerCase();
      if (
        responseContentType.startsWith('text/') ||
        responseContentType.includes('html') ||
        responseContentType.includes('json')
      ) {
        // If server returned HTML (SPA fallback), skip and try direct/fallback
        continue;
      }

      const rawBlob = await response.blob();
      const validation = await inspectAndValidateImageBlob(rawBlob, urlExtension);

      if (!validation.valid) {
        console.error('[originalImageDownloader] Respuesta del proxy no es una imagen válida:', {
          mime: rawBlob.type,
          size: rawBlob.size
        });
        continue;
      }

      const finalFileName = `${cleanCode}_original.${validation.extension}`;
      await triggerFileDownload(validation.normalizedBlob, finalFileName);
      return { success: true };
    } catch (proxyErr: any) {
      lastErrorMsg = proxyErr?.message || '';
      console.warn(`[originalImageDownloader] Falló intento en ${proxyUrl}:`, proxyErr);
    }
  }

  // 4. Fallback: Direct fetch (in case proxy is unreachable but direct CORS works)
  try {
    const response = await fetch(originalUrl);
    if (response.ok) {
      const responseContentType = (response.headers.get('content-type') || '').toLowerCase();
      if (
        !responseContentType.startsWith('text/') &&
        !responseContentType.includes('html') &&
        !responseContentType.includes('json')
      ) {
        const rawBlob = await response.blob();
        const validation = await inspectAndValidateImageBlob(rawBlob, urlExtension);
        if (validation.valid) {
          const finalFileName = `${cleanCode}_original.${validation.extension}`;
          await triggerFileDownload(validation.normalizedBlob, finalFileName);
          return { success: true };
        }
      }
    }
  } catch (directErr: any) {
    console.warn('[originalImageDownloader] Falló fetch directo:', directErr);
  }

  // If we reach here, download could not be completed safely
  console.error('[originalImageDownloader] No se pudo obtener la imagen original de forma segura.');
  return {
    success: false,
    message: lastErrorMsg || 'No se pudo descargar la imagen original. Verifique su conexión a internet.'
  };
}


