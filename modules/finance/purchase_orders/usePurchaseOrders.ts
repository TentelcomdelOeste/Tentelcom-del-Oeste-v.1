
import { useState, useEffect, useMemo, useCallback } from 'react';
import { db, auth } from '../../../firebase';
import { 
  collection, 
  query, 
  orderBy, 
  limit, 
  onSnapshot
} from 'firebase/firestore';
import { PurchaseOrderService } from './service'; // FIX: Removed .ts extension
import { PurchaseOrder, POApplication, PurchaseOrderCalculated } from './types';
import { User } from '@/utils/types';
import { useUserContext } from '@/contexts/UserContext';

export const usePurchaseOrders = (currentUser: User | null) => {
  const { authReady } = useUserContext();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [applications, setApplications] = useState<POApplication[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Pagination State
  const [currentLimit, setCurrentLimit] = useState(50);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    if (!authReady || !currentUser || (!auth.currentUser && navigator.onLine)) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    
    // 1. Subscribe to orders (paginated)
    const isDevMode = window.self !== window.top;
    const baseRef = collection(db, "purchase_orders");
    const q = isDevMode 
        ? baseRef 
        : query(baseRef, orderBy("issueDate", "desc"), limit(currentLimit));
    
    const unsubOrders = onSnapshot(q, (snapshot) => {
        const _rawData = snapshot.docs.map(doc => doc.data());
        
        const list = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as PurchaseOrder));
        
        setOrders(list);
        setHasMore(snapshot.docs.length === currentLimit);
        setLoadingMore(false);
        setIsLoading(false);
    }, (err) => {
        console.error("Error fetching orders:", err);
        setIsLoading(false);
        setLoadingMore(false);
    });

    // 2. Subscribe to applications (keep existing logic for now)
    const unsubApps = PurchaseOrderService.subscribeToApplications((apps) => {
      setApplications(apps);
    });

    return () => {
      unsubOrders();
      unsubApps();
    };
  }, [currentUser, currentLimit, authReady]);

  const loadMore = useCallback(() => {
     if (!hasMore || loadingMore) return;
     setLoadingMore(true);
     setCurrentLimit(prev => prev + 50);
  }, [hasMore, loadingMore]);

  // Filtrar aplicaciones que NO estén eliminadas físicamente ('deleted').
  // Esto incluye 'active' y 'voided' (para visualización histórica).
  const visibleApplications = useMemo(() => {
    const isDevMode = window.self !== window.top;
    if (isDevMode) return applications;
    return applications.filter(app => app.status !== 'deleted');
  }, [applications]);

  // Cálculo de saldos en tiempo real
  const calculatedOrders: PurchaseOrderCalculated[] = useMemo(() => {
    return orders.map(order => {
      const orderApps = visibleApplications.filter(app => app.purchaseOrderId === order.id);
      
      // SUMA CONDICIONAL: Solo sumar si el estado es explícitamente 'active' O si no tiene estado (legacy).
      // Las 'voided' (facturas anuladas) y 'deleted' no suman al usado.
      const usedAmount = orderApps.reduce((sum, app) => {
          const isActive = app.status === 'active' || !app.status; // Compatibilidad con legacy
          return sum + (isActive ? app.appliedAmount : 0);
      }, 0);
      
      return {
        ...order,
        usedAmount,
        availableBalance: order.totalAmount - usedAmount
      };
    });
  }, [orders, visibleApplications]);

  // Operaciones
  const createOrder = useCallback(async (data: Omit<PurchaseOrder, 'id' | 'createdAt' | 'createdBy'>) => {
    if (!currentUser) return;
    await PurchaseOrderService.createOrder({
      ...data,
      createdAt: new Date().toISOString(),
      createdBy: currentUser.id
    });
  }, [currentUser]);

  const updateOrder = useCallback(async (id: string, data: Partial<PurchaseOrder>) => {
    await PurchaseOrderService.updateOrder(id, data);
  }, []);

  const deleteOrder = useCallback(async (id: string) => {
    // Validar integridad solo con aplicaciones activas
    const hasActiveApps = visibleApplications.some(a => a.purchaseOrderId === id && (a.status === 'active' || !a.status));
    if (hasActiveApps) throw new Error("No se puede eliminar una OC con facturas aplicadas activas.");
    await PurchaseOrderService.deleteOrder(id);
  }, [visibleApplications]);

  /**
   * Ligar factura a OC con doble validación de saldos:
   * 1. Saldo disponible en la OC.
   * 2. Saldo disponible en la Factura (Global).
   */
  const linkInvoiceToOrder = useCallback(async (ocId: string, invoiceId: string, invoiceNumber: string, amount: number, invoiceTotal: number) => {
    const oc = calculatedOrders.find(o => o.id === ocId);
    if (!oc) throw new Error("Orden de Compra no encontrada.");
    
    if (oc.status === 'CERRADA') throw new Error("La Orden de Compra está cerrada.");
    if (amount <= 0) throw new Error("El monto a aplicar debe ser mayor a 0.");
    
    // 1. Validación de saldo OC
    if (amount > oc.availableBalance + 0.01) throw new Error("El monto excede el saldo disponible de la OC.");

    // 2. Validación de saldo Factura (GLOBAL)
    // Calculamos cuánto se ha usado de esta factura en TODAS las órdenes de compra activas
    const invoiceUsedAmount = visibleApplications
      .filter(app => app.invoiceId === invoiceId && (app.status === 'active' || !app.status))
      .reduce((sum, app) => sum + app.appliedAmount, 0);
    
    const invoiceAvailable = invoiceTotal - invoiceUsedAmount;

    if (amount > invoiceAvailable + 0.01) {
        throw new Error(`El monto excede el saldo real de la factura. Disponible: ${invoiceAvailable.toLocaleString()}`);
    }

    // 3. Evitar duplicados activos en la misma OC
    const exists = visibleApplications.some(app => app.purchaseOrderId === ocId && app.invoiceId === invoiceId && (app.status === 'active' || !app.status));
    if (exists) throw new Error("Esta factura ya está ligada a la Orden de Compra.");

    await PurchaseOrderService.applyInvoice({
      purchaseOrderId: ocId,
      invoiceId,
      invoiceNumber,
      appliedAmount: amount,
      date: new Date().toISOString(),
      status: 'active'
    });
  }, [calculatedOrders, visibleApplications]);

  const updateInvoiceLink = useCallback(async (appId: string, newAmount: number) => {
    if (newAmount <= 0) throw new Error("El monto debe ser mayor a 0.");
    await PurchaseOrderService.updateApplication(appId, { appliedAmount: newAmount });
  }, []);

  const unlinkInvoice = useCallback(async (applicationId: string) => {
    await PurchaseOrderService.removeApplication(applicationId);
  }, []);

  return {
    orders: calculatedOrders,
    applications: visibleApplications, // Exportamos todas las visibles (activas + anuladas)
    allApplicationsRaw: applications, 
    isLoading,
    createOrder,
    updateOrder,
    deleteOrder,
    linkInvoiceToOrder,
    updateInvoiceLink,
    unlinkInvoice,
    loadMore,
    hasMore,
    loading: isLoading
  };
};
