import { storage } from "../firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { processImageUrlForStorage } from "./imageCompression";
import { InventoryItem } from "../inventoryTypes";

/**
 * Checks if an item has historical images that lack thumbnails.
 */
export function isHistoricalItem(item: InventoryItem | null | undefined): boolean {
  if (!item) return false;

  const hdImages = item.imageUrls && Array.isArray(item.imageUrls) && item.imageUrls.length > 0
    ? item.imageUrls.filter(Boolean)
    : (item.imageUrl ? [item.imageUrl] : []);

  if (hdImages.length === 0) return false;

  const thumbnails = item.thumbnailUrls && Array.isArray(item.thumbnailUrls) && item.thumbnailUrls.length > 0
    ? item.thumbnailUrls.filter(Boolean)
    : (item.thumbnailUrl ? [item.thumbnailUrl] : []);

  // Returns true if thumbnail count is less than image count
  return thumbnails.length < hdImages.length;
}

export interface OptimizationResult {
  updatedFields: Partial<InventoryItem>;
  success: boolean;
  wasAlreadyOptimized: boolean;
  error?: string;
}

/**
 * Safely processes historical images for a single item:
 * 1. Preserves original historical URLs in `originalImageUrl` / `originalImageUrls` (DO NOT delete or overwrite!).
 * 2. Generates a 200px WebP thumbnail and uploads it to Storage as a new file.
 * 3. If image is base64 or oversized (>1200px), generates a new HD WebP file and uploads as a separate file.
 * 4. Only returns updated fields if upload succeeded.
 */
export async function optimizeHistoricalItemImages(
  item: InventoryItem,
  folderPath: string = 'inventory'
): Promise<OptimizationResult> {
  if (!item) {
    return { updatedFields: {}, success: false, wasAlreadyOptimized: true, error: "Item nulo" };
  }

  const hdImages = item.imageUrls && Array.isArray(item.imageUrls) && item.imageUrls.length > 0
    ? item.imageUrls.filter(Boolean)
    : (item.imageUrl ? [item.imageUrl] : []);

  if (hdImages.length === 0) {
    return { updatedFields: {}, success: true, wasAlreadyOptimized: true };
  }

  const existingThumbnails = item.thumbnailUrls && Array.isArray(item.thumbnailUrls) && item.thumbnailUrls.length > 0
    ? [...item.thumbnailUrls]
    : (item.thumbnailUrl ? [item.thumbnailUrl] : []);

  const existingOriginals = item.originalImageUrls && Array.isArray(item.originalImageUrls) && item.originalImageUrls.length > 0
    ? [...item.originalImageUrls]
    : (item.originalImageUrl ? [item.originalImageUrl] : []);

  const finalOriginals: string[] = [];
  const finalHDImages: string[] = [];
  const finalThumbnails: string[] = [];

  let hasChanges = false;

  for (let i = 0; i < hdImages.length; i++) {
    const currentHDUrl = hdImages[i];
    // Preserve original URL intact
    const originalUrl = existingOriginals[i] || item.originalImageUrl || currentHDUrl;
    finalOriginals.push(originalUrl);

    const existingThumb = existingThumbnails[i];

    // If thumbnail already exists and is distinct from HD image, keep it
    if (existingThumb && existingThumb !== currentHDUrl) {
      finalThumbnails.push(existingThumb);
      finalHDImages.push(currentHDUrl);
      continue;
    }

    // Otherwise, generate thumbnail from currentHDUrl
    try {
      const timestamp = Date.now();
      const baseCode = (item.code || 'item').replace(/[^a-zA-Z0-9_-]/g, '_');
      
      const { hdBlob, thumbBlob, mimeType, extension, width, height } = await processImageUrlForStorage(currentHDUrl);

      // Upload thumbnail blob as a new separate file
      const thumbPath = `${folderPath}/thumb_legacy_${baseCode}-${timestamp}-${i}.${extension}`;
      const thumbRef = ref(storage, thumbPath);
      const thumbSnapshot = await uploadBytes(thumbRef, thumbBlob, {
        contentType: mimeType,
        cacheControl: 'public, max-age=31536000, immutable'
      });
      const newThumbUrl = await getDownloadURL(thumbSnapshot.ref);
      finalThumbnails.push(newThumbUrl);

      // If existing image is base64 or oversized (>1200px), upload new HD WebP file as separate file
      if (currentHDUrl.startsWith('data:image/') || width > 1200 || height > 1200) {
        const hdPath = `${folderPath}/optimized_legacy_${baseCode}-${timestamp}-${i}.${extension}`;
        const hdRef = ref(storage, hdPath);
        const hdSnapshot = await uploadBytes(hdRef, hdBlob, {
          contentType: mimeType,
          cacheControl: 'public, max-age=31536000, immutable'
        });
        const newHdUrl = await getDownloadURL(hdSnapshot.ref);
        finalHDImages.push(newHdUrl);
      } else {
        // Keep existing historical URL as HD URL
        finalHDImages.push(currentHDUrl);
      }

      hasChanges = true;
    } catch (err: any) {
      console.warn(`[FASE 3] No se pudo optimizar imagen histórica ${i} para ${item.code}:`, err?.message || err);
      // Fallback safe: keep historical URL without overwriting or destroying anything
      finalThumbnails.push(existingThumb || currentHDUrl);
      finalHDImages.push(currentHDUrl);
    }
  }

  if (!hasChanges) {
    return { updatedFields: {}, success: true, wasAlreadyOptimized: true };
  }

  const primaryOriginal = finalOriginals[0] || '';
  const primaryHD = finalHDImages[0] || '';
  const primaryThumb = finalThumbnails[0] || primaryHD;

  const updatedFields: Partial<InventoryItem> = {
    originalImageUrl: primaryOriginal,
    originalImageUrls: finalOriginals,
    imageUrl: primaryHD,
    imageUrls: finalHDImages,
    thumbnailUrl: primaryThumb,
    thumbnailUrls: finalThumbnails
  };

  return {
    updatedFields,
    success: true,
    wasAlreadyOptimized: false
  };
}
