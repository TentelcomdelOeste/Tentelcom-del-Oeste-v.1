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
 * Downloads the exact original image file from Firebase Storage or URL without processing,
 * converting, or resizing.
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

  // Handle base64 Data URLs directly
  if (originalUrl.startsWith('data:')) {
    try {
      const blob = dataURLtoBlob(originalUrl);
      let extension = 'jpg';
      if (blob.type.includes('png')) extension = 'png';
      else if (blob.type.includes('webp')) extension = 'webp';
      else if (blob.type.includes('jpeg') || blob.type.includes('jpg')) extension = 'jpg';

      const finalFileName = `${cleanCode}_original.${extension}`;
      await triggerFileDownload(blob, finalFileName);
      return { success: true };
    } catch (e: any) {
      console.error('Error procesando Data URL:', e);
    }
  }

  // Derive default extension from URL
  let urlExtension = 'jpg';
  const urlWithoutQuery = originalUrl.split('?')[0];
  const extMatch = urlWithoutQuery.match(/\.([a-zA-Z0-9]+)$/);
  if (extMatch && extMatch[1] && extMatch[1].length <= 5) {
    urlExtension = extMatch[1].toLowerCase();
  }

  // Attempt direct client-side fetch to download as blob
  try {
    const response = await fetch(originalUrl);
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }
    const blob = await response.blob();

    let extension = urlExtension;
    if (blob.type.includes('png')) extension = 'png';
    else if (blob.type.includes('webp')) extension = 'webp';
    else if (blob.type.includes('jpeg') || blob.type.includes('jpg')) extension = 'jpg';
    else if (blob.type.includes('pdf')) extension = 'pdf';

    const finalFileName = `${cleanCode}_original.${extension}`;
    await triggerFileDownload(blob, finalFileName);
    return { success: true };
  } catch (err: any) {
    console.warn('Fetch directo de la imagen falló por CORS/red, usando proxy de servidor:', err);
    
    // Fallback: Fetch via server proxy endpoint `/api/download-proxy`
    try {
      const defaultFileName = `${cleanCode}_original.${urlExtension}`;
      const proxyUrl = `/api/download-proxy?url=${encodeURIComponent(originalUrl)}&filename=${encodeURIComponent(defaultFileName)}`;
      const proxyResponse = await fetch(proxyUrl);
      if (!proxyResponse.ok) {
        throw new Error(`Proxy error ${proxyResponse.status}`);
      }
      const blob = await proxyResponse.blob();

      let extension = urlExtension;
      if (blob.type.includes('png')) extension = 'png';
      else if (blob.type.includes('webp')) extension = 'webp';
      else if (blob.type.includes('jpeg') || blob.type.includes('jpg')) extension = 'jpg';
      else if (blob.type.includes('pdf')) extension = 'pdf';

      const finalFileName = `${cleanCode}_original.${extension}`;
      await triggerFileDownload(blob, finalFileName);
      return { success: true };
    } catch (fallbackErr: any) {
      console.error('Error en descarga vía proxy:', fallbackErr);
      return {
        success: false,
        message: `No se pudo descargar la imagen original: ${fallbackErr?.message || err?.message || 'Error de descarga'}`
      };
    }
  }
}

