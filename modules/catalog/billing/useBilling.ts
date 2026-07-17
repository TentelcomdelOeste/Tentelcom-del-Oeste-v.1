import { useState, useEffect, useCallback } from 'react';
import { db, auth } from '@/firebase';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  deleteDoc, 
  doc,
  limit
} from 'firebase/firestore';
import { BillingInvoice, CreateInvoiceDTO } from './billing.types';
import { User } from '@/types';
import { guardedWrite } from '@/core/writeGuard';
import { useUserContext } from '@/contexts/UserContext';

export const useBilling = (currentUser: User | null) => {
  const { authReady } = useUserContext();
  const [invoices, setInvoices] = useState<BillingInvoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [currentLimit, setCurrentLimit] = useState(50);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // 1. Lectura en tiempo real
  useEffect(() => {
    if (!authReady || !currentUser || (!auth.currentUser && navigator.onLine)) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    // Nota: Ahora apuntamos a la colección 'invoices'
    const q = query(collection(db, "invoices"), orderBy("issueDate", "desc"), limit(currentLimit));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as BillingInvoice));
      
      setInvoices(list);
      setHasMore(snapshot.docs.length === currentLimit);
      setLoadingMore(false);
      setIsLoading(false);
    }, (err) => {
      console.error("Error fetching invoices:", err);
      setError("No se pudieron cargar las facturas.");
      setIsLoading(false);
      setLoadingMore(false);
    });

    return () => unsubscribe();
  }, [currentUser, currentLimit, authReady]);

  const loadMore = useCallback(() => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    setCurrentLimit(prev => prev + 50);
  }, [hasMore, loadingMore]);

  // 2. Creación de Factura (Lógica Financiera)
  const createInvoice = useCallback(async (data: CreateInvoiceDTO) => {
    if (!currentUser) throw new Error("No autenticado");
    // guardedWrite does offline check, but logic remains same

    try {
      const total = data.subtotal + data.taxAmount;
      let paid = 0;
      let status: any = 'PENDIENTE';

      // Lógica automática según modalidad
      if (data.mode === 'CONTADO') {
        paid = total;
        status = 'PAGADA';
      } else {
        // Crédito
        paid = 0;
        status = 'PENDIENTE';
      }

      const newInvoice: any = {
        ...data,
        totalAmount: total,
        paidAmount: paid,
        balance: total - paid,
        status: status,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: currentUser.id
      };

      await guardedWrite(() => addDoc(collection(db, "invoices"), newInvoice));
      return { success: true };
    } catch (err: any) {
      console.error("Error creating invoice:", err);
      throw new Error(err.message || "Error al crear la factura.");
    }
  }, [currentUser]);

  // 3. Anulación (Borrado Lógico o Físico según política)
  // En esta fase implementamos borrado físico para simplificar desarrollo, 
  // pero el modelo soporta estado 'CANCELADA' para futuro borrado lógico.
  const deleteInvoice = useCallback(async (id: string) => {
    if (!currentUser) throw new Error("No autenticado");
    await guardedWrite(() => deleteDoc(doc(db, "invoices", id)));
  }, [currentUser]);

  return {
    invoices,
    isLoading,
    error,
    createInvoice,
    deleteInvoice,
    hasMore,
    loadMore,
    loadingMore
  };
};
