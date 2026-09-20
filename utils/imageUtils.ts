/**
 * Centralized utility for extracting, normalizing, and managing image sets
 * for inventory items and vehicle warehouse items.
 */

export interface ItemImageSet {
  thumbnails: string[];
  hdImages: string[];
  originals: string[];
  primaryThumb: string;
  primaryHD: string;
  galleryImages: string[];
  hasImages: boolean;
}

export function getItemImageSet(item: {
  thumbnailUrls?: string[] | null;
  thumbnailUrl?: string | null;
  imageUrls?: string[] | null;
  imageUrl?: string | null;
  originalImageUrls?: string[] | null;
  originalImageUrl?: string | null;
} | null | undefined): ItemImageSet {
  if (!item) {
    return {
      thumbnails: [],
      hdImages: [],
      originals: [],
      primaryThumb: '',
      primaryHD: '',
      galleryImages: [],
      hasImages: false
    };
  }

  const extractUrls = (arrayField?: string[] | null, singleField?: string | null): string[] => {
    const urls: string[] = [];
    if (Array.isArray(arrayField)) {
      arrayField.forEach(u => {
        if (typeof u === 'string' && u.trim().length > 0) {
          urls.push(u.trim());
        }
      });
    }
    if (urls.length === 0 && typeof singleField === 'string' && singleField.trim().length > 0) {
      urls.push(singleField.trim());
    }
    return urls;
  };

  const thumbnails = extractUrls(item.thumbnailUrls, item.thumbnailUrl);
  const hdImages = extractUrls(item.imageUrls, item.imageUrl);
  let originals = extractUrls(item.originalImageUrls, item.originalImageUrl);

  // REGLA PARA IMÁGENES HISTÓRICAS:
  // Si no existen referencias explícitas en originalImageUrls/originalImageUrl pero existen en imageUrls/imageUrl,
  // esas URLs apuntan al archivo histórico existente que originalmente se utilizaba para el material.
  if (originals.length === 0 && hdImages.length > 0) {
    originals = [...hdImages];
  } else if (originals.length < hdImages.length) {
    hdImages.forEach((hdUrl, idx) => {
      if (!originals[idx] || originals[idx].trim().length === 0) {
        originals[idx] = hdUrl;
      }
    });
  }

  // Primary Thumb: prefer explicit thumbnail, fallback to HD image
  const primaryThumb = thumbnails[0] || hdImages[0] || '';

  // Primary HD: prefer explicit HD image, fallback to primary thumb
  const primaryHD = hdImages[0] || primaryThumb || '';

  // Gallery Images: set of all display images for zoom viewer
  const galleryImages = hdImages.length > 0 ? hdImages : (thumbnails.length > 0 ? thumbnails : []);

  const hasImages = Boolean(primaryThumb || primaryHD || galleryImages.length > 0);

  return {
    thumbnails,
    hdImages,
    originals,
    primaryThumb,
    primaryHD,
    galleryImages,
    hasImages
  };
}
