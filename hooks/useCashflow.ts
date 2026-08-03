import { useState, useEffect, useCallback } from 'react';
import { db, auth } from '../firebase';
import { 
  collection, 
  doc, 
  deleteDoc, 
  updateDoc,
  setDoc,
  query, 
  orderBy,
  QueryDocumentSnapshot,
  DocumentData,
  where,
  onSnapshot,
  limit
} from 'firebase/firestore';
import { CashflowEntry } from '../cashflowTypes';
import { User } from '../utils/types';
import { hasPermission } from '../utils/permissions';
import { fetchPage, PAGE_SIZE } from '../core/performance/firestorePagination';
import { useUserContext } from '../contexts/UserContext';
import { guardedWrite } from '../core/writeGuard';

import { logger } from '../utils/logger';

// Helper para asegurar que los datos siempre tengan el formato correcto
const sanitizeEntry = (data: any, id: string): CashflowEntry => {
  let dateStr = new Date().toISOString().split('T')[0];
  
  if (data.date) {
      if (typeof data.date === 'string') {
          dateStr = data.date;
      } else if (data.date.toDate && typeof data.date.toDate === 'function') {
          // Soporte para Timestamp de Firestore
          try {
              dateStr = data.date.toDate().toISOString().split('T')[0];
          } catch (e) {
              logger.error("Error converting timestamp", e);
          }
      }
  }

  return {
    id: id,
    date: dateStr,
    type: (data.type === 'Ingreso' || data.type === 'Egreso') ? data.type : 'Egreso',
    subtype: data.subtype || null,
    projectId: data.projectId || null,
    amount: typeof data.amount === 'number' ? data.amount : 0,
    currency: (data.currency === 'USD' || data.currency === 'CRC') ? data.currency : 'CRC',
    description: typeof data.description === 'string' ? data.description : 'Sin descripción',
    // CORRECCIÓN ROBUSTA: Permitir cualquier valor truthy como string, o undefined si es null/vacío
    invoice: (data.invoice !== null && data.invoice !== undefined && String(data.invoice).trim() !== '') ? String(data.invoice).trim() : undefined,
    createdBy: data.createdBy || 'system',
    createdAt: data.createdAt || new Date().toISOString(),
    fixedExpenseId: data.fixedExpenseId || undefined
  };
};

export const useCashflow = (currentUser: User | null, year?: string, month?: string) => {
  const { authReady } = useUserContext();
  const [entries, setEntries] = useState<CashflowEntry[]>([]);
  const [allEntries, setAllEntries] = useState<CashflowEntry[]>([]); // Para búsqueda en dataset completo
  const [closedMonths, setClosedMonths] = useState<Set<string>>(new Set()); 
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Estado de Paginación
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isClientPagination, setIsClientPagination] = useState(false);
  const [clientPage, setClientPage] = useState(1);

  // 1. Carga Inicial (No longer using loadData, we rely on onSnapshot for real-time updates)
  useEffect(() => {
    const canView = (authReady && currentUser?.uid && (
        currentUser.role === 'admin' || 
        hasPermission(currentUser, 'finanzas', 'movimientos') ||
        hasPermission(currentUser, 'finanzas', 'analisis')
    ));

    if (!canView || (!auth.currentUser && navigator.onLine)) {
      setIsLoading(false);
      return;
    }
    
    const cashflowCollectionName = "cashflow_entries";
    const baseRef = collection(db, cashflowCollectionName);
    let q;
    let startStr = '';
    let endStr = '';

    if (year && year !== 'all') {
        setIsClientPagination(true);
        setClientPage(1);
        
        if (month && month !== 'all') {
            startStr = `${year}-${month.padStart(2, '0')}-01`;
            const nextMonth = parseInt(month) === 12 ? 1 : parseInt(month) + 1;
            const nextYear = parseInt(month) === 12 ? parseInt(year) + 1 : parseInt(year);
            endStr = `${nextYear}-${nextMonth.toString().padStart(2, '0')}-01`;
        } else {
            startStr = `${year}-01-01`;
            endStr = `${parseInt(year) + 1}-01-01`;
        }

        q = query(
            baseRef,
            where("date", ">=", startStr),
            where("date", "<", endStr),
            orderBy("date", "desc")
        );
    } else {
        setIsClientPagination(false);
        q = query(baseRef, orderBy("date", "desc"), limit(PAGE_SIZE));
    }

    const unsubscribe = onSnapshot(q, (snapshot: any) => {
        try {
            // logger.log("Cashflow entries loaded:", snapshot.size);
            
            const docs = snapshot.docs || [];
            const items = docs.map((doc: any) => sanitizeEntry(doc.data(), doc.id));
            const safeItems = Array.isArray(items) ? items : [];
            
            if (year && year !== 'all') {
                setAllEntries(safeItems);
                setEntries(safeItems.slice(0, PAGE_SIZE));
                setHasMore(safeItems.length > PAGE_SIZE);
                setLastDoc(null);
            } else {
                setEntries(safeItems);
                const lastDocRef = docs[docs.length - 1];
                setLastDoc(lastDocRef || null);
                setHasMore(docs.length === PAGE_SIZE);
            }
            setIsLoading(false);
        } catch (innerError) {
            console.warn("Error procesando movimientos de caja (Offline fallback activado):", innerError);
            setIsLoading(false);
            setEntries(prev => Array.isArray(prev) ? prev : []);
        }
    }, (err: any) => {
        if (err.code === 'permission-denied') {
            logger.warn("Acceso restringido a movimientos financieros");
            setIsLoading(false);
            return;
        }
        console.warn("Error al obtener movimientos financieros (Offline fallback activado):", err);
        setError("No se pudieron cargar los datos.");
        setIsLoading(false);
        setEntries(prev => Array.isArray(prev) ? prev : []);
    });

    // 2. Escuchar Cierres (Mantenemos listener ligero para validación)
    const closingsQuery = query(collection(db, "monthly_closings"));
    const unsubClosings = onSnapshot(closingsQuery, (snapshot: any) => {
        const closedSet = new Set<string>();
        snapshot.docs.forEach((doc: any) => {
            closedSet.add(doc.id);
        });
        setClosedMonths(closedSet);
    });

    return () => {
       unsubscribe();
       unsubClosings();
    };
  }, [currentUser?.uid, currentUser?.role, year, month, authReady]);

  // Función para cargar más datos (Paginación)
  const loadMore = async () => {
    if (!hasMore || isLoadingMore) return;

    setIsLoadingMore(true);
    try {
      if (isClientPagination) {
          // Paginación Cliente
          const nextPage = clientPage + 1;
          const nextSlice = allEntries.slice(0, nextPage * PAGE_SIZE);
          setEntries(nextSlice);
          setClientPage(nextPage);
          setHasMore(allEntries.length > nextPage * PAGE_SIZE);
      } else {
          // Paginación Servidor (Original)
          if (!lastDoc) return;
          
          const baseQuery = query(collection(db, "cashflow_entries"), orderBy("date", "desc"));
          const result = await fetchPage<CashflowEntry>(baseQuery, lastDoc, PAGE_SIZE);
          
          const sanitizedItems = result.items.map(item => sanitizeEntry(item, item.id));
          
          setEntries(prev => [...prev, ...sanitizedItems]);
          setLastDoc(result.lastDoc);
          setHasMore(result.hasMore);
      }
    } catch (err) {
      console.error("Error al cargar más movimientos:", err);
    } finally {
      setIsLoadingMore(false);
    }
  };

  // Helper de validación
  const checkIsClosed = useCallback((dateStr: string) => {
      if (!dateStr) return false;
      const [year, month] = dateStr.split('-').map(Number);
      const key = `${year}-${month}`;
      if (closedMonths.has(key)) {
          throw new Error(`El mes ${month}/${year} está CERRADO. No se pueden realizar modificaciones.`);
      }
  }, [closedMonths]);

  const isDateClosed = useCallback((date: string) => {
      try {
          checkIsClosed(date);
          return false;
      } catch {
          return true;
      }
  }, [checkIsClosed]);

  const addCashflowEntry = async (entryData: Omit<CashflowEntry, 'id' | 'createdAt'>) => {
    // Note: guardedWrite checks for online status too, but we keep this check for immediate UI feedback if needed
    if (!currentUser) {
        console.error("Sin autenticación.");
        return;
    }
    
    try {
        checkIsClosed(entryData.date);
        
        // Sanitizar payload para evitar undefined
        const sanitizedData = { ...entryData } as any;
        
        // CORRECCIÓN CRÍTICA: Asegurar que invoice sea null si es undefined o vacío
        if (sanitizedData.invoice === undefined || sanitizedData.invoice === '') {
            sanitizedData.invoice = null;
        }

        Object.keys(sanitizedData).forEach(key => {
            if (sanitizedData[key] === undefined) {
                sanitizedData[key] = null;
            }
        });

        const newEntryPayload = {
          ...sanitizedData,
          createdBy: currentUser.id,
          createdAt: new Date().toISOString()
        };

        // Guarded Write
        const newDocRef = doc(collection(db, "cashflow_entries"));
        const writePromise = guardedWrite(() => setDoc(newDocRef, newEntryPayload));
        
        await writePromise;
        
        // Actualización Optimista Local (Manual porque quitamos onSnapshot)
        const newEntry = sanitizeEntry(newEntryPayload, newDocRef.id);
        setEntries(prev => [newEntry, ...prev].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
        
        if (isClientPagination) {
            setAllEntries(prev => [newEntry, ...prev].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
        }

    } catch (e: any) {
        console.error(e.message);
        throw e;
    }
  };

  const updateCashflowEntry = async (id: string, entryData: Partial<CashflowEntry>) => {
    if (!currentUser) {
        console.error("Sin autenticación.");
        return;
    }

    try {
        if (entryData.date) {
            checkIsClosed(entryData.date);
        }

        const currentEntry = entries.find(e => e.id === id);
        if (currentEntry) {
            checkIsClosed(currentEntry.date);
        }

        // Sanitizar payload para evitar undefined
        const sanitizedData = { ...entryData } as any;
        
        // CORRECCIÓN CRÍTICA: Si invoice está presente en el payload pero es undefined, forzar null
        if ('invoice' in sanitizedData && (sanitizedData.invoice === undefined || sanitizedData.invoice === '')) {
            sanitizedData.invoice = null;
        }

        Object.keys(sanitizedData).forEach(key => {
            if (sanitizedData[key] === undefined) {
                sanitizedData[key] = null;
            }
        });

        const entryRef = doc(db, "cashflow_entries", id);
        const writePromise = guardedWrite(() => updateDoc(entryRef, sanitizedData));
        await writePromise;

        // Actualización Optimista Local
        setEntries(prev => prev.map(e => e.id === id ? { ...e, ...sanitizedData } : e));
        
        if (isClientPagination) {
            setAllEntries(prev => prev.map(e => e.id === id ? { ...e, ...sanitizedData } : e));
        }

    } catch (e: any) {
        console.error(e.message);
        throw e;
    }
  };

  const deleteCashflowEntry = async (id: string) => {
    try {
        const currentEntry = entries.find(e => e.id === id);
        if (currentEntry) {
            checkIsClosed(currentEntry.date);
        }

        const writePromise = guardedWrite(() => deleteDoc(doc(db, "cashflow_entries", id)));
        await writePromise;

        // Actualización Optimista Local
        setEntries(prev => prev.filter(e => e.id !== id));
        
        if (isClientPagination) {
            setAllEntries(prev => prev.filter(e => e.id !== id));
        }

    } catch (e: any) {
        console.error(e.message);
        throw e;
    }
  };

  const refresh = useCallback(async () => {
    // No longer using loadData, we rely on onSnapshot for real-time updates
  }, []);

  return { 
      entries, 
      allEntries,
      isLoading, 
      isLoadingMore,
      hasMore,
      loadMore,
      clientPage,
      error, 
      addCashflowEntry, 
      updateCashflowEntry, 
      deleteCashflowEntry,
      isDateClosed,
      refresh // Expose refresh
  };
};