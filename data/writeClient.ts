import { db } from '../firebase';
import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  setDoc, 
  runTransaction,
  Transaction
} from 'firebase/firestore';
import { guardedWrite } from '../core/writeGuard';

const getTimestamp = () => new Date().toISOString();

// Núcleo genérico de escritura
const core = {
  create: async (collectionName: string, data: any) => {
    return guardedWrite(() => addDoc(collection(db, collectionName), {
      ...data,
      createdAt: getTimestamp()
    }));
  },
  update: async (collectionName: string, id: string, data: any) => {
    return guardedWrite(() => updateDoc(doc(db, collectionName, id), {
      ...data,
      updatedAt: getTimestamp()
    }));
  },
  set: async (collectionName: string, id: string, data: any) => {
    return guardedWrite(() => setDoc(doc(db, collectionName, id), {
      ...data,
      updatedAt: getTimestamp()
    }, { merge: true }));
  },
  delete: async (collectionName: string, id: string) => {
    return guardedWrite(() => deleteDoc(doc(db, collectionName, id)));
  },
  transaction: async <T>(updateFunction: (transaction: Transaction) => Promise<T>): Promise<T> => {
    return guardedWrite(() => runTransaction(db, updateFunction));
  }
};

// Cliente de Escritura Público
export const writeClient = {
  core,
  
  // Módulos Críticos Centralizados
  invoices: {
    create: (data: any) => core.create('invoices', data),
    update: (id: string, data: any) => core.update('invoices', id, data),
    delete: (id: string) => core.delete('invoices', id),
  },
  purchaseOrders: {
    create: (data: any) => core.create('purchase_orders', data),
    update: (id: string, data: any) => core.update('purchase_orders', id, data),
    delete: (id: string) => core.delete('purchase_orders', id),
  },
  inventory: {
    createItem: (data: any) => core.create('inventory_items', data),
    updateItem: (id: string, data: any) => core.update('inventory_items', id, data),
    deleteItem: (id: string) => core.delete('inventory_items', id),
    createMovement: (data: any) => core.create('inventory_movements', data),
  },
  cashflow: {
    createEntry: (data: any) => core.create('cashflow_entries', data),
    updateEntry: (id: string, data: any) => core.update('cashflow_entries', id, data),
    deleteEntry: (id: string) => core.delete('cashflow_entries', id),
  },
  monthlyClosings: {
    close: (id: string, data: any) => core.set('monthly_closings', id, data),
  },
  quotes: {
    create: (data: any) => core.create('invoices', data),
    update: (id: string, data: any) => core.update('invoices', id, data),
    delete: (id: string) => core.delete('invoices', id),
  }
};