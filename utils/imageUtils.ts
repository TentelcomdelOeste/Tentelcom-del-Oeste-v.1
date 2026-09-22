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
  allCandidates: string[];
  fallbackCandidates: string[];
  hasImages: boolean;
}

export function getItemImageSet(item: {
  thumbnailUrls?: string[] | null;
  thumbnailUrl?: string | null;
  imageUrls?: string[] | null;
  imageUrl?: string | null;
  originalImageUrls?: string[] | null;
  originalImageUrl?: string | null;
  images?: string[] | null;
  photo?: string | null;
  photos?: string[] | null;
  photoUrl?: string | null;
  photoUrls?: string[] | null;
} | null | undefined): ItemImageSet {
  if (!item) {
    return {
      thumbnails: [],
      hdImages: [],
      originals: [],
      primaryThumb: '',
      primaryHD: '',
      galleryImages: [],
      allCandidates: [],
      fallbackCandidates: [],
      hasImages: false
    };
  }

  const extractUrls = (...fields: (string[] | string | null | undefined)[]): string[] => {
    const urls: string[] = [];
    const seen = new Set<string>();

    fields.forEach(field => {
      if (Array.isArray(field)) {
        field.forEach(u => {
          if (typeof u === 'string' && u.trim().length > 0 && !seen.has(u.trim())) {
            seen.add(u.trim());
            urls.push(u.trim());
          }
        });
      } else if (typeof field === 'string' && field.trim().length > 0 && !seen.has(field.trim())) {
        seen.add(field.trim());
        urls.push(field.trim());
      }
    });

    return urls;
  };

  const itemAny = item as Record<string, any>;
  const thumbnails = extractUrls(item.thumbnailUrls, item.thumbnailUrl);
  const hdImages = extractUrls(item.imageUrls, item.imageUrl, itemAny.images, itemAny.photoUrls, itemAny.photoUrl);
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

  // Si hdImages está vacío pero originals tiene imágenes, usar originals como hdImages
  if (hdImages.length === 0 && originals.length > 0) {
    originals.forEach(oUrl => {
      if (oUrl && !hdImages.includes(oUrl)) {
        hdImages.push(oUrl);
      }
    });
  }

  // Si thumbnails está vacío, usar hdImages o originals
  if (thumbnails.length === 0) {
    if (hdImages.length > 0) {
      thumbnails.push(...hdImages);
    } else if (originals.length > 0) {
      thumbnails.push(...originals);
    }
  }

  // Primary Thumb: prefer explicit thumbnail, fallback to HD image, then original
  const primaryThumb = thumbnails[0] || hdImages[0] || originals[0] || '';

  // Primary HD: prefer explicit HD image, fallback to original, then primary thumb
  const primaryHD = hdImages[0] || originals[0] || primaryThumb || '';

  // Gallery Images: set of all display images for zoom viewer
  const galleryImages = hdImages.length > 0 ? hdImages : (originals.length > 0 ? originals : thumbnails);

  // All candidate URLs in preferred order without duplicates
  const candidateSet = new Set<string>();
  [primaryThumb, primaryHD, ...thumbnails, ...hdImages, ...originals, ...galleryImages].forEach(u => {
    if (u && typeof u === 'string' && u.trim().length > 0) {
      candidateSet.add(u.trim());
    }
  });
  const allCandidates = Array.from(candidateSet);

  // Fallback candidates: all candidates excluding primaryThumb
  const fallbackCandidates = allCandidates.filter(u => u !== primaryThumb);

  const hasImages = allCandidates.length > 0;

  return {
    thumbnails,
    hdImages,
    originals,
    primaryThumb,
    primaryHD,
    galleryImages,
    allCandidates,
    fallbackCandidates,
    hasImages
  };
}
