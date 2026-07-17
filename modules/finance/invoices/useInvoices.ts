
import { useState, useEffect, useCallback } from 'react';
import { db, auth } from '../../../firebase';
import { 
  collection, 
  query, 
  orderBy, 
  limit, 
  onSnapshot
} from 'firebase/firestore';
import { InvoiceService } from './invoice.service';
import { Invoice } from './invoice.types';
import { User } from '@/utils/types';
import { useUserContext } from '@/contexts/UserContext';

import { logger } from '@/utils/logger';

export const useInvoices = (currentUser: User | null) => {
  const { authReady } = useUserContext();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination State
  const [currentLimit, setCurrentLimit] = useState(50);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore] = useState(false);

  useEffect(() => {
    if (!authReady || !currentUser || (!auth.currentUser && navigator.onLine)) {
      setInvoices([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    
    const isDevMode = window.self !== window.top;
    const baseRef = collection(db, "invoices");
    const q = isDevMode 
        ? baseRef 
        : query(baseRef, orderBy("issueDate", "desc"), limit(currentLimit));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
        try {
            logger.log("Invoices loaded:", snapshot.size);
            
            const docs = snapshot.docs || [];
            const list = docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as Invoice));
            
            const safeList = Array.isArray(list) ? list : [];
            setInvoices(safeList);
            setHasMore(docs.length === currentLimit);
            setIsLoading(false);
        } catch (innerError) {
            console.warn("Error procesando facturas (Offline fallback activado):", innerError);
            setInvoices(prev => Array.isArray(prev) ? prev : []);
            setIsLoading(false);
        }
    }, (err) => {
        console.warn("Error fetching invoices (Offline fallback activado):", err);
        setError("Error al cargar facturas.");
        setIsLoading(false);
        setInvoices(prev => Array.isArray(prev) ? prev : []);
    });
    
    return () => unsubscribe();
  }, [currentUser, currentLimit, authReady]);

  const loadMore = useCallback(() => {
     if (!hasMore || loadingMore) return;
     setCurrentLimit(prev => prev + 50);
  }, [hasMore, loadingMore]);

  const addInvoice = useCallback(async (invoiceData: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>) => {
    if (!currentUser) throw new Error("Usuario no autenticado");
    
    // Sanitización: Firestore rechaza undefined. Convertir explícitamente a null o asegurar valor.
    const sanitizedData = {
      ...invoiceData,
      dueDate: invoiceData.dueDate ?? null,
      projectId: invoiceData.projectId ?? null,
      projectName: invoiceData.projectName ?? null,
      notes: invoiceData.notes ?? null,
      // Optional fields that might be undefined in invoiceData need handling
      exchangeRate: invoiceData.exchangeRate ?? null,
      attachmentUrl: invoiceData.attachmentUrl ?? null,
      attachmentPath: invoiceData.attachmentPath ?? null
    };

    const newInvoice: Omit<Invoice, 'id'> = {
      ...sanitizedData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: currentUser.id
    };

    await InvoiceService.createInvoice(newInvoice);
  }, [currentUser]);

  const updateInvoice = useCallback(async (id: string, invoiceData: Partial<Invoice>) => {
    if (!currentUser) throw new Error("Usuario no autenticado");

    // Sanitización para actualización
    // If a partial update is sent with undefined, we should probably delete the key or set to null if we want to clear it.
    // Here we ensure no undefined values are passed to Firestore.
    const sanitizedData: any = { ...invoiceData };
    
    // List of optional fields in Invoice type
    const optionalFields = ['dueDate', 'projectId', 'projectName', 'notes', 'exchangeRate', 'attachmentUrl', 'attachmentPath'];
    
    optionalFields.forEach(field => {
        if (sanitizedData[field] === undefined) {
             // If explicitly undefined, we might want to ignore it (don't update) OR set to null (clear).
             // Standard behavior for update is usually "ignore undefined".
             delete sanitizedData[field];
        }
    });

    await InvoiceService.updateInvoice(id, sanitizedData);
  }, [currentUser]);

  const removeInvoice = useCallback(async (id: string, permanent: boolean = false) => {
    if (!currentUser) throw new Error("Usuario no autenticado");
    if (permanent) {
      await InvoiceService.permanentlyDeleteInvoice(id);
    } else {
      await InvoiceService.deleteInvoice(id);
    }
  }, [currentUser]);

  return {
    invoices,
    isLoading,
    error,
    addInvoice,
    updateInvoice,
    removeInvoice,
    loadMore,
    hasMore,
    loadingMore,
    loading: isLoading
  };
};
