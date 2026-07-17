import { db } from '../../../firebase';
import { getAuth } from 'firebase/auth';
import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy, 
  onSnapshot 
} from 'firebase/firestore';
import { Invoice } from './invoice.types';
import { guardedWrite } from '../../../core/writeGuard';
import { auditService } from '../../../services/auditService';

const COLLECTION_NAME = 'invoices';

export const InvoiceService = {
  // Suscripción en tiempo real: Fuente de verdad única
  subscribeToInvoices: (onUpdate: (data: Invoice[]) => void, onError: (error: string) => void) => {
    const auth = getAuth();
    if (!auth.currentUser) {
      console.warn('[InvoiceService] Listener abortado: sin usuario autenticado');
      return () => {};
    }
    const isDevMode = typeof window !== 'undefined' && window.self !== window.top;
    const baseRef = collection(db, COLLECTION_NAME);
    const q = isDevMode ? baseRef : query(baseRef, orderBy('issueDate', 'desc'));
    
    return onSnapshot(q, (snapshot) => {
      const rawData = snapshot.docs.map(doc => doc.data());
      
      const invoices = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data
        } as Invoice;
      });
      
      onUpdate(invoices);
    }, (error) => {
      console.error("Error fetching invoices:", error);
      onError("Error al sincronizar facturas.");
    });
  },

  createInvoice: async (invoice: Omit<Invoice, 'id'>) => {
    const auth = getAuth();
    if (!auth.currentUser) {
      console.warn('[InvoiceService] Acceso abortado: sin usuario autenticado');
      return;
    }
    try {
      const result = await guardedWrite(() => addDoc(collection(db, COLLECTION_NAME), invoice));
      
      auditService.logEvent({
        action: 'create_record',
        module: 'Finanzas',
        submodule: 'Facturas',
        route: '/finanzas',
        recordId: result.id,
        recordCode: invoice.invoiceNumber
      });

      return result;
    } catch (error) {
      console.error("❌ Error al guardar factura:", error);
      throw error;
    }
  },

  updateInvoice: async (id: string, invoice: Partial<Invoice>) => {
    const auth = getAuth();
    if (!auth.currentUser) {
      console.warn('[InvoiceService] Acceso abortado: sin usuario autenticado');
      return;
    }
    const docRef = doc(db, COLLECTION_NAME, id);
    await guardedWrite(() => updateDoc(docRef, {
      ...invoice,
      updatedAt: new Date().toISOString()
    }));

    auditService.logEvent({
      action: 'update_record',
      module: 'Finanzas',
      submodule: 'Facturas',
      route: '/finanzas',
      recordId: id,
      recordCode: invoice.invoiceNumber
    });
  },

  // MODIFICADO: Soft Delete (Anulación Lógica)
  // Cambia el estado a 'Anulada' en lugar de borrar el documento.
  deleteInvoice: async (id: string) => {
    const auth = getAuth();
    if (!auth.currentUser) {
      console.warn('[InvoiceService] Acceso abortado: sin usuario autenticado');
      return;
    }
    const docRef = doc(db, COLLECTION_NAME, id);
    await guardedWrite(() => updateDoc(docRef, {
      status: 'Anulada',
      updatedAt: new Date().toISOString(),
      balance: 0 // Opcional: Resetear saldo pendiente visualmente
    }));

    auditService.logEvent({
      action: 'update_record',
      module: 'Finanzas',
      submodule: 'Facturas',
      route: '/finanzas',
      recordId: id,
      recordCode: 'Anulación'
    });
  },

  // NUEVO: Hard Delete (Eliminación Física)
  // Elimina el documento de la base de datos.
  permanentlyDeleteInvoice: async (id: string) => {
    const auth = getAuth();
    if (!auth.currentUser) {
      console.warn('[InvoiceService] Acceso abortado: sin usuario autenticado');
      return;
    }
    const docRef = doc(db, COLLECTION_NAME, id);
    await guardedWrite(() => deleteDoc(docRef));

    auditService.logEvent({
      action: 'delete_record',
      module: 'Finanzas',
      submodule: 'Facturas',
      route: '/finanzas',
      recordId: id
    });
  },
};