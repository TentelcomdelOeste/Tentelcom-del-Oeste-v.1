import { storage } from "../firebase";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";

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
    const snapshot = await uploadBytes(storageRef, file);
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
