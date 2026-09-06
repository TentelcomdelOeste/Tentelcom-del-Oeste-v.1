import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../../firebase';

export const getProjectJobs = async (projectId: string) => {
  try {
    const q = query(collection(db, 'trabajos'), where('projectId', '==', projectId));
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error("Error fetching project jobs:", error);
    return [];
  }
};

export const getProjectMaterialRequests = async (projectId: string) => {
  try {
    const q = query(collection(db, 'material_requests'), where('projectId', '==', projectId));
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error("Error fetching project material requests:", error);
    return [];
  }
};

export const getProjectInvoices = async (projectId: string) => {
  try {
    const q = query(collection(db, 'invoices'), where('projectId', '==', projectId));
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error("Error fetching project invoices:", error);
    return [];
  }
};

export const getProjectMovements = async (projectId: string) => {
  try {
    const q = query(collection(db, 'inventory_movements'), where('projectId', '==', projectId));
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error("Error fetching project movements:", error);
    return [];
  }
};

export const getProjectPurchases = async (projectId: string) => {
  try {
    const q = query(collection(db, 'purchases'), where('projectId', '==', projectId));
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error("Error fetching project purchases:", error);
    return [];
  }
};
