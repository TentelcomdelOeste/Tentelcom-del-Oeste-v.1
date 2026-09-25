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
  runTransaction,
  increment,
  getDocs
} from 'firebase/firestore';
import { MaterialRequest } from '../dispatchTypes';
import { User } from '../utils/types';
import { useUserContext } from '../contexts/UserContext';

export const useShortages = (currentUser: User | null) => {
  const { authReady } = useUserContext();
  const [shortages, setShortages] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!authReady || !currentUser?.uid) {
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
        // O si la solicitud es Parcial y el ítem no tiene el campo shortageQty definido pero tiene pendiente (sistema antiguo)
        // Y que no esté resuelta.
        const shortageItems = (data.items || []).filter(item => {
          if ((data as any).resolved) return false;
          const shortage = item.shortageQty !== undefined ? (item.shortageQty || 0) : 0;
          if (shortage > 0) return true;
          // Compatibilidad retroactiva SOLO para solicitudes legacy que no tenían el campo shortageQty
          if (item.shortageQty === undefined && data.status === 'Parcial' && (item.quantityPending || 0) > 0) {
            return true;
          }
          return false;
        });
        
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
              quantityShortage: (item.shortageQty !== undefined && item.shortageQty > 0) ? item.shortageQty : (item.quantityPending || 0)
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
  }, [currentUser?.uid, authReady]);

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
              const lastNumber = counterSnap.exists() ? (counterSnap.data().lastNumber || 0) : 0;
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

  const reintegrateShortageToOriginal = useCallback(async (id: string) => {
      if (!currentUser) throw new Error("No autenticado");
      
      // Consultar otras solicitudes activas para conocer la reserva real de OTRAS solicitudes
      const activeSnap = await getDocs(query(
          collection(db, "material_reports"),
          where("status", "in", ["Pendiente", "Aprobada"])
      ));
      
      const reservedByOthersMap: Record<string, number> = {};
      for (const d of activeSnap.docs) {
          if (d.id === id) continue; // Excluir la solicitud actual
          const reqData = d.data() as MaterialRequest;
          for (const it of reqData.items || []) {
              if (!it.inventoryItemId) continue;
              const resv = Math.max(0, (it.quantityRequested || 0) - (it.shortageQty || 0) - (it.quantityDispatched || 0));
              reservedByOthersMap[it.inventoryItemId] = (reservedByOthersMap[it.inventoryItemId] || 0) + resv;
          }
      }

      await runTransaction(db, async (transaction) => {
          // 1. LECTURAS (READS) PRIMERO
          const ref = doc(db, "material_reports", id);
          const snap = await transaction.get(ref);
          if (!snap.exists()) throw new Error("La solicitud no existe.");
          
          const data = snap.data() as MaterialRequest;
          const items = data.items || [];

          // Identificar ítems con faltante y leer sus documentos de inventario antes de cualquier escritura
          const itemReads: { 
            index: number; 
            item: any; 
            shortage: number; 
            itemRef: any; 
            itemSnap: any;
          }[] = [];

          for (let i = 0; i < items.length; i++) {
              const item = items[i];
              const shortage = item.shortageQty || item.quantityPending || 0;

              if (shortage > 0 && item.inventoryItemId) {
                  const itemRef = doc(db, "inventory_items", item.inventoryItemId);
                  const itemSnap = await transaction.get(itemRef);
                  itemReads.push({
                      index: i,
                      item,
                      shortage,
                      itemRef,
                      itemSnap
                  });
              }
          }

          if (itemReads.length === 0) {
              throw new Error("No se encontraron ítems con faltante activo en esta solicitud.");
          }

          // 2. CÁLCULOS Y PREPARACIÓN
          const updatedItems = [...items];
          const writesToExecute: { itemRef: any; newReserved: number }[] = [];
          let totalCovered = 0;

          for (const { index, item, shortage, itemRef, itemSnap } of itemReads) {
              if (itemSnap.exists()) {
                  const itemData = itemSnap.data();
                  const currentStock = itemData.stock || 0;
                  const othersReserved = reservedByOthersMap[item.inventoryItemId] || 0;
                  // Disponibilidad real para esta solicitud = stock físico - lo reservado por otros
                  const availableForThis = Math.max(0, currentStock - othersReserved);

                  const qtyRequested = item.quantityRequested || item.quantity || 0;
                  const currentDispatched = item.quantityDispatched || 0;
                  const needed = Math.max(0, qtyRequested - currentDispatched);
                  
                  // Total que esta solicitud puede tener cubierto con el disponible
                  const canCoverTotal = Math.min(needed, availableForThis);
                  const newlyCovered = Math.max(0, canCoverTotal - (needed - shortage));

                  if (newlyCovered > 0) {
                      totalCovered += newlyCovered;
                      const newShortage = Math.max(0, shortage - newlyCovered);
                      const newPending = canCoverTotal;

                      updatedItems[index] = {
                          ...item,
                          shortageQty: newShortage,
                          quantityPending: newPending
                      };

                      // Nueva reserva en inventario = reserva de otros + total cubierto para esta solicitud
                      const finalReserved = othersReserved + canCoverTotal;
                      writesToExecute.push({ itemRef, newReserved: finalReserved });
                  }
              }
          }

          if (totalCovered === 0) {
              throw new Error("No hay stock disponible suficiente en Inventario General para cubrir este faltante actualmente.");
          }

          // 3. ESCRITURAS (WRITES) DESPUÉS DE TODAS LAS LECTURAS
          for (const { itemRef, newReserved } of writesToExecute) {
              transaction.update(itemRef, {
                  reserved: newReserved
              });
          }

          const remainingShortage = updatedItems.reduce((acc, it) => acc + (it.shortageQty || 0), 0);
          const isFullyResolved = remainingShortage === 0;

          transaction.update(ref, {
              items: updatedItems,
              status: isFullyResolved ? (data.status === 'Parcial' ? 'Aprobada' : data.status) : data.status,
              shortageStatus: isFullyResolved ? 'Material recibido' : 'Parcial',
              resolved: isFullyResolved,
              updatedAt: new Date().toISOString()
          });
      });
  }, [currentUser]);

  return {
    shortages,
    isLoading,
    updateShortageStatus,
    reintegrateShortageToOriginal,
    deleteShortage,
    loadMore: () => {},
    hasMore: false,
    loadingMore: false
  };
};
