import { collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
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

export const subscribeToProjectJobs = (projectId: string, callback: (data: any[]) => void) => {
  const q = query(collection(db, 'trabajos'), where('projectId', '==', projectId));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  }, (error) => {
    console.error("Error listening to project jobs:", error);
    callback([]);
  });
};

export const getProjectMaterialRequests = async (projectId: string) => {
  try {
    const q = query(collection(db, 'material_reports'), where('projectId', '==', projectId));
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error("Error fetching project material requests:", error);
    return [];
  }
};

export const subscribeToProjectMaterialRequests = (projectId: string, callback: (data: any[]) => void) => {
  const q = query(collection(db, 'material_reports'), where('projectId', '==', projectId));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  }, (error) => {
    console.error("Error listening to project material requests:", error);
    callback([]);
  });
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

export const subscribeToProjectInvoices = (projectId: string, callback: (data: any[]) => void) => {
  const q = query(collection(db, 'invoices'), where('projectId', '==', projectId));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  }, (error) => {
    console.error("Error listening to project invoices:", error);
    callback([]);
  });
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

export const subscribeToProjectMovements = (projectId: string, callback: (data: any[]) => void) => {
  const q = query(collection(db, 'inventory_movements'), where('projectId', '==', projectId));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  }, (error) => {
    console.error("Error listening to project movements:", error);
    callback([]);
  });
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

export const subscribeToProjectPurchases = (projectId: string, callback: (data: any[]) => void) => {
  const q = query(collection(db, 'purchases'), where('projectId', '==', projectId));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  }, (error) => {
    console.error("Error listening to project purchases:", error);
    callback([]);
  });
};
