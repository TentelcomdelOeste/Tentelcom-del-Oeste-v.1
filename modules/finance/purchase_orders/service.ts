import { db } from '../../../firebase';
import { getAuth } from 'firebase/auth';
import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  orderBy,
  onSnapshot,
  where,
  getDocs,
  writeBatch
} from 'firebase/firestore';
import { PurchaseOrder, POApplication } from './types';
import { guardedWrite } from '../../../core/writeGuard';
import { formatCurrency } from '../../../utils/formatCurrency';
import { auditService } from '../../../services/auditService';

const OC_COLLECTION = 'purchase_orders';
const APP_COLLECTION = 'purchase_order_applications';

export const PurchaseOrderService = {
  // Suscripción a OCs
  subscribeToOrders: (onUpdate: (data: PurchaseOrder[]) => void) => {
    const auth = getAuth();
    if (!auth.currentUser) {
      console.warn('[PurchaseOrderService] Listener abortado: sin usuario autenticado');
      return () => {};
    }
    const q = query(collection(db, OC_COLLECTION), orderBy('issueDate', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const orders = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as PurchaseOrder));
      onUpdate(orders);
    });
  },

  // Suscripción a Aplicaciones (Relación OC <-> Factura)
  subscribeToApplications: (onUpdate: (data: POApplication[]) => void) => {
    const auth = getAuth();
    if (!auth.currentUser) {
      console.warn('[PurchaseOrderService] Listener abortado: sin usuario autenticado');
      return () => {};
    }
    const q = query(collection(db, APP_COLLECTION));
    return onSnapshot(q, (snapshot) => {
      const apps = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as POApplication));
      onUpdate(apps);
    });
  },

  createOrder: async (order: Omit<PurchaseOrder, 'id'>) => {
    const auth = getAuth();
    if (!auth.currentUser) {
      console.warn('[PurchaseOrderService] Acceso abortado: sin usuario autenticado');
      return;
    }
    const docRef = await guardedWrite(() => addDoc(collection(db, OC_COLLECTION), order));
    
    // Log audit in background
    auditService.logEvent({
      action: 'create_record',
      module: 'Finanzas',
      submodule: 'Orden de Compra',
      route: '/finanzas',
      recordId: docRef.id,
      recordCode: order.ocNumber
    });
  },

  updateOrder: async (id: string, data: Partial<PurchaseOrder>) => {
    const auth = getAuth();
    if (!auth.currentUser) {
      console.warn('[PurchaseOrderService] Acceso abortado: sin usuario autenticado');
      return;
    }
    await guardedWrite(() => updateDoc(doc(db, OC_COLLECTION, id), data));
    
    // Log audit in background
    auditService.logEvent({
      action: 'update_record',
      module: 'Finanzas',
      submodule: 'Orden de Compra',
      route: '/finanzas',
      recordId: id,
      recordCode: data.ocNumber
    });
  },

  deleteOrder: async (id: string) => {
    const auth = getAuth();
    if (!auth.currentUser) {
      console.warn('[PurchaseOrderService] Acceso abortado: sin usuario autenticado');
      return;
    }
    // 1. Consultar si existen aplicaciones activas ligadas a esta Orden de Compra
    const appsRef = collection(db, APP_COLLECTION);
    const q = query(
      appsRef, 
      where('purchaseOrderId', '==', id),
      where('status', '==', 'active')
    );
    
    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      // 2. Extraer detalles de facturas y montos para un error informativo
      const detail = snapshot.docs
        .map(d => {
          const data = d.data();
          return `• Factura ${data.invoiceNumber} — Monto: ${formatCurrency(data.appliedAmount)}`;
        })
        .join('\n');
      
      throw new Error(
        `No se puede eliminar esta Orden de Compra porque tiene facturas ligadas:\n\n${detail}`
      );
    }

    // 3. Si no tiene dependencias activas, proceder con la eliminación física protegida
    await guardedWrite(() => deleteDoc(doc(db, OC_COLLECTION, id)));

    // Log audit in background
    auditService.logEvent({
      action: 'delete_record',
      module: 'Finanzas',
      submodule: 'Orden de Compra',
      route: '/finanzas',
      recordId: id
    });
  },

  // Crear aplicación (Ligar factura a OC)
  applyInvoice: async (application: Omit<POApplication, 'id'>) => {
    const auth = getAuth();
    if (!auth.currentUser) {
      console.warn('[PurchaseOrderService] Acceso abortado: sin usuario autenticado');
      return;
    }
    await guardedWrite(() => addDoc(collection(db, APP_COLLECTION), {
      ...application,
      status: 'active' // Aseguramos estado activo por defecto
    }));
  },

  // Actualizar aplicación (Editar monto ligado)
  updateApplication: async (id: string, data: Partial<POApplication>) => {
    const auth = getAuth();
    if (!auth.currentUser) {
      console.warn('[PurchaseOrderService] Acceso abortado: sin usuario autenticado');
      return;
    }
    await guardedWrite(() => updateDoc(doc(db, APP_COLLECTION, id), data));
  },

  // Borrar aplicación (Desligar - Soft Delete)
  removeApplication: async (id: string) => {
    const auth = getAuth();
    if (!auth.currentUser) {
      console.warn('[PurchaseOrderService] Acceso abortado: sin usuario autenticado');
      return;
    }
    // En lugar de deleteDoc, usamos updateDoc para marcar como 'deleted'
    await guardedWrite(() => updateDoc(doc(db, APP_COLLECTION, id), {
      status: 'deleted',
      updatedAt: new Date().toISOString()
    }));
  },

  // NUEVO: Liberar todas las aplicaciones de una factura (Al anular factura)
  releaseApplicationsForInvoice: async (invoiceId: string) => {
    const auth = getAuth();
    if (!auth.currentUser) {
      console.warn('[PurchaseOrderService] Acceso abortado: sin usuario autenticado');
      return;
    }
    return guardedWrite(async () => {
        // Buscar todas las aplicaciones de esta factura, sin filtrar por estado inicial
        // para asegurar que capturamos incluso datos legacy.
        const q = query(
          collection(db, APP_COLLECTION), 
          where('invoiceId', '==', invoiceId)
        );
        
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) return;

        const batch = writeBatch(db);
        
        snapshot.docs.forEach(d => {
          const data = d.data();
          // Solo actualizamos si no está ya anulada o borrada, para evitar escrituras redundantes
          if (data.status !== 'voided' && data.status !== 'deleted') {
              const ref = doc(db, APP_COLLECTION, d.id);
              batch.update(ref, { 
                status: 'voided', // voided significa que el registro existe pero el monto es 0
                updatedAt: new Date().toISOString(),
                reason: 'Factura Anulada - Liberación Automática' 
              });
          }
        });

        await batch.commit();
    });
  }
};