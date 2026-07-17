import { useState, useEffect, useCallback } from 'react';
import { db } from '../firebase';
import { 
  collection, 
  query, 
  onSnapshot, 
  doc, 
  orderBy,
  limit,
  where,
  runTransaction
} from 'firebase/firestore';
import { MaterialRequest } from '../dispatchTypes';
import { User } from '../utils/types';
import { useUserContext } from '../contexts/UserContext';

export const useShortages = (currentUser: User | null) => {
  const { authReady } = useUserContext();
  const [shortages, setShortages] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!authReady || !currentUser) {
      setIsLoading(false);
      return;
    }

    // Consultamos reportes que tengan estado Parcial o Aprobada (potenciales faltantes)
    const baseRef = collection(db, "material_reports");
    const q = query(
      baseRef, 
      where("status", "in", ["Pendiente", "Aprobada", "Parcial"]),
      orderBy("updatedAt", "desc"), 
      limit(100)
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: any[] = [];
      
      snapshot.docs.forEach(docSnap => {
        const data = docSnap.data() as MaterialRequest;
        
        // Filtramos solo los items que realmente tienen faltante
        // Consideramos faltante si shortageQty > 0 (nuevo sistema)
        // O si la solicitud es Parcial y tiene cantidad pendiente (sistema antiguo)
        // Y que no esté resuelta.
        const shortageItems = (data.items || []).filter(item => 
          ((item.shortageQty || 0) > 0 || 
          (data.status === 'Parcial' && (item.quantityPending || 0) > 0)) &&
          !(data as any).resolved
        );
        
        if (shortageItems.length > 0) {
          list.push({
            id: docSnap.id,
            requestId: docSnap.id,
            requestNumber: data.requestNumber,
            projectName: data.projectName,
            origin: data.origin,
            torre: data.torre,
            locationDetails: data.locationDetails,
            planta: data.planta,
            requestedBy: data.requestedBy,
            requestedByName: data.requestedByName,
            date: data.date || data.createdAt,
            status: (data as any).shortageStatus || (data.status === 'Parcial' ? 'En proceso de compra' : 'Pendiente'),
            items: shortageItems.map(item => ({
              materialId: item.inventoryItemId,
              materialCode: item.code,
              materialDescription: item.description,
              quantityShortage: item.shortageQty || item.quantityPending // Fallback to pending if shortageQty missing
            }))
          });
        }
      });
      
      setShortages(list);
      setIsLoading(false);
    }, (err) => {
      console.error("Error in useShortages:", err);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser, authReady]);

  const updateShortageStatus = useCallback(async (id: string, status: any) => {
      // En el nuevo modelo, el "estado" del faltante puede guardarse como un campo extra
      // para tracking operativo, aunque el estado real de la solicitud sea Parcial/Aprobada.
      if (!currentUser) throw new Error("No autenticado");
      
      await runTransaction(db, async (transaction) => {
          const ref = doc(db, "material_reports", id);
          const snap = await transaction.get(ref);
          if (!snap.exists()) return;
          
          const data = snap.data() as MaterialRequest;
          
          if (status === 'Cerrado') {
              const updatedItems = data.items.map(item => ({
                  ...item,
                  quantityPending: 0,
                  shortageQty: 0,
                  status: 'completed' as const
              }));
              transaction.update(ref, {
                  items: updatedItems,
                  status: 'Despachada',
                  shortageStatus: 'Cerrado',
                  updatedAt: new Date().toISOString()
              });
          } else if (status === 'Material recibido') {
              // GENERACIÓN DE NUEVA SOLICITUD DERIVADA
              const newRequestId = crypto.randomUUID();
              const newRequestRef = doc(db, "material_reports", newRequestId);
              
              // 1. Obtener número de solicitud
              const counterRef = doc(db, "counters", "requestNumber");
              const counterSnap = await transaction.get(counterRef);
              let lastNumber = counterSnap.exists() ? (counterSnap.data().lastNumber || 0) : 0;
              const newNumber = lastNumber + 1;
              const finalRequestNumber = `SOL-${String(newNumber).padStart(4, '0')}`;
              transaction.set(counterRef, { lastNumber: newNumber }, { merge: true });

              // 2. Crear solicitud derivada
              const derivedRequestData = {
                  ...data,
                  id: newRequestId,
                  requestNumber: finalRequestNumber,
                  status: 'Pendiente',
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                  updatedBy: currentUser.email,
                  items: data.items.map(item => ({ ...item, shortageQty: 0, quantityRequested: item.shortageQty || 0 })),
                  isDerived: true,
                  originalRequestId: id,
                  derivedFromShortage: true
              };
              transaction.set(newRequestRef, derivedRequestData);

              // 3. Marcar faltante como resuelto
              transaction.update(ref, {
                  shortageStatus: 'Material recibido',
                  resolved: true,
                  updatedAt: new Date().toISOString()
              });
          } else {
              // Persistimos formalmente el estado operativo del faltante
              transaction.update(ref, {
                  shortageStatus: status,
                  updatedAt: new Date().toISOString()
              });
          }
      });
  }, [currentUser]);

  const deleteShortage = useCallback(async (id: string) => {
      // Similar al anterior, podrías simplemente "limpiar" los pendientes
      await updateShortageStatus(id, 'Cerrado');
  }, [updateShortageStatus]);

  return {
    shortages,
    isLoading,
    updateShortageStatus,
    deleteShortage,
    loadMore: () => {},
    hasMore: false,
    loadingMore: false
  };
};
