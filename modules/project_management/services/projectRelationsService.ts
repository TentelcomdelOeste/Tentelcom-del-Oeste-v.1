import { collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from '../../../firebase';

// Helper to build queries supporting both Firestore doc ID and visible projectNumber
const getProjectIds = (projectId: string, projectNumber?: string): string[] => {
  const ids = [projectId];
  if (projectNumber && projectNumber.trim() && projectNumber.trim() !== projectId) {
    ids.push(projectNumber.trim());
  }
  return ids;
};

export const getProjectJobs = async (projectId: string, projectNumber?: string) => {
  try {
    const ids = getProjectIds(projectId, projectNumber);
    const q = ids.length > 1
      ? query(collection(db, 'trabajos'), where('projectId', 'in', ids))
      : query(collection(db, 'trabajos'), where('projectId', '==', projectId));
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error("Error fetching project jobs:", error);
    return [];
  }
};

export const subscribeToProjectJobs = (
  projectId: string, 
  callback: (data: any[]) => void,
  projectNumber?: string
) => {
  const ids = getProjectIds(projectId, projectNumber);
  const q = ids.length > 1
    ? query(collection(db, 'trabajos'), where('projectId', 'in', ids))
    : query(collection(db, 'trabajos'), where('projectId', '==', projectId));

  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  }, (error) => {
    console.error("Error listening to project jobs:", error);
    callback([]);
  });
};

export const getProjectMaterialRequests = async (projectId: string, projectNumber?: string) => {
  try {
    const ids = getProjectIds(projectId, projectNumber);
    
    // Fetch material_reports
    const qReports = ids.length > 1
      ? query(collection(db, 'material_reports'), where('projectId', 'in', ids))
      : query(collection(db, 'material_reports'), where('projectId', '==', projectId));
    const snapReports = await getDocs(qReports);
    const reportsList = snapReports.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Fetch vehicle_material_requests
    const qVehicle = ids.length > 1
      ? query(collection(db, 'vehicle_material_requests'), where('projectId', 'in', ids))
      : query(collection(db, 'vehicle_material_requests'), where('projectId', '==', projectId));
    const snapVehicle = await getDocs(qVehicle);
    const vehicleList = snapVehicle.docs.map(doc => {
      const v = doc.data() as any;
      return {
        id: doc.id,
        requestNumber: v.requestNumber || doc.id,
        origin: 'Bodega Vehicular',
        date: v.openedAt ? v.openedAt.substring(0, 10) : (v.createdAt ? v.createdAt.substring(0, 10) : ''),
        requestedByName: v.responsibleName || v.createdBy || 'Responsable',
        items: v.items || [],
        status: v.status || 'Abierta',
        vehiculoAlias: v.vehiculoAlias,
        vehiculoPlaca: v.vehiculoPlaca,
        isVehicleRequest: true,
        ...v
      };
    });

    // Merge without duplicates
    const seenIds = new Set<string>();
    const seenNumbers = new Set<string>();
    const combined: any[] = [];

    for (const item of reportsList) {
      if (item.id) seenIds.add(item.id);
      if (item.requestNumber) seenNumbers.add(item.requestNumber);
      combined.push(item);
    }

    for (const item of vehicleList) {
      if (item.id && seenIds.has(item.id)) continue;
      if (item.requestNumber && seenNumbers.has(item.requestNumber)) continue;
      if (item.id) seenIds.add(item.id);
      if (item.requestNumber) seenNumbers.add(item.requestNumber);
      combined.push(item);
    }

    return combined;
  } catch (error) {
    console.error("Error fetching project material requests:", error);
    return [];
  }
};

export const subscribeToProjectMaterialRequests = (
  projectId: string, 
  callback: (data: any[]) => void,
  projectNumber?: string
) => {
  const ids = getProjectIds(projectId, projectNumber);

  const qReports = ids.length > 1
    ? query(collection(db, 'material_reports'), where('projectId', 'in', ids))
    : query(collection(db, 'material_reports'), where('projectId', '==', projectId));

  const qVehicle = ids.length > 1
    ? query(collection(db, 'vehicle_material_requests'), where('projectId', 'in', ids))
    : query(collection(db, 'vehicle_material_requests'), where('projectId', '==', projectId));

  let reportsData: any[] = [];
  let vehicleData: any[] = [];

  const mergeAndNotify = () => {
    const normalizedVehicle = vehicleData.map(v => ({
      id: v.id,
      requestNumber: v.requestNumber || v.id,
      origin: 'Bodega Vehicular',
      date: v.openedAt ? v.openedAt.substring(0, 10) : (v.createdAt ? v.createdAt.substring(0, 10) : ''),
      requestedByName: v.responsibleName || v.createdBy || 'Responsable',
      items: v.items || [],
      status: v.status || 'Abierta',
      vehiculoAlias: v.vehiculoAlias,
      vehiculoPlaca: v.vehiculoPlaca,
      isVehicleRequest: true,
      ...v
    }));

    const seenIds = new Set<string>();
    const seenNumbers = new Set<string>();
    const combined: any[] = [];

    for (const item of reportsData) {
      if (item.id) seenIds.add(item.id);
      if (item.requestNumber) seenNumbers.add(item.requestNumber);
      combined.push(item);
    }

    for (const item of normalizedVehicle) {
      if (item.id && seenIds.has(item.id)) continue;
      if (item.requestNumber && seenNumbers.has(item.requestNumber)) continue;
      if (item.id) seenIds.add(item.id);
      if (item.requestNumber) seenNumbers.add(item.requestNumber);
      combined.push(item);
    }

    callback(combined);
  };

  const unsubReports = onSnapshot(qReports, (snap) => {
    reportsData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    mergeAndNotify();
  }, (error) => {
    console.error("Error listening to project material reports:", error);
    reportsData = [];
    mergeAndNotify();
  });

  const unsubVehicle = onSnapshot(qVehicle, (snap) => {
    vehicleData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    mergeAndNotify();
  }, (error) => {
    console.error("Error listening to vehicle_material_requests:", error);
    vehicleData = [];
    mergeAndNotify();
  });

  return () => {
    unsubReports();
    unsubVehicle();
  };
};

export const getProjectVehicleRequests = async (projectId: string, projectNumber?: string) => {
  try {
    const ids = getProjectIds(projectId, projectNumber);
    const q = ids.length > 1
      ? query(collection(db, 'vehicle_material_requests'), where('projectId', 'in', ids))
      : query(collection(db, 'vehicle_material_requests'), where('projectId', '==', projectId));
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error("Error fetching project vehicle requests:", error);
    return [];
  }
};

export const subscribeToProjectVehicleRequests = (
  projectId: string,
  callback: (data: any[]) => void,
  projectNumber?: string
) => {
  const ids = getProjectIds(projectId, projectNumber);
  const q = ids.length > 1
    ? query(collection(db, 'vehicle_material_requests'), where('projectId', 'in', ids))
    : query(collection(db, 'vehicle_material_requests'), where('projectId', '==', projectId));

  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  }, (error) => {
    console.error("Error listening to vehicle_material_requests:", error);
    callback([]);
  });
};

export const getProjectVehicleConsumptions = async (projectId: string, projectNumber?: string) => {
  try {
    const ids = getProjectIds(projectId, projectNumber);
    const q = ids.length > 1
      ? query(collection(db, 'vehicle_consumptions'), where('projectId', 'in', ids))
      : query(collection(db, 'vehicle_consumptions'), where('projectId', '==', projectId));
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error("Error fetching project vehicle consumptions:", error);
    return [];
  }
};

export const subscribeToProjectVehicleConsumptions = (
  projectId: string,
  callback: (data: any[]) => void,
  projectNumber?: string
) => {
  const ids = getProjectIds(projectId, projectNumber);
  const q = ids.length > 1
    ? query(collection(db, 'vehicle_consumptions'), where('projectId', 'in', ids))
    : query(collection(db, 'vehicle_consumptions'), where('projectId', '==', projectId));

  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  }, (error) => {
    console.error("Error listening to vehicle_consumptions:", error);
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
