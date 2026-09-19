import { storage } from "../firebase";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { processImageForStorage } from "./imageCompression";

export interface UploadResult {
  hdUrl: string;
  thumbnailUrl: string;
}

/**
 * Processes a raw image file into optimized HD (max 1200px) and Thumbnail (max 200px) WebP versions
 * and uploads both to Firebase Storage with Cache-Control headers.
 */
export const uploadProcessedImageToStorage = async (
  file: File,
  folderPath: string,
  baseFileName: string
): Promise<UploadResult> => {
  if (!file) throw new Error("No file provided");

  const timestamp = Date.now();
  const { hdBlob, thumbBlob, mimeType, extension } = await processImageForStorage(file);

  const hdStoragePath = `${folderPath}/original_${baseFileName}-${timestamp}.${extension}`;
  const thumbStoragePath = `${folderPath}/thumb_${baseFileName}-${timestamp}.${extension}`;

  const hdStorageRef = ref(storage, hdStoragePath);
  const thumbStorageRef = ref(storage, thumbStoragePath);

  const metadata = {
    contentType: mimeType,
    cacheControl: 'public, max-age=31536000, immutable'
  };

  try {
    const [hdSnapshot, thumbSnapshot] = await Promise.all([
      uploadBytes(hdStorageRef, hdBlob, metadata),
      uploadBytes(thumbStorageRef, thumbBlob, metadata)
    ]);

    const [hdUrl, thumbnailUrl] = await Promise.all([
      getDownloadURL(hdSnapshot.ref),
      getDownloadURL(thumbSnapshot.ref)
    ]);

    return { hdUrl, thumbnailUrl };
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
