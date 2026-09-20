/**
 * Utility for client-side image optimization and thumbnail generation
 * using standard HTML5 Canvas APIs.
 */

export interface ProcessedImages {
  hdBlob: Blob;
  thumbBlob: Blob;
  mimeType: string;
  extension: string;
}

/**
 * Resizes an image on an HTML5 canvas while maintaining original aspect ratio.
 */
function resizeImageToBlob(
  img: HTMLImageElement,
  maxDimension: number,
  quality: number,
  preferredMimeType: string = 'image/webp'
): Promise<{ blob: Blob; mimeType: string }> {
  return new Promise((resolve, reject) => {
    let width = img.naturalWidth || img.width;
    let height = img.naturalHeight || img.height;

    if (width > maxDimension || height > maxDimension) {
      if (width >= height) {
        height = Math.round((height * maxDimension) / width);
        width = maxDimension;
      } else {
        width = Math.round((width * maxDimension) / height);
        height = maxDimension;
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, width);
    canvas.height = Math.max(1, height);

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(new Error('No se pudo obtener el contexto 2D del Canvas'));
      return;
    }

    // High quality smoothing settings
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    // Try exporting as WebP, fallback to JPEG if browser doesn't produce WebP
    canvas.toBlob(
      (blob) => {
        if (blob && blob.type.includes('webp')) {
          resolve({ blob, mimeType: 'image/webp' });
        } else if (blob) {
          resolve({ blob, mimeType: blob.type || preferredMimeType });
        } else {
          // Fallback to image/jpeg
          canvas.toBlob(
            (fallbackBlob) => {
              if (fallbackBlob) {
                resolve({ blob: fallbackBlob, mimeType: 'image/jpeg' });
              } else {
                reject(new Error('Error al generar Blob de imagen desde Canvas'));
              }
            },
            'image/jpeg',
            quality
          );
        }
      },
      preferredMimeType,
      quality
    );
  });
}

/**
 * Loads a File object asynchronously into an HTMLImageElement.
 */
function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Error al cargar la imagen seleccionada'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Error al leer el archivo de imagen'));
    reader.readAsDataURL(file);
  });
}

/**
 * Loads an image from a URL or data URL asynchronously into an HTMLImageElement.
 */
export function loadImageFromUrl(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    if (!url) {
      reject(new Error('URL de imagen vacía'));
      return;
    }

    if (url.startsWith('data:image/')) {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Error al cargar la imagen en formato base64'));
      img.src = url;
      return;
    }

    // Try fetch first to avoid canvas taint issues with CORS
    fetch(url, { mode: 'cors' })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        return res.blob();
      })
      .then(blob => {
        const objectUrl = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => {
          URL.revokeObjectURL(objectUrl);
          resolve(img);
        };
        img.onerror = () => {
          URL.revokeObjectURL(objectUrl);
          reject(new Error('Error al decodificar el Blob de la imagen'));
        };
        img.src = objectUrl;
      })
      .catch(() => {
        // Fallback to direct Image load
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Error al cargar la imagen por URL'));
        img.src = url;
      });
  });
}

/**
 * Processes an existing image URL / data URL:
 * Generates an optimized HD version and a Thumbnail version.
 */
export async function processImageUrlForStorage(imageUrl: string): Promise<ProcessedImages & { width: number; height: number }> {
  const img = await loadImageFromUrl(imageUrl);
  const width = img.naturalWidth || img.width;
  const height = img.naturalHeight || img.height;

  const hdResult = await resizeImageToBlob(img, 1200, 0.8, 'image/webp');
  const thumbResult = await resizeImageToBlob(img, 200, 0.75, 'image/webp');

  const mimeType = hdResult.mimeType.includes('webp') ? 'image/webp' : hdResult.mimeType;
  const extension = mimeType === 'image/webp' ? 'webp' : 'jpg';

  return {
    hdBlob: hdResult.blob,
    thumbBlob: thumbResult.blob,
    mimeType,
    extension,
    width,
    height
  };
}

/**
 * Processes a raw image File:
 * 1. Generates an optimized HD version (max 1200px, quality 80%)
 * 2. Generates a lightweight Thumbnail version (max 200px, quality 75-80%)
 */
export async function processImageForStorage(file: File): Promise<ProcessedImages> {
  const img = await loadImageFromFile(file);

  // Generate HD version (max 1200px, 80% quality)
  const hdResult = await resizeImageToBlob(img, 1200, 0.8, 'image/webp');

  // Generate Thumbnail version (max 200px, 75% quality)
  const thumbResult = await resizeImageToBlob(img, 200, 0.75, 'image/webp');

  const mimeType = hdResult.mimeType.includes('webp') ? 'image/webp' : hdResult.mimeType;
  const extension = mimeType === 'image/webp' ? 'webp' : 'jpg';

  return {
    hdBlob: hdResult.blob,
    thumbBlob: thumbResult.blob,
    mimeType,
    extension
  };
}
