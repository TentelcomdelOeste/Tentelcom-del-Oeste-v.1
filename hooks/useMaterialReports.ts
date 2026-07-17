import { useState, useEffect, useCallback, useRef } from 'react';
import { db } from '../firebase';
import { collection, addDoc, query, orderBy, onSnapshot, Timestamp, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { User } from '../utils/types';
import { useUserContext } from '../contexts/UserContext';

export interface MaterialReport {
  id?: string;
  referenceId: string;
  type: string;
  project: {
    id: string;
    name: string;
    jobId?: string;
    otCode?: string;
  };
  date: string;
  user: string;
  items: {
    material: string;
    quantity: number;
    unit: string;
    observation: string;
    fromInventory: boolean;
  }[];
  createdAt: Timestamp;
  jobId?: string;
  otCode?: string;
  isFromJob?: boolean; // Nueva propiedad
}

import { logger } from '../utils/logger';

let cachedReports: MaterialReport[] | null = null;
let reportsListeners: ((reports: MaterialReport[], loading: boolean) => void)[] = [];
let globalLoading = true;

export const useMaterialReports = (currentUser: User | null) => {
  const { authReady } = useUserContext();
  const [reports, setReports] = useState<MaterialReport[]>(cachedReports || []);
  const [loading, setLoading] = useState(globalLoading);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!authReady || !currentUser) {
      setLoading(false);
      return;
    }

    const listener = (newReports: MaterialReport[], newLoading: boolean) => {
      setReports(newReports);
      setLoading(newLoading);
    };
    reportsListeners.push(listener);

    if (cachedReports) {
      listener(cachedReports, globalLoading);
    }

    if (!currentUser) return;
    
    const q = query(collection(db, 'material_reports_log'), orderBy('createdAt', 'desc'));
    const unsubscribeFirestore = onSnapshot(q, (snapshot) => {
      try {
        logger.log("Material reports loaded:", snapshot.size);
        const docs = snapshot.docs || [];
        const data = docs.map(doc => ({ ...doc.data(), id: doc.id } as MaterialReport));
        cachedReports = Array.isArray(data) ? data : [];
        globalLoading = false;
        reportsListeners.forEach(l => l(cachedReports!, globalLoading));
      } catch (innerError) {
        console.warn("Error procesando reportes de materiales (Offline fallback activado):", innerError);
        cachedReports = Array.isArray(cachedReports) ? cachedReports : [];
        globalLoading = false;
        reportsListeners.forEach(l => l(cachedReports!, globalLoading));
      }
    }, (error) => {
      console.warn("Error cargando reportes de materiales (Offline fallback activado):", error);
      globalLoading = false;
      cachedReports = Array.isArray(cachedReports) ? cachedReports : [];
      reportsListeners.forEach(l => l(cachedReports!, globalLoading));
    });
    
    unsubscribeRef.current = unsubscribeFirestore;

    return () => {
      reportsListeners = reportsListeners.filter(l => l !== listener);
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [currentUser, authReady]);

  const saveReport = useCallback(async (report: Omit<MaterialReport, 'createdAt' | 'user'>, id?: string) => {
    if (!currentUser) throw new Error('No user authenticated');
    
    if (!navigator.onLine) {
      const { enqueueAction } = await import('./useOfflineQueue');
      await enqueueAction({
        type: 'REGISTRO_MATERIAL',
        payload: {
          trabajoId: report.project?.jobId || report.jobId || '',
          report,
          userEmail: currentUser.email
        }
      });
      console.info('[Offline] Registro de material encolado');
      return;
    }

    if (id) {
      const reportRef = doc(db, 'material_reports_log', id);
      await updateDoc(reportRef, {
        ...report,
        updatedAt: Timestamp.now()
      });
    } else {
      await addDoc(collection(db, 'material_reports_log'), {
        ...report,
        user: currentUser.email,
        createdAt: Timestamp.now()
      });
    }
  }, [currentUser]);

  const deleteReport = useCallback(async (id: string) => {
    if (!currentUser) throw new Error('No user authenticated');
    const reportRef = doc(db, 'material_reports_log', id);
    await deleteDoc(reportRef);
  }, [currentUser]);

  return { reports, loading, saveReport, deleteReport };
};
