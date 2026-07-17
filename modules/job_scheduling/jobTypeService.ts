import { db } from "../../firebase";
import { collection, addDoc, getDocs, query, where, serverTimestamp, Timestamp, updateDoc, doc } from "firebase/firestore";

const COLLECTION_NAME = "job_types";

export interface JobType {
  id?: string;
  name: string;
  creado_en: Timestamp;
  isActive?: boolean;
}

export const getJobTypes = async (): Promise<JobType[]> => {
  const q = query(collection(db, COLLECTION_NAME), where("isActive", "==", true));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    name: doc.data().name,
    creado_en: doc.data().creado_en,
    isActive: doc.data().isActive ?? true
  }));
};

export const createJobType = async (name: string) => {
  // Check if exists
  const q = query(collection(db, COLLECTION_NAME), where("name", "==", name));
  const querySnapshot = await getDocs(q);
  
  if (!querySnapshot.empty) {
    return null; // Already exists
  }

  return await addDoc(collection(db, COLLECTION_NAME), {
    name,
    creado_en: serverTimestamp(),
    isActive: true,
  });
};

export const deactivateJobType = async (id: string) => {
    const docRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(docRef, { isActive: false });
};
