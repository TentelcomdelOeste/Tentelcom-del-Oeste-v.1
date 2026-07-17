import { db } from '@/firebase';
import { collection, query, orderBy, limit, getDocs, startAfter, QueryDocumentSnapshot } from 'firebase/firestore';

export interface AnalyticsEvent {
  id: string;
  eventType: string;
  timestamp: any;
  [key: string]: any;
}

const ANALYTICS_COLLECTION = 'analytics_events';
const PAGE_SIZE = 50;

/**
 * Servicio para gestionar la lectura eficiente de analíticas.
 * Implementa paginación básica.
 */
export const fetchAnalyticsEvents = async (lastVisible: QueryDocumentSnapshot | null = null) => {
  const collRef = collection(db, ANALYTICS_COLLECTION);
  let q = query(collRef, orderBy('timestamp', 'desc'), limit(PAGE_SIZE));

  if (lastVisible) {
    q = query(collRef, orderBy('timestamp', 'desc'), startAfter(lastVisible), limit(PAGE_SIZE));
  }

  const snapshot = await getDocs(q);
  const events = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AnalyticsEvent));
  
  return {
    events,
    lastVisible: snapshot.docs[snapshot.docs.length - 1] || null
  };
};
