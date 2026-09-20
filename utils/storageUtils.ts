import { storage } from "../firebase";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { processImageForStorage } from "./imageCompression";

export interface UploadResult {
  originalUrl: string;
  hdUrl: string;
  thumbnailUrl: string;
}

/**
 * Uploads:
 * 1. Raw intact original file selected by user
 * 2. Optimized HD version (max 1200px WebP 80%)
 * 3. Lightweight Thumbnail version (max 200px WebP 75%)
 * All to Firebase Storage with Cache-Control headers.
 */
export const uploadProcessedImageToStorage = async (
  file: File,
  folderPath: string,
  baseFileName: string
): Promise<UploadResult> => {
  if (!file) throw new Error("No file provided");

  const timestamp = Date.now();
  const rawExtension = file.name && file.name.includes('.') ? file.name.split('.').pop()! : 'jpg';
  
  // Generate optimized HD and Thumbnail Blobs
  const { hdBlob, thumbBlob, mimeType, extension } = await processImageForStorage(file);

  const originalStoragePath = `${folderPath}/original_${baseFileName}-${timestamp}.${rawExtension}`;
  const hdStoragePath = `${folderPath}/optimized_${baseFileName}-${timestamp}.${extension}`;
  const thumbStoragePath = `${folderPath}/thumb_${baseFileName}-${timestamp}.${extension}`;

  const originalStorageRef = ref(storage, originalStoragePath);
  const hdStorageRef = ref(storage, hdStoragePath);
  const thumbStorageRef = ref(storage, thumbStoragePath);

  const rawMetadata = {
    contentType: file.type || 'image/jpeg',
    cacheControl: 'public, max-age=31536000, immutable'
  };

  const processedMetadata = {
    contentType: mimeType,
    cacheControl: 'public, max-age=31536000, immutable'
  };

  try {
    const [origSnapshot, hdSnapshot, thumbSnapshot] = await Promise.all([
      uploadBytes(originalStorageRef, file, rawMetadata),
      uploadBytes(hdStorageRef, hdBlob, processedMetadata),
      uploadBytes(thumbStorageRef, thumbBlob, processedMetadata)
    ]);

    const [originalUrl, hdUrl, thumbnailUrl] = await Promise.all([
      getDownloadURL(origSnapshot.ref),
      getDownloadURL(hdSnapshot.ref),
      getDownloadURL(thumbSnapshot.ref)
    ]);

    return { originalUrl, hdUrl, thumbnailUrl };
  } catch (error) {
    console.error("Error uploading processed images to storage:", error);
    throw error;
  }
};

/**
 * Uploads an image to Firebase Storage and returns the download URL.
 */
export const uploadImageToStorage = async (
  file: File,
  folderPath: string,
  fileName: string
): Promise<string> => {
  if (!file) throw new Error("No file provided");
  
  // Create a unique filename to avoid browser caching issues when replacing
  const uniqueFileName = `${fileName}-${Date.now()}`;
  const storageRef = ref(storage, `${folderPath}/${uniqueFileName}`);
  
  try {
    const snapshot = await uploadBytes(storageRef, file, {
      cacheControl: 'public, max-age=31536000, immutable'
    });
    const downloadURL = await getDownloadURL(snapshot.ref);
    return downloadURL;
  } catch (error) {
    console.error("Error uploading image to storage:", error);
    throw error;
  }
};

/**
 * Deletes an image from Firebase Storage using its URL
 */
export const deleteImageFromStorage = async (imageUrl: string): Promise<void> => {
  if (!imageUrl || !imageUrl.startsWith('https://firebasestorage.googleapis.com')) {
    return; // Not a Firebase Storage URL (could be base64)
  }
  
  try {
    const storageRef = ref(storage, imageUrl);
    await deleteObject(storageRef);
  } catch (error) {
    console.error("Error deleting image from storage:", error);
  }
};
