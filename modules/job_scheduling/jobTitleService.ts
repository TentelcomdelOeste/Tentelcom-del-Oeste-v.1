import { db } from "../../firebase";
import { collection, addDoc, getDocs, query, where, serverTimestamp, Timestamp, updateDoc, doc } from "firebase/firestore";

const COLLECTION_NAME = "job_titles";

export interface JobTitle {
  id?: string;
  titulo: string;
  tituloNormalizado: string;
  frecuenciaUso: number;
  ultimaUtilizacion: Timestamp;
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export const getJobTitles = async (): Promise<JobTitle[]> => {
  const q = query(collection(db, COLLECTION_NAME), where("isActive", "==", true));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as JobTitle[];
};

export const createOrUpdateJobTitle = async (titulo: string) => {
  const tituloNormalizado = titulo.trim().toLowerCase();
  
  const q = query(collection(db, COLLECTION_NAME), where("tituloNormalizado", "==", tituloNormalizado));
  const querySnapshot = await getDocs(q);

  if (!querySnapshot.empty) {
    const docRef = doc(db, COLLECTION_NAME, querySnapshot.docs[0].id);
    await updateDoc(docRef, {
        frecuenciaUso: querySnapshot.docs[0].data().frecuenciaUso + 1,
        ultimaUtilizacion: serverTimestamp(),
        updatedAt: serverTimestamp(),
        isActive: true
    });
    return querySnapshot.docs[0].id;
  }

  return await addDoc(collection(db, COLLECTION_NAME), {
    titulo,
    tituloNormalizado,
    frecuenciaUso: 1,
    ultimaUtilizacion: serverTimestamp(),
    isActive: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
};

export const deactivateJobTitle = async (id: string) => {
    const docRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(docRef, { isActive: false, updatedAt: serverTimestamp() });
};
