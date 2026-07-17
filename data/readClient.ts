
import { db } from '../firebase';
import { getAuth } from 'firebase/auth';
import { 
  collection, 
  query, 
  getDocs, 
  onSnapshot, 
  QueryConstraint,
  orderBy
} from 'firebase/firestore';

import { logger } from '../utils/logger';

// Núcleo genérico de lectura
const core = {
  // Lectura única
  get: async <T>(collectionName: string, ...constraints: QueryConstraint[]): Promise<T[]> => {
    const auth = getAuth();
    if (!auth.currentUser) {
      console.warn(`[readClient.get] ${collectionName} abortado: sin usuario`);
      return [];
    }
    const isDevMode = typeof window !== 'undefined' && window.self !== window.top;
    const baseRef = collection(db, collectionName);
    const q = isDevMode ? baseRef : query(baseRef, ...constraints);
    
    const snapshot = await getDocs(q);
    logger.log(`[readClient.get] ${collectionName} loaded:`, snapshot.size);
    
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
    
    return data;
  },
  
  // Suscripción en tiempo real
  subscribe: <T>(collectionName: string, onData: (data: T[]) => void, onError: (err: any) => void, ...constraints: QueryConstraint[]) => {
    const auth = getAuth();
    if (!auth.currentUser) {
      console.warn(`[readClient.subscribe] ${collectionName} abortado: sin usuario`);
      return () => {};
    }
    const isDevMode = typeof window !== 'undefined' && window.self !== window.top;
    const baseRef = collection(db, collectionName);
    const q = isDevMode ? baseRef : query(baseRef, ...constraints);
    
    return onSnapshot(q, (snapshot) => {
      logger.log(`[readClient.subscribe] ${collectionName} loaded:`, snapshot.size);
      
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as T));
      
      onData(data);
    }, onError);
  }
};

// Cliente de Lectura Público
export const readClient = {
  core,
  
  // Dominios específicos (Migración progresiva)
  monthlyClosings: {
    subscribe: (onData: (data: any[]) => void, onError: (err: any) => void) => {
      // ACTUALIZADO: Lectura desde la colección correcta de snapshots
      return core.subscribe('financial_month_snapshots', onData, onError, orderBy('id', 'desc'));
    }
  }
};
