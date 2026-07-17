import { 
  query, 
  limit, 
  startAfter, 
  getDocs, 
  Query, 
  QueryDocumentSnapshot,
  DocumentData 
} from "firebase/firestore";

export const PAGE_SIZE = 50;

export interface PaginatedResult<T> {
  items: T[];
  lastDoc: QueryDocumentSnapshot<DocumentData> | null;
  hasMore: boolean;
}

/**
 * Ejecuta una consulta paginada a Firestore.
 * Utiliza 'startAfter' para paginación eficiente basada en cursores.
 * 
 * @param baseQuery Query base con filtros y ordenamiento (SIN limit ni startAfter)
 * @param lastDoc Último documento de la página anterior (null para la primera página)
 * @param pageSize Tamaño de página (por defecto 50)
 */
export async function fetchPage<T>(
  baseQuery: Query<DocumentData>,
  lastDoc: QueryDocumentSnapshot<DocumentData> | null,
  pageSize: number = PAGE_SIZE
): Promise<PaginatedResult<T>> {
  
  let q = query(baseQuery, limit(pageSize));

  if (lastDoc) {
    q = query(baseQuery, startAfter(lastDoc), limit(pageSize));
  }

  const snapshot = await getDocs(q);
  
  // Mapeo genérico asumiendo que T extiende un objeto con id
  const items = snapshot.docs.map(doc => ({ 
    id: doc.id, 
    ...doc.data() 
  } as unknown as T));

  const newLastDoc = snapshot.docs[snapshot.docs.length - 1] || null;
  const hasMore = snapshot.docs.length === pageSize;

  return { 
    items, 
    lastDoc: newLastDoc, 
    hasMore 
  };
}