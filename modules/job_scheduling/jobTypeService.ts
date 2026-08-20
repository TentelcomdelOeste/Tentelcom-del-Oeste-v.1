import { db } from "../../firebase";
import { collection, addDoc, getDocs, query, where, serverTimestamp, Timestamp, updateDoc, doc, deleteDoc, limit } from "firebase/firestore";

const COLLECTION_NAME = "job_types";

export interface JobType {
  id?: string;
  name: string;
  creado_en: Timestamp;
  isActive?: boolean;
  frecuenciaUso?: number;
  ultimaUtilizacion?: Timestamp;
}

export const getJobTypes = async (): Promise<JobType[]> => {
  const q = query(collection(db, COLLECTION_NAME), where("isActive", "==", true));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    name: doc.data().name,
    creado_en: doc.data().creado_en,
    isActive: doc.data().isActive ?? true,
    frecuenciaUso: doc.data().frecuenciaUso || 0,
    ultimaUtilizacion: doc.data().ultimaUtilizacion
  }));
};

export const createJobType = async (name: string) => {
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("Timeout creando tipo de trabajo")), 4000)
  );

  const actionPromise = (async () => {
    const nameTrimmed = name.trim();
    const nameNormalizado = nameTrimmed.toLowerCase();
    
    // Check if case-insensitive match exists
    const qAll = query(collection(db, COLLECTION_NAME));
    const snapshot = await getDocs(qAll);
    const existingDoc = snapshot.docs.find(doc => doc.data().name.trim().toLowerCase() === nameNormalizado);
    
    if (existingDoc) {
      const docRef = doc(db, COLLECTION_NAME, existingDoc.id);
      await updateDoc(docRef, { isActive: true });
      return existingDoc.id;
    }

    const docRef = await addDoc(collection(db, COLLECTION_NAME), {
      name: nameTrimmed,
      creado_en: serverTimestamp(),
      isActive: true,
      frecuenciaUso: 0,
      ultimaUtilizacion: serverTimestamp()
    });
    return docRef.id;
  })();

  return await Promise.race([actionPromise, timeoutPromise]);
};

export const createOrUpdateJobType = async (name: string) => {
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("Timeout actualizando catálogo de tipos de trabajo")), 4000)
  );

  const actionPromise = (async () => {
    const nameTrimmed = name.trim();
    const nameNormalizado = nameTrimmed.toLowerCase();
    
    const qAll = query(collection(db, COLLECTION_NAME));
    const snapshot = await getDocs(qAll);
    const existingDoc = snapshot.docs.find(doc => doc.data().name.trim().toLowerCase() === nameNormalizado);

    if (existingDoc) {
      const docRef = doc(db, COLLECTION_NAME, existingDoc.id);
      await updateDoc(docRef, {
        frecuenciaUso: (existingDoc.data().frecuenciaUso || 0) + 1,
        ultimaUtilizacion: serverTimestamp(),
        isActive: true
      });
      return existingDoc.id;
    }

    const docRef = await addDoc(collection(db, COLLECTION_NAME), {
      name: nameTrimmed,
      creado_en: serverTimestamp(),
      isActive: true,
      frecuenciaUso: 1,
      ultimaUtilizacion: serverTimestamp()
    });
    return docRef.id;
  })();

  return await Promise.race([actionPromise, timeoutPromise]);
};

export const updateJobType = async (id: string, name: string) => {
  const docRef = doc(db, COLLECTION_NAME, id);
  await updateDoc(docRef, { name: name.trim() });
};

export const deactivateJobType = async (id: string) => {
  const docRef = doc(db, COLLECTION_NAME, id);
  await updateDoc(docRef, { isActive: false });
};

export const deleteJobType = async (id: string) => {
  const docRef = doc(db, COLLECTION_NAME, id);
  await deleteDoc(docRef);
};

export const checkIfJobTypeUsed = async (name: string): Promise<boolean> => {
  const q = query(collection(db, "trabajos"), where("tipo_trabajo", "==", name.trim()), limit(1));
  const snapshot = await getDocs(q);
  return !snapshot.empty;
};
